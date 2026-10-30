import { beforeAll, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { LocalStorageRepository } from './data/localStorageRepository';
import { seedSnapshot } from './data/seed';
import { todayIso } from './domain/sprints';
import type { Story } from './domain/types';
import { initI18n } from './i18n';
import type { TrackerConnector } from './sync/connector';
import { issueUrl } from './sync/github/format';
import { createJiraConnector } from './sync/jira/connector';
import { createMemoryJira } from './sync/jira/simulation';
import { exampleTracker } from './test/exampleConnector';
import { fakeGithub, fakeIssue, REPO } from './test/fakeGithub';
import { sync } from './test/syncHelpers';

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
  write?: boolean;
}

async function renderApp(hash: string, { connected = true, featureOn = true, stories = [linkedStory()], second = false, write = false }: Options = {}) {
  const fake = fakeGithub([]);
  const repository = new LocalStorageRepository();
  const seed = seedSnapshot(todayIso());
  await repository.replaceAll({
    ...seed,
    stories: [...seed.stories, ...stories],
    settings: {
      ...seed.settings,
      features: { ...seed.settings.features, sync: featureOn },
      sync: { service: 'github', connection: connected ? { repo: REPO } : {}, lastSyncAt: null, write, conflict: 'remote', ignored: [], managed: { labels: [], milestones: [] }, auto: false, log: [] }
    }
  });
  if (connected) await fake.tokens.set('good');
  const withJira = { ...fake.sync.connectors, jira: createJiraConnector(createMemoryJira().transport) };
  const connectors = second ? { ...withJira, gitlab: exampleTracker([]).connector as unknown as TrackerConnector } : withJira;
  window.location.hash = hash;
  render(<App repository={repository} sync={{ connectors, tokens: fake.sync.tokens }} />);
  await screen.findByRole('heading', { level: 1 });
  return { fake, repository };
}

describe('choosing the service', () => {
  it('AC1.1 shows the services as one choice: GitHub is chosen, Jira can be chosen, GitLab is planned', async () => {
    // Given the synchronisation is on and GitHub is connected
    await renderApp('#/settings/sync');
    // When I look at the settings
    const group = await screen.findByRole('group', { name: /^Service/ });
    const radios = within(group).getAllByRole('radio') as HTMLInputElement[];
    // Then there is one choice, GitHub is chosen, Jira is available and GitLab is planned
    expect(radios.map((radio) => radio.closest('label')?.textContent)).toEqual(['GitHubconnected', 'Jiraavailable', 'GitLabplanned']);
    expect(radios.map((radio) => radio.checked)).toEqual([true, false, false]);
    expect(radios.map((radio) => radio.disabled)).toEqual([false, false, true]);
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
  }, 20000);
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
  }, 20000);

  it('AC2.2 disconnects and switches: the stories stay without link and with their own key, the token is deleted', async () => {
    // Given the dialog is open
    const user = userEvent.setup();
    const { fake, repository } = await renderApp('#/settings/sync', { stories: linkedStories, second: true });
    await user.click(await screen.findByRole('radio', { name: /GitLab/ }));
    // When I confirm
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Disconnect and switch to GitLab' }));
    // Then the other service is chosen, the stories are unchanged but unlinked, and the token is gone
    // (the rule "GitLab wins" is a radio too, so the choice of the service is looked up in its group)
    await waitFor(() => expect(within(screen.getByRole('group', { name: /^Service/ })).getByRole('radio', { name: /GitLab/ })).toBeChecked());
    await waitFor(async () => expect((await repository.load()).settings.sync.service).toBe('gitlab'));
    const after = await repository.load();
    expect(after.settings.sync.connection).toEqual({});
    expect(after.settings.sync.write).toBe(false);
    expect(after.stories.filter((story) => story.link)).toEqual([]);
    expect(after.stories.find((story) => story.id === 'story-gh-31')).toMatchObject({ code: 'G-31', title: 'Linked story' });
    expect(await fake.tokens.get()).toBeNull();
  }, 20000);

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
    expect(within(screen.getByRole('group', { name: /^Service/ })).getByRole('radio', { name: /GitHub/ })).toBeChecked();
    expect((await repository.load()).settings.sync).toMatchObject({ service: 'github', connection: { repo: REPO } });
    expect(await fake.tokens.get()).toBe('good');
  }, 20000);

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
  }, 20000);
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
  }, 20000);

  it('AC12.4 shows the own key of a story without a link, and no link', async () => {
    // Given a story that exists only here
    await renderApp('#/backlog', { stories: [linkedStory({ id: 'story-own', code: 'S-90', title: 'Only here', link: undefined })] });
    // Then it shows S-90 and no link
    expect(await screen.findByRole('group', { name: /^Rank \d+, S-90: Only here$/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Open issue/ })).not.toBeInTheDocument();
  });

  it('AC12.5 gives a story that was published the key of its new issue as ID, and keeps its own key small', async () => {
    // Given writing is on and a story that exists only here
    const user = userEvent.setup();
    const { repository } = await renderApp('#/backlog', { stories: [linkedStory({ id: 'story-own', code: 'S-90', title: 'Only here', link: undefined })], write: true });
    // When I create it on GitHub from its menu
    fireEvent.contextMenu(screen.getByText('S-90').closest('.backlog__row') as HTMLElement);
    await user.click(await screen.findByRole('menuitem', { name: 'Create on GitHub' }));
    // Then it shows the key of the new issue as its ID and no longer S-90
    const link = await screen.findByRole('link', { name: 'Open issue #1 on GitHub' });
    expect(link).toHaveTextContent('#1');
    expect(screen.queryByText('S-90')).not.toBeInTheDocument();
    // And the own key is kept
    expect((await repository.load()).stories.find((story) => story.id === 'story-own')).toMatchObject({ code: 'S-90', link: { key: '#1' } });
  });
});

describe('the sync of before the generalisation', () => {
  it('AC1.3 keeps working with the connection, the token and the links of the version before', async () => {
    // Given the stored data of the version before: the feature "github", the settings "github" and a story with its `github` link
    const user = userEvent.setup();
    const fake = fakeGithub([fakeIssue(31, { title: 'Login-Seite' })]);
    const seed = seedSnapshot(todayIso());
    const { link, ...story } = linkedStory();
    window.localStorage.setItem(
      'getitdone.snapshot.v1',
      JSON.stringify({
        ...seed,
        stories: [...seed.stories, { ...story, github: { url: link?.url, state: 'open', base: link?.base } }],
        settings: { mapRows: 'sprints', features: { releases: true, team: false, github: '1' }, github: { repo: REPO, write: false, conflict: 'remote', auto: false }, definitions: seed.settings.definitions }
      })
    );
    const repository = new LocalStorageRepository();
    await fake.tokens.set('good');
    window.location.hash = '#/backlog';
    render(<App repository={repository} sync={fake.sync} />);
    await screen.findByRole('heading', { level: 1 });
    // When I open the backlog and synchronise
    expect(await screen.findByRole('link', { name: 'Open issue #31 on GitHub' })).toHaveTextContent('#31');
    await sync(user);
    // Then the change of the issue is taken, and the settings are those of the synchronisation
    expect(await screen.findByRole('button', { name: 'Login-Seite' })).toBeInTheDocument();
    await waitFor(async () => expect((await repository.load()).settings.sync.connection.repo).toBe(REPO));
    expect((await repository.load()).settings.features.sync).toBe(true);
  });
});
