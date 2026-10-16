import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { LocalStorageRepository } from './data/localStorageRepository';
import { seedSnapshot } from './data/seed';
import { addDays, todayIso } from './domain/sprints';
import { initI18n } from './i18n';
import { EMPTY_DEFINITIONS } from './domain/definitions';


beforeAll(() => {
  initI18n('en');
});

type Seed = ReturnType<typeof seedSnapshot>;

async function openScope(tweak?: (seed: Seed) => Seed, release = /Release 1\.0/, tab = 'Scope'): Promise<{ repository: LocalStorageRepository; dialog: HTMLElement }> {
  const repository = new LocalStorageRepository();
  const seed = seedSnapshot(todayIso());
  await repository.replaceAll(tweak ? tweak(seed) : seed);
  window.location.hash = '#/releases';
  render(<App repository={repository} />);
  await screen.findByRole('heading', { name: 'Releases', level: 1 });
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: release }));
  const dialog = await screen.findByRole('dialog', { name: /Release 1\./ });
  await user.click(within(dialog).getByRole('tab', { name: tab }));
  return { repository, dialog };
}

describe('scope report', () => {
  it('is the third tab of the release dialog', async () => {
    const { dialog } = await openScope();
    expect(within(dialog).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Details', 'Stories (6)', 'Scope', 'Burndown']);
    expect(within(dialog).getByRole('tab', { name: 'Scope' })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows start, increase, decrease and the scope now for the demo history, in points', async () => {
    const { dialog } = await openScope();
    const kpis = within(dialog).getAllByRole('term').map((term) => [term.textContent, term.nextElementSibling?.textContent]);
    expect(kpis).toEqual([
      ['Scope at the start', '16'],
      ['Increase', '+10'],
      ['Decrease', '−3'],
      ['Scope now', '23']
    ]);
    expect(within(dialog).getByText(/Recorded since .* Nothing is known about the time before\./)).toBeInTheDocument();
  });

  it('counts tickets when the unit is switched, and remembers the choice', async () => {
    const user = userEvent.setup();
    const { dialog } = await openScope();
    expect(within(dialog).getByRole('button', { name: 'Points' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(dialog).getByRole('button', { name: 'Tickets' }));
    expect(within(dialog).getByRole('button', { name: 'Tickets' })).toHaveAttribute('aria-pressed', 'true');
    const kpis = within(dialog).getAllByRole('term').map((term) => term.nextElementSibling?.textContent);
    expect(kpis).toEqual(['5', '+2', '−1', '6']);
    expect(window.localStorage.getItem('getitdone.reportUnit')).toBe('tickets');
  });

  it('describes the chart for assistive technology and offers the same numbers as a table', async () => {
    const user = userEvent.setup();
    const { dialog } = await openScope();
    expect(within(dialog).getByRole('img', { name: 'Scope in Points: 16 at the start, 23 now, 3 done' })).toBeInTheDocument();
    await user.click(within(dialog).getByText('Show as table'));
    const table = within(dialog).getByRole('table', { name: /Scope in Points/ });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(1 + 9);
    expect(within(rows[rows.length - 1]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['23', '3', '–']);
  });

  it('lists every change, newest first, with the stories that were deleted', async () => {
    const { dialog } = await openScope();
    const table = within(dialog).getByRole('table', { name: 'Changes of the scope' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('S-3 Reorder the backlog by priorityPoints 3 → 5 (+2)'),
      expect.stringContaining('S-8 (deleted story)Removed −3 P'),
      expect.stringContaining('S-6 Operate the board with the keyboard onlyAdded +5 P'),
      expect.stringContaining('S-5 Switch the UI language (DE, EN, FR, IT)Added +3 P')
    ]);
  });

  it('says there is no history for a release that has none', async () => {
    const { dialog } = await openScope((seed) => ({ ...seed, events: [] }), /Release 1\.0/);
    // The app starts the history of a release that has stories when it loads.
    expect(within(dialog).getByText(/Recorded since/)).toBeInTheDocument();
    expect(within(dialog).getByText('The chart needs at least two days of history.')).toBeInTheDocument();
    expect(within(dialog).getByText('No changes of the scope since the start.')).toBeInTheDocument();
  });

  it('says so for an empty release', async () => {
    const user = userEvent.setup();
    const { dialog } = await openScope((seed) => ({
      ...seed,
      releases: [...seed.releases, { id: 'r-empty', title: 'Release 3.0', description: '', startDate: null, endDate: null }]
    }));
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: /Release 3\.0/ }));
    await user.click(within(await screen.findByRole('dialog', { name: /Release 3\.0/ })).getByRole('tab', { name: 'Scope' }));
    expect(screen.getByText(/No history yet/)).toBeInTheDocument();
  });

  it('shows the net change on the card of the release', async () => {
    const repository = new LocalStorageRepository();
    await repository.replaceAll(seedSnapshot(todayIso()));
    window.location.hash = '#/releases';
    render(<App repository={repository} />);
    const card = await screen.findByRole('button', { name: /Release 1\.0/ });
    expect(card).toHaveTextContent('Scope since start');
    expect(card).toHaveTextContent('+1 story');
    expect(card).toHaveTextContent('+7 P');
    const other = screen.getByRole('button', { name: /Release 1\.1/ });
    expect(other).toHaveTextContent('Scope since start ±0');
  });
});

describe('recording the history', () => {
  async function renderApp(): Promise<LocalStorageRepository> {
    const repository = new LocalStorageRepository();
    const seed = seedSnapshot(todayIso());
    // Release 1.1 has no stories left to start from, so its history is easy to read.
    await repository.replaceAll({ ...seed, events: seed.events.filter((event) => event.releaseId !== 'release-map') });
    window.location.hash = '#/board';
    render(<App repository={repository} />);
    await screen.findByRole('heading', { level: 1 });
    return repository;
  }
  const eventsOf = async (repository: LocalStorageRepository, releaseId: string) =>
    (await repository.load()).events.filter((event) => event.releaseId === releaseId && !event.id.startsWith('event-demo'));

  it('starts the history of a release that has stories and none when the app loads', async () => {
    const repository = await renderApp();
    const events = await eventsOf(repository, 'release-map');
    expect(events).toMatchObject([{ kind: 'baseline', storyId: 'story-7', code: 'S-7', points: 8, done: false }]);
  });

  it('records a story that joins and leaves a release, a change of points and finishing a story', async () => {
    const user = userEvent.setup();
    const repository = await renderApp();
    await user.dblClick(await screen.findByRole('group', { name: /S-3:/ }));
    const dialog = await screen.findByRole('dialog', { name: /S-3:/ });
    await user.click(within(dialog).getByRole('radio', { name: '8' }));
    await user.selectOptions(within(dialog).getByLabelText('Status'), 'Done');
    await user.selectOptions(within(dialog).getByLabelText('Release'), 'Release 1.1 – Story map');
    await waitFor(async () => {
      const beta = await eventsOf(repository, 'release-beta');
      const map = await eventsOf(repository, 'release-map');
      expect(beta.map((event) => [event.kind, event.storyId, event.points, event.done])).toEqual([
        ['points', 'story-3', 8, false],
        ['done', 'story-3', 8, true],
        ['removed', 'story-3', 8, true]
      ]);
      expect(map.map((event) => [event.kind, event.storyId])).toEqual([['baseline', 'story-7'], ['added', 'story-3']]);
    });
  });

  it('records a story that is deleted as removed', async () => {
    const user = userEvent.setup();
    const repository = await renderApp();
    await user.dblClick(await screen.findByRole('group', { name: /S-2:/ }));
    const dialog = await screen.findByRole('dialog', { name: /S-2:/ });
    await user.click(within(dialog).getByRole('button', { name: 'Delete story' }));
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(async () => {
      expect((await eventsOf(repository, 'release-beta')).map((event) => [event.kind, event.code])).toEqual([['removed', 'S-2']]);
    });
  });

  it('records nothing for a change of a story without a release', async () => {
    const user = userEvent.setup();
    const repository = new LocalStorageRepository();
    const seed = seedSnapshot(todayIso());
    await repository.replaceAll({ ...seed, stories: seed.stories.map((story) => ({ ...story, releaseId: null })), releases: [], events: [] });
    window.location.hash = '#/board';
    render(<App repository={repository} />);
    await user.dblClick(await screen.findByRole('group', { name: /S-3:/ }));
    await user.click(within(await screen.findByRole('dialog', { name: /S-3:/ })).getByRole('radio', { name: '8' }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((await repository.load()).events).toEqual([]);
  });

  it('records a move between releases on the story map', async () => {
    const user = userEvent.setup();
    const repository = new LocalStorageRepository();
    const seed = seedSnapshot(todayIso());
    await repository.replaceAll({ ...seed, settings: { mapRows: 'releases', features: { releases: true }, definitions: EMPTY_DEFINITIONS } });
    window.location.hash = '#/map';
    render(<App repository={repository} />);
    await screen.findByRole('heading', { name: 'Story Map', level: 1 });
    // S-7 has no sprint; make it a drag by keyboard is covered in the domain tests, so use the dialog's field here.
    await user.dblClick(screen.getByRole('group', { name: /S-7:/ }));
    await user.selectOptions(within(await screen.findByRole('dialog', { name: /S-7:/ })).getByLabelText('Release'), 'No release');
    await waitFor(async () => {
      const events = (await repository.load()).events.filter((event) => event.storyId === 'story-7');
      expect(events.map((event) => event.kind)).toEqual(['baseline', 'removed']);
    });
  });

  it('forgets the history when the release is deleted', async () => {
    const user = userEvent.setup();
    const repository = await renderApp();
    window.location.hash = '#/releases';
    await user.click(await screen.findByRole('button', { name: /Release 1\.0/ }));
    const dialog = await screen.findByRole('dialog', { name: /Release 1\.0/ });
    await user.click(within(dialog).getByRole('button', { name: 'Delete release' }));
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(async () => {
      const saved = await repository.load();
      expect(saved.events.some((event) => event.releaseId === 'release-beta')).toBe(false);
      expect(saved.events.some((event) => event.releaseId === 'release-map')).toBe(true);
    });
  });

  it('stores the demo history together with the demo data', async () => {
    const repository = new LocalStorageRepository();
    const seed = seedSnapshot(todayIso());
    await repository.replaceAll({ ...seed, releases: seed.releases.map((release) => (release.id === 'release-map' ? { ...release, startDate: addDays(todayIso(), -3) } : release)) });
    expect((await repository.load()).events.filter((event) => event.releaseId === 'release-map')).toHaveLength(1);
  });
});

describe('burndown', () => {
  it('shows what is left, what is done and where the release stands against the target line', async () => {
    const { dialog } = await openScope(undefined, /Release 1\.0/, 'Burndown');
    expect(within(dialog).getByRole('tab', { name: 'Burndown' })).toHaveAttribute('aria-selected', 'true');
    const kpis = within(dialog).getAllByRole('term').map((term) => [term.textContent, term.nextElementSibling?.textContent]);
    expect(kpis).toEqual([
      ['Left', '20'],
      ['Done', '3 of 23'],
      ['Against the target line', expect.stringMatching(/^\d+(\.\d)? P behind$/)]
    ]);
    expect(within(dialog).getByText(/Recorded since .* Nothing is known about the time before\./)).toBeInTheDocument();
  });

  it('draws the chart with a target line and says what it shows', async () => {
    const { dialog } = await openScope(undefined, /Release 1\.0/, 'Burndown');
    expect(within(dialog).getByRole('img', { name: 'Burndown in Points: 20 left today, 3 of 23 done' })).toBeInTheDocument();
    expect(dialog.querySelector('.scope-chart__ideal')).not.toBeNull();
    expect(dialog.querySelector('.scope-chart__today')).not.toBeNull();
    expect(dialog.querySelector('.scope__key--ideal')).toHaveTextContent('Target line');
    expect(within(dialog).queryByText(/there is no target line/)).not.toBeInTheDocument();
  });

  it('counts tickets when the unit is switched, shared with the scope report', async () => {
    const user = userEvent.setup();
    const { dialog } = await openScope(undefined, /Release 1\.0/, 'Burndown');
    await user.click(within(dialog).getByRole('button', { name: 'Tickets' }));
    expect(within(dialog).getByRole('img', { name: 'Burndown in Tickets: 5 left today, 1 of 6 done' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('tab', { name: 'Scope' }));
    expect(within(dialog).getByRole('button', { name: 'Tickets' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('offers the numbers as a table, with the days after today left empty', async () => {
    const user = userEvent.setup();
    const { dialog } = await openScope(undefined, /Release 1\.0/, 'Burndown');
    await user.click(within(dialog).getByText('Show as table'));
    const rows = within(dialog).getByRole('table', { name: /Burndown in Points/ }).querySelectorAll('tbody tr');
    expect(rows.length).toBeGreaterThan(9);
    const today = Array.from(rows).find((row) => row.querySelector('td')?.textContent === '20');
    expect(today).toBeDefined();
    const after = Array.from(rows[rows.length - 1].querySelectorAll('td')).map((cell) => cell.textContent);
    expect(after).toEqual(['–', '0', '–']);
  });

  it('says there is no target line for a release without a start and an end date', async () => {
    const { dialog } = await openScope(undefined, /Release 1\.1/, 'Burndown');
    expect(within(dialog).getByText(/Without a start and an end date there is no target line/)).toBeInTheDocument();
    expect(dialog.querySelector('.scope-chart__ideal')).toBeNull();
    expect(within(dialog).getByText('–', { selector: 'dd' })).toBeInTheDocument();
  });

  it('says so for an empty release', async () => {
    const user = userEvent.setup();
    const { dialog } = await openScope((seed) => ({
      ...seed,
      releases: [...seed.releases, { id: 'r-empty', title: 'Release 3.0', description: '', startDate: null, endDate: null }]
    }), /Release 1\.0/, 'Burndown');
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: /Release 3\.0/ }));
    await user.click(within(await screen.findByRole('dialog', { name: /Release 3\.0/ })).getByRole('tab', { name: 'Burndown' }));
    expect(screen.getByText(/No history yet/)).toBeInTheDocument();
  });

  it('is ahead of the line when more was finished than planned', async () => {
    const { dialog } = await openScope((seed) => ({
      ...seed,
      stories: seed.stories.map((story) => (story.releaseId === 'release-beta' ? { ...story, status: 'done' as const } : story)),
      events: [
        ...seed.events,
        ...seed.stories
          .filter((story) => story.releaseId === 'release-beta' && story.status !== 'done')
          .map((story) => ({ id: `finish-${story.id}`, at: new Date().toISOString(), releaseId: 'release-beta', storyId: story.id, code: story.code, kind: 'done' as const, points: story.points, done: true }))
      ]
    }), /Release 1\.0/, 'Burndown');
    const target = within(dialog).getByText('Against the target line').nextElementSibling;
    expect(target?.textContent).toMatch(/ahead$/);
  });
});
