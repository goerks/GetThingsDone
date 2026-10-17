import { beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { LocalStorageRepository } from './data/localStorageRepository';
import { seedSnapshot } from './data/seed';
import { assignTo } from './domain/fields';
import { LABELS_FIELD_ID, issueUrl } from './domain/github';
import { todayIso } from './domain/sprints';
import type { ConflictRule, ExternalFields, FieldDefinition, Release, Story } from './domain/types';
import { EPIC_COLOR_KEYS } from './domain/types';
import de from './i18n/de.json';
import en from './i18n/en.json';
import fr from './i18n/fr.json';
import it_ from './i18n/it.json';
import { initI18n } from './i18n';
import { fakeGithub, fakeIssue, REPO } from './test/fakeGithub';

beforeAll(() => {
  initI18n('en');
});

const repoRef = { owner: 'goerks', name: 'GetThingsDone' };

const baseOf = (extra: Partial<ExternalFields> = {}): ExternalFields => ({ title: 'Login', description: '', labels: [], criteria: [], done: false, ...extra });

/** A story that was imported earlier: it has the address of its issue and what the issue looked like then. */
const linked = (number: number, extra: Partial<Story> = {}, base: Partial<ExternalFields> = {}): Story => ({
  id: `story-gh-${number}`,
  code: `G-${number}`,
  title: 'Login',
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
  github: { url: issueUrl(repoRef, number), state: 'open', base: baseOf(base) },
  ...extra
});

const labelsField: FieldDefinition = {
  id: LABELS_FIELD_ID,
  builtinKey: null,
  kind: 'custom',
  dataType: 'multi_select',
  label: 'Labels',
  options: [{ id: 'gh-label-bug', label: 'bug', colorKey: EPIC_COLOR_KEYS[0] }],
  defaultValue: null
};

interface Options {
  stories?: Story[];
  issues?: Parameters<typeof fakeGithub>[0];
  write?: boolean;
  conflict?: ConflictRule;
  featureOn?: boolean;
  releases?: Release[];
}

async function renderApp(hash: string, { stories = [], issues = [], write = true, conflict = 'remote', featureOn = true, releases = [] }: Options = {}) {
  const fake = fakeGithub(issues);
  const repository = new LocalStorageRepository();
  const seed = seedSnapshot(todayIso());
  await repository.replaceAll({
    ...seed,
    fields: [...seed.fields, labelsField],
    assignments: assignTo(seed.assignments, LABELS_FIELD_ID, ['story']),
    stories: [...seed.stories, ...stories],
    releases: [...seed.releases, ...releases],
    settings: {
      ...seed.settings,
      features: { ...seed.settings.features, github: featureOn },
      github: { repo: REPO, lastSyncAt: null, write, conflict, ignored: [] }
    }
  });
  await fake.github.tokens.set('good');
  window.location.hash = hash;
  render(<App repository={repository} github={fake.github} />);
  await screen.findByRole('heading', { level: 1 });
  return { fake, repository };
}

const sync = async (user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> => {
  await user.click(await screen.findByRole('button', { name: 'Synchronise' }));
  return screen.findByRole('dialog');
};

describe('the options of the connection', () => {
  it('AC1.8 has writing off by default and says which right the token needs', async () => {
    // Given a connected repository with the default settings
    const { repository } = await renderApp('#/settings/github', { write: false });
    // When I open the connections
    const box = await screen.findByRole('checkbox', { name: 'Also write to GitHub' });
    // Then writing is off and the hint names the right
    expect(box).not.toBeChecked();
    expect(screen.getByText(/Issues: read and write/, { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'GitHub wins (default)' })).toBeChecked();
    // And switching it on is kept
    await userEvent.setup().click(box);
    await waitFor(async () => expect((await repository.load()).settings.github.write).toBe(true));
  });

  it('AC11.1 lists GitHub as connected and GitLab, Jira and Trello as planned', async () => {
    // Given a connected repository
    await renderApp('#/settings/github');
    // When I look at the services
    await screen.findByRole('heading', { name: 'Services' });
    const list = document.querySelector('.github-services') as HTMLElement;
    // Then GitHub is connected and the others are planned
    const entries = within(list).getAllByRole('listitem');
    expect(entries.map((item) => item.textContent)).toEqual(['GitHubconnected', 'GitLabplanned', 'Jiraplanned', 'Trelloplanned']);
    expect(within(list).queryByRole('button')).not.toBeInTheDocument();
  });

  it('AC11.2 removes the connection after asking, and the stories stay without link and marker', async () => {
    // Given a connection and a linked story with a change that is not on GitHub yet
    const user = userEvent.setup();
    const { fake, repository } = await renderApp('#/settings/github', { stories: [linked(31, { title: 'Anmeldung' })], issues: [fakeIssue(31, { title: 'Login' })] });
    // When I remove the connection and confirm
    await user.click(await screen.findByRole('button', { name: 'Remove connection' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent(/imported stories stay/);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove connection' }));
    // Then token and repository are gone, the story is still there and no longer linked
    await waitFor(async () => expect((await repository.load()).settings.github.repo).toBe(''));
    expect(await fake.github.tokens.get()).toBeNull();
    const story = (await repository.load()).stories.find((item) => item.id === 'story-gh-31');
    expect(story?.title).toBe('Anmeldung');
    expect(story?.github).toBeUndefined();
    expect(fake.state.writes).toEqual([]);
  });
});

describe('publishing', () => {
  it('AC7.4 publishes nothing on its own, however long I wait', async () => {
    // Given writing on and a story changed here
    const { fake } = await renderApp('#/backlog', { stories: [linked(31, { title: 'Login-Seite' })], issues: [fakeIssue(31, { title: 'Login' })] });
    // When I only look at the backlog
    await screen.findByText('Login-Seite');
    // Then nothing was sent to GitHub
    expect(fake.state.writes).toEqual([]);
    expect(fake.state.calls).toBe(0);
  });

  it('AC7.1 publishes the change with "Synchronise" and says what was published', async () => {
    // Given a changed story
    const user = userEvent.setup();
    const { fake } = await renderApp('#/backlog', {
      stories: [linked(31, { title: 'Login-Seite', values: { [LABELS_FIELD_ID]: ['gh-label-bug'] } })],
      issues: [fakeIssue(31, { title: 'Login' })]
    });
    // When I synchronise
    const dialog = await sync(user);
    // Then GitHub has the change and the dialog names title and label
    expect(fake.state.issues[0]).toMatchObject({ title: 'Login-Seite', labels: ['bug'] });
    expect(within(dialog).getByText('2 changes published to GitHub')).toBeInTheDocument();
    expect(within(dialog).getByText(/Title, Labels/)).toBeInTheDocument();
  });

  it('AC7.5 publishes nothing when writing is off, says so, and keeps the story marked', async () => {
    // Given writing off and a changed story
    const user = userEvent.setup();
    const { fake } = await renderApp('#/backlog', { write: false, stories: [linked(31, { title: 'Login-Seite' })], issues: [fakeIssue(31, { title: 'Login' })] });
    // When I synchronise
    const dialog = await sync(user);
    // Then the dialog says that writing is off, and the story is still marked
    expect(within(dialog).getByText('Writing is off: 1 change was not published to GitHub and stays marked.')).toBeInTheDocument();
    expect(fake.state.writes).toEqual([]);
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.getByText('not on GitHub')).toBeInTheDocument();
  });

  it('AC7.6 says what the token needs and keeps the local change when GitHub refuses to write', async () => {
    // Given a token that may only read
    const user = userEvent.setup();
    const { fake } = await renderApp('#/backlog', { stories: [linked(31, { title: 'Login-Seite' })], issues: [fakeIssue(31, { title: 'Login' })] });
    fake.state.canWrite = false;
    // When I synchronise
    const dialog = await sync(user);
    // Then the message names the right, and the story keeps its title and its marker
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Issues: read and write');
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.getByText('Login-Seite')).toBeInTheDocument();
    expect(screen.getByText('not on GitHub')).toBeInTheDocument();
  });
});

describe('conflicts', () => {
  // A new set for every test: the fake changes its issues when something is published.
  const both = () => ({ stories: [linked(31, { title: 'Anmeldung' })], issues: [fakeIssue(31, { title: 'Login-Seite' })] });

  it('AC3.3 lets GitHub win by default and names the overwritten local title', async () => {
    const user = userEvent.setup();
    await renderApp('#/backlog', both());
    const dialog = await sync(user);
    expect(within(dialog).getByText('Local change overwritten: Title “Anmeldung”')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.getByText('Login-Seite')).toBeInTheDocument();
  });

  it('AC8.1 lets the local change win and names the overwritten GitHub title', async () => {
    const user = userEvent.setup();
    const { fake } = await renderApp('#/backlog', { ...both(), conflict: 'local' });
    const dialog = await sync(user);
    expect(within(dialog).getByText('GitHub change overwritten: Title “Login-Seite”')).toBeInTheDocument();
    expect(fake.state.issues[0].title).toBe('Anmeldung');
  });

  it('AC8.2 shows both versions and changes nothing until I choose', async () => {
    // Given the rule "I decide"
    const user = userEvent.setup();
    const { fake } = await renderApp('#/backlog', { ...both(), conflict: 'ask' });
    // When I synchronise
    const dialog = await sync(user);
    // Then both versions are shown, and nothing has changed yet
    expect(within(dialog).getByRole('heading', { name: 'Both sides changed the same thing' })).toBeInTheDocument();
    expect(within(dialog).getByText('Anmeldung')).toBeInTheDocument();
    expect(within(dialog).getAllByText('Login-Seite').length).toBeGreaterThan(0);
    expect(fake.state.issues[0].title).toBe('Login-Seite');
    // And when I keep the local version and apply, both sides have it
    await user.click(within(dialog).getByRole('radio', { name: 'Keep the local version' }));
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(fake.state.issues[0].title).toBe('Anmeldung'));
  });

  it('AC8.3 keeps the conflict open when I cancel the dialog with Esc', async () => {
    const user = userEvent.setup();
    const { fake } = await renderApp('#/backlog', { ...both(), conflict: 'ask' });
    await sync(user);
    await user.keyboard('{Escape}');
    // The conflict is still there, nothing changed, and the next sync asks again
    expect(await screen.findByText('You still decide 1 field; until then it stays as it is.')).toBeInTheDocument();
    expect(fake.state.issues[0].title).toBe('Login-Seite');
    expect(screen.getByText('Anmeldung')).toBeInTheDocument();
  });

  it('AC8.4 is no conflict when different fields changed', async () => {
    const user = userEvent.setup();
    const { fake } = await renderApp('#/backlog', { stories: [linked(31, { title: 'Anmeldung' })], issues: [fakeIssue(31, { title: 'Login', body: 'New text' })], conflict: 'ask' });
    const dialog = await sync(user);
    expect(within(dialog).queryByText(/Both sides changed/)).not.toBeInTheDocument();
    expect(fake.state.issues[0]).toMatchObject({ title: 'Anmeldung', body: 'New text' });
  });
});

describe('what is not on GitHub yet', () => {
  it('AC9.1 and AC9.2 marks the changed stories, counts the changes and clears them after the sync', async () => {
    // Given three linked stories with a changed title each
    const user = userEvent.setup();
    const stories = [31, 32, 33].map((n) => linked(n, { title: `Changed ${n}` }, { title: `Old ${n}` }));
    await renderApp('#/backlog', { stories, issues: [31, 32, 33].map((n) => fakeIssue(n, { title: `Old ${n}` })) });
    // Then they are marked and counted
    expect(await screen.findByText('3 changes not on GitHub yet')).toBeInTheDocument();
    expect(screen.getAllByText('not on GitHub')).toHaveLength(3);
    // And when I synchronise, the marks and the count are gone
    await user.click(within(await sync(user)).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByText('not on GitHub')).not.toBeInTheDocument());
    expect(screen.queryByText(/not on GitHub yet/)).not.toBeInTheDocument();
  });

  it('AC9.2 keeps the marks and the count when the sync fails', async () => {
    const user = userEvent.setup();
    const { fake } = await renderApp('#/backlog', { stories: [linked(31, { title: 'Changed' }, { title: 'Old' })], issues: [fakeIssue(31, { title: 'Old' })] });
    fake.state.offline = true;
    const dialog = await sync(user);
    expect(within(dialog).getByRole('alert')).toHaveTextContent('No connection to GitHub');
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.getByText('1 change not on GitHub yet')).toBeInTheDocument();
  });
});

describe('creating an issue from a story', () => {
  const own: Story = { ...linked(9), id: 'story-own', code: 'S-90', title: 'Export as CSV', github: undefined };

  const openMenu = (code: string): void => {
    fireEvent.contextMenu(screen.getByText(code).closest('.backlog__row') as HTMLElement);
  };

  it('AC10.1 creates the issue from the menu and links the story to it', async () => {
    // Given writing on and a story of my own
    const user = userEvent.setup();
    const { fake, repository } = await renderApp('#/backlog', { stories: [own] });
    // When I choose "Create on GitHub" in its menu
    openMenu('S-90');
    await user.click(await screen.findByRole('menuitem', { name: 'Create on GitHub' }));
    // Then the issue exists on GitHub and the story shows its number
    await waitFor(() => expect(fake.state.issues).toHaveLength(1));
    expect(fake.state.issues[0]).toMatchObject({ title: 'Export as CSV', state: 'open' });
    expect(await screen.findByRole('link', { name: 'Open issue #1 on GitHub' })).toBeInTheDocument();
    expect((await repository.load()).stories.find((story) => story.id === 'story-own')?.github?.url).toBe(`https://github.com/${REPO}/issues/1`);
  });

  it('AC10.2 creates nothing on a sync, and offers the item only for a story without link while writing is on', async () => {
    const user = userEvent.setup();
    const { fake } = await renderApp('#/backlog', { stories: [own, linked(31)], issues: [fakeIssue(31, { title: 'Login' })] });
    await user.click(within(await sync(user)).getByRole('button', { name: 'Close' }));
    expect(fake.state.issues).toHaveLength(1);
    // A linked story has no such item
    openMenu('G-31');
    await screen.findByRole('menu');
    expect(screen.queryByRole('menuitem', { name: 'Create on GitHub' })).not.toBeInTheDocument();
  });

  it('AC10.2 does not offer the item while writing is off', async () => {
    await renderApp('#/backlog', { stories: [own], write: false });
    openMenu('S-90');
    await screen.findByRole('menu');
    expect(screen.queryByRole('menuitem', { name: 'Create on GitHub' })).not.toBeInTheDocument();
  });

  it('AC10.3 does not offer it again once the issue exists', async () => {
    const user = userEvent.setup();
    await renderApp('#/backlog', { stories: [own] });
    openMenu('S-90');
    await user.click(await screen.findByRole('menuitem', { name: 'Create on GitHub' }));
    await screen.findByRole('link', { name: 'Open issue #1 on GitHub' });
    openMenu('S-90');
    await screen.findByRole('menu');
    expect(screen.queryByRole('menuitem', { name: 'Create on GitHub' })).not.toBeInTheDocument();
  });
});

describe('the sync icon', () => {
  it('AC14.1 shows an icon button instead of the text on backlog, board and story map', async () => {
    for (const hash of ['#/backlog', '#/board', '#/map']) {
      // Given the page with the feature on
      await renderApp(hash);
      // Then there is a button named "Synchronise" that has an icon and no text, and a tooltip
      const button = await screen.findByRole('button', { name: 'Synchronise' });
      expect(button).toHaveTextContent('');
      expect(button.querySelector('svg')).not.toBeNull();
      expect(button).toHaveAttribute('title', expect.stringContaining('Synchronise'));
      cleanup();
    }
  });

  it('AC14.2 synchronises from the board with the same result dialog and gives the focus back to the icon', async () => {
    const user = userEvent.setup();
    await renderApp('#/board', { issues: [fakeIssue(31, { title: 'Login' })] });
    const dialog = await sync(user);
    expect(dialog).toHaveTextContent('newly imported');
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Synchronise' })).toHaveFocus());
  });

  it('AC14.3 has no icon on epics, releases and settings, and none while the feature is off', async () => {
    for (const hash of ['#/epics', '#/releases', '#/settings/fields']) {
      await renderApp(hash);
      await screen.findByRole('heading', { level: 1 });
      expect(screen.queryByRole('button', { name: 'Synchronise' })).not.toBeInTheDocument();
      cleanup();
    }
    await renderApp('#/backlog', { featureOn: false });
    expect(screen.queryByRole('button', { name: 'Synchronise' })).not.toBeInTheDocument();
  });

  it('AC14.4 turns while a sync runs and starts nothing new on a second click', async () => {
    const user = userEvent.setup();
    const { fake } = await renderApp('#/backlog');
    let calls = 0;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    fake.github.source.openIssues = async () => {
      calls += 1;
      await gate;
      return [];
    };
    const button = await screen.findByRole('button', { name: 'Synchronise' });
    await user.click(button);
    await user.click(button);
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.querySelector('.github-sync__icon--spin')).not.toBeNull();
    expect(calls).toBe(1);
    release();
    await screen.findByRole('dialog');
    expect(button).not.toHaveAttribute('aria-busy');
  });

  it('AC14.5 shows the number of changes that are not on GitHub yet at the icon', async () => {
    const stories = [31, 32, 33].map((n) => linked(n, { title: `Changed ${n}` }, { title: `Old ${n}` }));
    await renderApp('#/backlog', { stories, issues: [31, 32, 33].map((n) => fakeIssue(n, { title: `Old ${n}` })) });
    const button = await screen.findByRole('button', { name: 'Synchronise' });
    expect(button.querySelector('.github-sync__count')).toHaveTextContent('3');
    expect(button).toHaveAttribute('title', expect.stringContaining('3 changes not on GitHub yet'));
  });

  it('AC14.6 works with the keyboard', async () => {
    const user = userEvent.setup();
    await renderApp('#/backlog');
    const button = await screen.findByRole('button', { name: 'Synchronise' });
    button.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});

describe('creating milestones, epic labels and status labels', () => {
  it('AC12.5 creates the milestone of a release from its dialog, once, and only while writing is on', async () => {
    // Given a release without a milestone and writing on
    const user = userEvent.setup();
    const herbst: Release = { id: 'release-herbst', title: 'Herbst', description: 'Autumn', startDate: null, endDate: '2026-11-30' };
    const { fake } = await renderApp('#/releases', { releases: [herbst] });
    // When I choose "Create on GitHub" in its dialog
    await user.click(await screen.findByRole('button', { name: /Herbst/ }));
    await user.click(await within(await screen.findByRole('dialog')).findByRole('button', { name: 'Create on GitHub' }));
    // Then GitHub has the milestone with description and due date
    await waitFor(() => expect(fake.state.milestones).toHaveLength(1));
    expect(fake.state.milestones[0]).toMatchObject({ title: 'Herbst', description: 'Autumn', dueOn: '2026-11-30' });
    // And a second try says that it exists and creates nothing
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Create on GitHub' }));
    expect(await screen.findByText('GitHub already has a milestone with this title.')).toBeInTheDocument();
    expect(fake.state.milestones).toHaveLength(1);
  });

  it('AC12.5 offers nothing while writing is off', async () => {
    const user = userEvent.setup();
    await renderApp('#/releases', { write: false, releases: [{ id: 'release-herbst', title: 'Herbst', description: '', startDate: null, endDate: null }] });
    await user.click(await screen.findByRole('button', { name: /Herbst/ }));
    expect(within(await screen.findByRole('dialog')).queryByRole('button', { name: 'Create on GitHub' })).not.toBeInTheDocument();
  });

  it('AC13.5 creates the label of an epic from its dialog and does not create it twice', async () => {
    const user = userEvent.setup();
    const { fake } = await renderApp('#/epics');
    await user.click(await screen.findByRole('button', { name: /Local storage/ }));
    await user.click(await within(await screen.findByRole('dialog')).findByRole('button', { name: 'Create on GitHub' }));
    await waitFor(() => expect(fake.state.knownLabels).toContain('epic: Local storage'));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Create on GitHub' }));
    expect(await screen.findByText('GitHub already has this label.')).toBeInTheDocument();
    expect(fake.state.knownLabels.filter((label) => label === 'epic: Local storage')).toHaveLength(1);
  });

  it('AC15.6 creates the missing status labels from the connection settings, once, and only while writing is on', async () => {
    const user = userEvent.setup();
    const { fake } = await renderApp('#/settings/github');
    await user.click(await screen.findByRole('button', { name: 'Create status labels on GitHub' }));
    expect(await screen.findByText('2 labels created: status: in progress, status: review')).toBeInTheDocument();
    expect(fake.state.knownLabels).toEqual(expect.arrayContaining(['status: in progress', 'status: review']));
    await user.click(screen.getByRole('button', { name: 'Create status labels on GitHub' }));
    expect(await screen.findByText('All status labels exist already.')).toBeInTheDocument();
    expect(fake.state.knownLabels.filter((label) => label.startsWith('status:'))).toHaveLength(2);
    cleanup();
    await renderApp('#/settings/github', { write: false });
    await screen.findByRole('checkbox', { name: 'Also write to GitHub' });
    expect(screen.queryByRole('button', { name: 'Create status labels on GitHub' })).not.toBeInTheDocument();
  });

  it('AC12.1 and AC13.1 name the release and the epic that a sync made', async () => {
    const user = userEvent.setup();
    const { fake } = await renderApp('#/backlog', { issues: [fakeIssue(31, { title: 'Login', labels: ['epic: Login & Konto'], milestone: 'v1.0' })] });
    fake.state.milestones = [{ number: 1, title: 'v1.0', description: 'First version', dueOn: '2026-12-31', state: 'open' }];
    const dialog = await sync(user);
    expect(within(dialog).getByText('Release new: v1.0')).toBeInTheDocument();
    expect(within(dialog).getByText('Epic new: Login & Konto')).toBeInTheDocument();
  });
});

describe('texts of the story map sync', () => {
  const KEYS = [
    'github.create.releaseDone',
    'github.create.epicDone',
    'github.create.itemFailed',
    'github.settings.statusLabels.button',
    'github.settings.statusLabels.help',
    'github.sync.releaseCreated',
    'github.sync.epicCreated',
    'github.sync.missingMilestones',
    'github.sync.multipleEpics',
    'github.field.release',
    'github.field.epic',
    'github.field.status',
    'github.change.release',
    'github.change.epic',
    'github.change.status'
  ];
  const lookup = (tree: unknown, path: string): unknown => path.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], tree);
  const languages: Array<[string, unknown]> = [['de', de], ['en', en], ['fr', fr], ['it', it_]];

  const check = (): void => {
    for (const [language, tree] of languages) for (const key of KEYS) expect(typeof lookup(tree, key), `${language} ${key}`).toBe('string');
  };

  it('AC12.7 has the texts of the new features in German, English, French and Italian', check);
  it('AC13.7 has the texts of the new features in German, English, French and Italian', check);
  it('AC15.9 has the texts of the new features in German, English, French and Italian', check);
});
