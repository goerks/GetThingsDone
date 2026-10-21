import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import { LocalStorageRepository } from './data/localStorageRepository';
import { seedSnapshot } from './data/seed';
import { issueUrl } from './sync/github/format';
import { todayIso } from './domain/sprints';
import { AUTO_INTERVAL_MS } from './domain/syncLog';
import type { ConflictRule, Story } from './domain/types';
import { initI18n } from './i18n';
import { fakeGithub, fakeIssue, REPO } from './test/fakeGithub';

beforeAll(() => {
  initI18n('en');
});

// The clock runs by itself, so the app and the test library keep working, and it can be moved forward by 15 minutes.
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const repoRef = { owner: 'goerks', name: 'GetThingsDone' };

const linked = (number: number, title: string, baseTitle: string): Story => ({
  id: `story-gh-${number}`,
  code: `G-${number}`,
  title,
  description: '',
  epicId: null,
  points: 0,
  status: 'todo',
  sprintId: null,
  releaseId: null,
  rank: 100 + number,
  criteria: [],
  values: {},
  checks: {},
  doneItems: null,
  link: { service: 'github', key: `#${number}`, url: issueUrl(repoRef, number), state: 'open', base: { title: baseTitle, description: '', labels: [], criteria: [], done: false } }
});

interface Options {
  auto?: boolean;
  write?: boolean;
  conflict?: ConflictRule;
  stories?: Story[];
  issues?: Parameters<typeof fakeGithub>[0];
  hash?: string;
}

async function renderApp({ auto = true, write = false, conflict = 'remote', stories = [], issues = [], hash = '#/backlog' }: Options = {}) {
  const fake = fakeGithub(issues);
  const repository = new LocalStorageRepository();
  const seed = seedSnapshot(todayIso());
  await repository.replaceAll({
    ...seed,
    stories: [...seed.stories, ...stories],
    settings: { ...seed.settings, features: { ...seed.settings.features, sync: true }, sync: { service: 'github', connection: { repo: REPO }, lastSyncAt: null, write, conflict, ignored: [], managed: { labels: [], milestones: [] }, auto, log: [] } }
  });
  await fake.tokens.set('good');
  window.location.hash = hash;
  render(<App repository={repository} sync={fake.sync} />);
  await screen.findByRole('heading', { level: 1 });
  return { fake, repository };
}

/** Lets the clock of the test run on: the timer looks every few seconds, and a run that is due starts at the next look. */
const pass = async (ms: number): Promise<void> => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

const log = async (repository: LocalStorageRepository) => (await repository.load()).settings.sync.log;

describe('the automatic sync', () => {
  it('AC18.2 runs at the start and when the app comes back', async () => {
    // Given the switch on and a new issue on GitHub
    const { fake, repository } = await renderApp({ issues: [fakeIssue(41, { title: 'Notifications' })] });
    // Then the issue is a story without a click, and a notice says so
    expect(await screen.findByText('Notifications')).toBeInTheDocument();
    expect(await screen.findByText('Synchronised: 1 new')).toBeInTheDocument();
    await waitFor(async () => expect((await log(repository))[0]?.trigger).toBe('start'));
    // And when the app comes back to the front, a new title is taken
    fake.state.issues = [fakeIssue(41, { title: 'Alerts' })];
    document.dispatchEvent(new Event('visibilitychange'));
    await pass(5000);
    expect(await screen.findByText('Alerts')).toBeInTheDocument();
    await waitFor(async () => expect((await log(repository))[0]?.trigger).toBe('start'));
  });

  it('AC18.3 runs again every 15 minutes', async () => {
    // Given a run at the start
    const { fake, repository } = await renderApp({ issues: [fakeIssue(41, { title: 'Notifications' })] });
    await screen.findByText('Notifications');
    await waitFor(async () => expect(await log(repository)).toHaveLength(1));
    // When a title changes on GitHub and 15 minutes pass
    fake.state.issues = [fakeIssue(41, { title: 'Alerts' })];
    await pass(AUTO_INTERVAL_MS + 6000);
    // Then the new title is in the story without a click, by an "Automatic" run
    expect(await screen.findByText('Alerts')).toBeInTheDocument();
    await waitFor(async () => expect((await log(repository))[0]?.trigger).toBe('auto'));
  });

  it('AC18.4 writes to GitHub only while writing is on', async () => {
    // Given a story that was changed here
    const stories = [linked(31, 'Anmeldung', 'Login')];
    const off = await renderApp({ stories, issues: [fakeIssue(31, { title: 'Login' })], write: false });
    await waitFor(async () => expect(await log(off.repository)).toHaveLength(1));
    // Then writing off leaves GitHub as it is
    expect(off.fake.state.writes).toEqual([]);
    cleanup();
    // And writing on sends the change
    const on = await renderApp({ stories, issues: [fakeIssue(31, { title: 'Login' })], write: true });
    await waitFor(() => expect(on.fake.state.issues[0].title).toBe('Anmeldung'));
  });

  it('AC18.6 keeps the switch and turns it off when the connection is removed', async () => {
    // Given the switch off in the settings
    const { fake, repository } = await renderApp({ auto: false, hash: '#/settings/sync' });
    const box = await screen.findByRole('checkbox', { name: 'Synchronise automatically' });
    // When I switch it on
    fireEvent.click(box);
    await waitFor(async () => expect((await repository.load()).settings.sync.auto).toBe(true));
    // Then it is still on after a reload
    cleanup();
    render(<App repository={repository} sync={fake.sync} />);
    expect(await screen.findByRole('checkbox', { name: 'Synchronise automatically' })).toBeChecked();
    // And removing the connection turns it off
    fireEvent.click(screen.getByRole('button', { name: 'Remove connection' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove connection' }));
    await waitFor(async () => expect((await repository.load()).settings.sync.auto).toBe(false));
  });

  it('AC18.7 starts no second run while one is going on', async () => {
    // Given an automatic run that has not finished
    const { fake } = await renderApp({ issues: [], hash: '#/backlog' });
    await waitFor(() => expect(fake.state.calls).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Synchronise' })).not.toHaveAttribute('aria-busy'));
    let calls = 0;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    fake.api.openIssues = async () => {
      calls += 1;
      await gate;
      return [];
    };
    // When it is due again and I press the icon at the same time
    await pass(AUTO_INTERVAL_MS + 6000);
    await waitFor(() => expect(calls).toBe(1));
    fireEvent.click(screen.getByRole('button', { name: 'Synchronise' }));
    // Then no second run starts
    expect(calls).toBe(1);
    release();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Synchronise' })).not.toHaveAttribute('aria-busy'));
  });

  it('AC19.1 asks nothing in an automatic run and offers to review the conflict', async () => {
    // Given the rule "I decide" and a title that changed on both sides
    await renderApp({ conflict: 'ask', stories: [linked(31, 'Anmeldung', 'Login')], issues: [fakeIssue(31, { title: 'Login-Seite' })] });
    // Then the run opens no dialog, the notice names the conflict and the icon counts it
    const notice = await screen.findByText('Conflicts waiting for you: 1');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelector('.github-sync__count')).toHaveTextContent('1');
    // And "Review" opens the known choice
    fireEvent.click(within(notice.closest('.toast') as HTMLElement).getByRole('button', { name: 'Review' }));
    expect(await screen.findByRole('heading', { name: 'Both sides changed the same thing' })).toBeInTheDocument();
  });

  it('AC19.2 pauses after three errors in a row and resumes with the icon', async () => {
    // Given no network
    const { fake, repository } = await renderApp({ issues: [fakeIssue(1)] });
    await waitFor(async () => expect(await log(repository)).toHaveLength(1));
    fake.state.offline = true;
    // When three runs fail in a row (the first at the start may have run before the network went)
    const failures = async (): Promise<number> => (await log(repository)).filter((entry) => entry.error !== null).length;
    for (let round = 1; round <= 4 && (await failures()) < 3; round += 1) {
      await pass(AUTO_INTERVAL_MS + 6000);
      await waitFor(async () => expect(await failures()).toBeGreaterThanOrEqual(Math.min(round, 3)));
    }
    // Then the automatic sync pauses, the icon shows "!" and the notice says so
    expect(await screen.findByText(/Automatic sync paused after errors/)).toBeInTheDocument();
    expect(document.querySelector('.github-sync__count--warn')).toHaveTextContent('!');
    // And pressing the icon runs once and resumes
    fake.state.offline = false;
    fireEvent.click(screen.getByRole('button', { name: 'Synchronise' }));
    await waitFor(() => expect(document.querySelector('.github-sync__count--warn')).toBeNull());
  });
});
