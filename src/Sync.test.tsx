import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { LocalStorageRepository } from './data/localStorageRepository';
import { seedSnapshot } from './data/seed';
import { todayIso } from './domain/sprints';
import type { Story } from './domain/types';
import { initI18n } from './i18n';
import type { TrackerConnector } from './sync/connector';
import { issueUrl } from './sync/github/format';
import { exampleTracker } from './test/exampleConnector';
import { fakeGithub, REPO } from './test/fakeGithub';

beforeAll(() => {
  initI18n('en');
});

const repoRef = { owner: 'goerks', name: 'GetThingsDone' };

/** A story that is linked to GitHub issue 31. Its own key is G-31. */
const linkedStory = (extra: Partial<Story> = {}): Story => ({
  id: 'story-gh-31',
  code: 'G-31',
  title: 'Linked story',
  description: '',
  epicId: null,
  points: 0,
  status: 'todo',
  sprintId: null,
  releaseId: null,
  rank: 131,
  criteria: [],
  values: {},
  checks: {},
  doneItems: null,
  link: { service: 'github', key: '#31', url: issueUrl(repoRef, 31), state: 'open', base: { title: 'Linked story', description: '', labels: [], criteria: [], done: false } },
  ...extra
});

interface Options {
  /** Switch the feature on and connect the repository with a token. */
  connected?: boolean;
  featureOn?: boolean;
  stories?: Story[];
  /** A second service that can be chosen (it looks like GitLab), as when the connector of another service exists. */
  second?: boolean;
}

async function renderApp(hash: string, { connected = true, featureOn = true, stories = [linkedStory()], second = false }: Options = {}) {
  const fake = fakeGithub([]);
  const repository = new LocalStorageRepository();
  const seed = seedSnapshot(todayIso());
  await repository.replaceAll({
    ...seed,
    stories: [...seed.stories, ...stories],
    settings: {
      ...seed.settings,
      features: { ...seed.settings.features, sync: featureOn },
      sync: { service: 'github', connection: connected ? { repo: REPO } : {}, lastSyncAt: null, write: false, conflict: 'remote', ignored: [], managed: { labels: [], milestones: [] }, auto: false, log: [] }
    }
  });
  if (connected) await fake.tokens.set('good');
  const connectors = second ? { ...fake.sync.connectors, gitlab: exampleTracker([]).connector as unknown as TrackerConnector } : fake.sync.connectors;
  window.location.hash = hash;
  render(<App repository={repository} sync={{ connectors, tokens: fake.sync.tokens }} />);
  await screen.findByRole('heading', { level: 1 });
  return { fake, repository };
}

describe('choosing the service', () => {
  it('AC1.1 shows the services as one choice: GitHub is chosen, the planned ones cannot be chosen', async () => {
    // Given the synchronisation is on and GitHub is connected
    await renderApp('#/settings/sync');
    // When I look at the settings
    const group = await screen.findByRole('group', { name: /^Service/ });
    const radios = within(group).getAllByRole('radio') as HTMLInputElement[];
    // Then there is one choice, GitHub is chosen and Jira and GitLab are planned
    expect(radios.map((radio) => radio.closest('label')?.textContent)).toEqual(['GitHubconnected', 'Jiraplanned', 'GitLabplanned']);
    expect(radios.map((radio) => radio.checked)).toEqual([true, false, false]);
    expect(radios.map((radio) => radio.disabled)).toEqual([false, true, true]);
  });

  it('AC1.4 hides the issue keys when the feature is switched off, keeps the stories, and brings them back when it is on', async () => {
    // Given a linked story and the feature on
    const user = userEvent.setup();
    await renderApp('#/backlog');
    expect(await screen.findByRole('link', { name: 'Open issue #31 on GitHub' })).toBeInTheDocument();
    // When I switch the feature off
    window.location.hash = '#/settings/sync';
    await user.click(await screen.findByRole('switch', { name: /Synchronisation/ }));
    window.location.hash = '#/backlog';
    // Then the story shows its own key again and has no link
    await screen.findByRole('heading', { name: 'Backlog' });
    expect(await screen.findByText('G-31')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Open issue/ })).not.toBeInTheDocument();
    // And when I switch it on again, the issue key is back
    window.location.hash = '#/settings/sync';
    await user.click(await screen.findByRole('switch', { name: /Synchronisation/ }));
    window.location.hash = '#/backlog';
    expect(await screen.findByRole('link', { name: 'Open issue #31 on GitHub' })).toBeInTheDocument();
  });
});

describe('switching the service', () => {
  const linkedStories = [linkedStory(), linkedStory({ id: 'story-gh-32', code: 'G-32', title: 'Second linked story', rank: 132, link: { ...linkedStory().link!, key: '#32', url: issueUrl(repoRef, 32) } })];

  it('AC2.1 asks first and says what happens when stories are linked, and changes nothing yet', async () => {
    // Given GitHub is active with two linked stories, and another service can be chosen
    const user = userEvent.setup();
    const { repository } = await renderApp('#/settings/sync', { stories: linkedStories, second: true });
    // When I choose the other service
    await user.click(await screen.findByRole('radio', { name: /GitLab/ }));
    // Then a dialog says what happens
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Switch to GitLab?');
    expect(dialog).toHaveTextContent('GitHub is active, 2 stories are linked to GitHub issues.');
    expect(dialog).toHaveTextContent('The connection to GitHub and its token are removed.');
    expect(dialog).toHaveTextContent('The 2 stories stay, without issue number and link.');
    expect(dialog).toHaveTextContent('The first sync with GitLab imports all its open issues as new stories');
    expect(dialog).toHaveTextContent('Create on GitLab');
    // And nothing was changed
    expect((await repository.load()).settings.sync.service).toBe('github');
    expect((await repository.load()).stories.filter((story) => story.link)).toHaveLength(2);
  });

  it('AC2.2 disconnects and switches: the stories stay without link and with their own key, the token is deleted', async () => {
    // Given the dialog is open
    const user = userEvent.setup();
    const { fake, repository } = await renderApp('#/settings/sync', { stories: linkedStories, second: true });
    await user.click(await screen.findByRole('radio', { name: /GitLab/ }));
    // When I confirm
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Disconnect and switch to GitLab' }));
    // Then the other service is chosen, the stories are unchanged but unlinked, and the token is gone
    expect(await screen.findByRole('radio', { name: /GitLab/ })).toBeChecked();
    await waitFor(async () => expect((await repository.load()).settings.sync.service).toBe('gitlab'));
    const after = await repository.load();
    expect(after.settings.sync.connection).toEqual({});
    expect(after.settings.sync.write).toBe(false);
    expect(after.stories.filter((story) => story.link)).toEqual([]);
    expect(after.stories.find((story) => story.id === 'story-gh-31')).toMatchObject({ code: 'G-31', title: 'Linked story' });
    expect(await fake.tokens.get()).toBeNull();
  });

  it('AC2.3 changes nothing when I cancel or press Esc', async () => {
    // Given the dialog is open
    const user = userEvent.setup();
    const { fake, repository } = await renderApp('#/settings/sync', { stories: linkedStories, second: true });
    await user.click(await screen.findByRole('radio', { name: /GitLab/ }));
    // When I cancel, and then again press Esc
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /GitLab/ }));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    // Then GitHub stays chosen and connected
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('radio', { name: /GitHub/ })).toBeChecked();
    expect((await repository.load()).settings.sync).toMatchObject({ service: 'github', connection: { repo: REPO } });
    expect(await fake.tokens.get()).toBe('good');
  });

  it('AC2.4 asks briefly when no story is linked, and not at all when nothing is connected', async () => {
    // Given a connected repository and no linked story
    const user = userEvent.setup();
    await renderApp('#/settings/sync', { stories: [], second: true });
    // When I choose the other service
    await user.click(await screen.findByRole('radio', { name: /GitLab/ }));
    // Then the question is short and says nothing about stories
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('GitHub is connected.');
    expect(dialog).toHaveTextContent('The connection to GitHub and its token are removed.');
    expect(dialog).not.toHaveTextContent('stories');
    // And without any connection there is nothing to lose, so no question
    const fresh = userEvent.setup();
    await renderApp('#/settings/sync', { stories: [], connected: false, second: true });
    const radios = await screen.findAllByRole('radio', { name: /GitLab/ });
    await fresh.click(radios[radios.length - 1]);
    await waitFor(() => expect(radios[radios.length - 1]).toBeChecked());
  });
});

describe('the issue key is the ID of a story', () => {
  it('AC12.1 shows the issue number as the ID of a linked story, as a link to the issue, and not its own key', async () => {
    // Given a story linked to issue 31 (its own key is G-31)
    await renderApp('#/backlog');
    // When I look at the backlog
    const link = await screen.findByRole('link', { name: 'Open issue #31 on GitHub' });
    // Then the ID is #31, a link to the issue, and the own key is not shown
    expect(link).toHaveTextContent('#31');
    expect(link).toHaveAttribute('href', 'https://github.com/goerks/GetThingsDone/issues/31');
    expect(screen.getByRole('group', { name: /^Rank \d+, #31: Linked story$/ })).toBeInTheDocument();
    expect(screen.queryByText('G-31')).not.toBeInTheDocument();
  });

  it('AC12.3 keeps the own key: the story dialog shows it small, and it comes back when the connection is removed', async () => {
    // Given a linked story
    const user = userEvent.setup();
    await renderApp('#/backlog');
    // When I open it
    await user.click(await screen.findByRole('button', { name: 'Linked story' }));
    // Then the dialog shows the issue key and the local ID small
    const dialog = await screen.findByRole('dialog', { name: '#31: Linked story' });
    expect(within(dialog).getByText('Local ID G-31')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    // And after the connection is removed, the story has its own key again
    window.location.hash = '#/settings/sync';
    await user.click(await screen.findByRole('button', { name: 'Remove connection' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove connection' }));
    window.location.hash = '#/backlog';
    expect(await screen.findByText('G-31')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Open issue/ })).not.toBeInTheDocument();
  });

  it('AC12.4 shows the own key of a story without a link, and no link', async () => {
    // Given a story that exists only here
    await renderApp('#/backlog', { stories: [linkedStory({ id: 'story-own', code: 'S-90', title: 'Only here', link: undefined })] });
    // Then it shows S-90 and no link
    expect(await screen.findByRole('group', { name: /^Rank \d+, S-90: Only here$/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Open issue/ })).not.toBeInTheDocument();
  });
});
