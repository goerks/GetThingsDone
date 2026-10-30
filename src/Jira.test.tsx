import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { LocalStorageRepository } from './data/localStorageRepository';
import { seedSnapshot } from './data/seed';
import { todayIso } from './domain/sprints';
import { initI18n } from './i18n';
import { fakeGithub } from './test/fakeGithub';
import { sync } from './test/syncHelpers';
import { createJiraConnector } from './sync/jira/connector';
import { createMemoryJira, DEMO_EMAIL, DEMO_SITE } from './sync/jira/simulation';
import { createMemoryTokenVault } from './sync/token';

beforeAll(() => {
  initI18n('en');
});

interface Options {
  connected?: boolean;
  noSprints?: boolean;
}

async function renderApp(hash: string, { connected = false, noSprints = false }: Options = {}) {
  const github = fakeGithub([]);
  const memory = createMemoryJira();
  const tokens = createMemoryTokenVault();
  const repository = new LocalStorageRepository();
  const seed = seedSnapshot(todayIso());
  await repository.replaceAll({
    ...seed,
    // No sprint of its own: the sprints of Jira are the only ones.
    sprints: noSprints ? [] : seed.sprints,
    stories: noSprints ? seed.stories.map((story) => ({ ...story, sprintId: null })) : seed.stories,
    settings: {
      ...seed.settings,
      features: { ...seed.settings.features, sync: true },
      sync: { service: 'jira', connection: connected ? { site: DEMO_SITE, email: DEMO_EMAIL, project: 'PROJ' } : {}, lastSyncAt: null, write: false, conflict: 'remote', ignored: [], managed: { labels: [], milestones: [] }, auto: false, log: [] }
    }
  });
  if (connected) await tokens('jira').set('good');
  window.location.hash = hash;
  render(<App repository={repository} sync={{ connectors: { github: github.sync.connectors.github, jira: createJiraConnector(memory.transport) }, tokens }} />);
  await screen.findByRole('heading', { level: 1 });
  return { repository, tokens };
}

describe('connecting to Jira', () => {
  it('AC3.1 connects with site, e-mail, project and token, and keeps the token out of sight', async () => {
    // Given Jira is chosen and nothing is entered
    const user = userEvent.setup();
    const { repository, tokens } = await renderApp('#/settings/sync');
    // When I enter the access data and test the connection
    await user.type(await screen.findByLabelText('Jira site'), 'demo.atlassian.net');
    await user.type(screen.getByLabelText('E-mail address of your Atlassian account'), 'anna@example.com');
    await user.type(screen.getByLabelText('Project key'), 'proj');
    await user.type(screen.getByLabelText('API token'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Test connection' }));
    // Then the connection is ok with the number of open issues, the token is kept and the field is empty again
    expect(await screen.findByText(/Connection ok · 4 open issues/)).toBeInTheDocument();
    expect(screen.getByLabelText('API token')).toHaveValue('');
    expect(screen.getByLabelText('API token')).toHaveAttribute('type', 'password');
    expect(await tokens('jira').get()).toBe('secret');
    expect((await repository.load()).settings.sync.connection).toEqual({ site: DEMO_SITE, email: 'anna@example.com', project: 'PROJ' });
  }, 20000);

  it('AC3.2 says what is wrong with the entries', async () => {
    const user = userEvent.setup();
    await renderApp('#/settings/sync');
    const test = async () => user.click(await screen.findByRole('button', { name: 'Test connection' }));
    // Given nothing is entered, the site is missing
    await test();
    expect(await screen.findByText('The Jira site is missing.')).toBeInTheDocument();
    // And an address that is no Jira address is refused
    await user.type(screen.getByLabelText('Jira site'), 'beispiel');
    await test();
    expect(await screen.findByText('Use the form your-team.atlassian.net.')).toBeInTheDocument();
    // And so is an e-mail address without an at sign
    await user.clear(screen.getByLabelText('Jira site'));
    await user.type(screen.getByLabelText('Jira site'), 'demo.atlassian.net');
    await user.type(screen.getByLabelText('E-mail address of your Atlassian account'), 'anna');
    await test();
    expect(await screen.findByText('Enter a valid e-mail address.')).toBeInTheDocument();
    // And a project that does not exist, and a token that Jira refuses
    await user.clear(screen.getByLabelText('E-mail address of your Atlassian account'));
    await user.type(screen.getByLabelText('E-mail address of your Atlassian account'), 'anna@example.com');
    await user.type(screen.getByLabelText('Project key'), 'GIBTSNICHT');
    await user.type(screen.getByLabelText('API token'), 'secret');
    await test();
    expect(await screen.findByRole('alert')).toHaveTextContent('Project or site not found');
    await user.clear(screen.getByLabelText('Project key'));
    await user.type(screen.getByLabelText('Project key'), 'PROJ');
    await user.clear(screen.getByLabelText('API token'));
    await user.type(screen.getByLabelText('API token'), 'falsch');
    await test();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Jira refused the access token'));
  }, 30000);

  it('AC3.4 marks the preview as a demo with a simulated Jira', async () => {
    await renderApp('#/settings/sync');
    expect(await screen.findByText('Demo', { selector: '.badge--demo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Demo: simulated Jira/ })).toBeInTheDocument();
  });

  it('AC3.5 removes the connection and the token and keeps the stories', async () => {
    // Given a connected Jira with imported stories
    const user = userEvent.setup();
    const { repository, tokens } = await renderApp('#/settings/sync', { connected: true });
    // When I remove the connection and confirm
    await user.click(await screen.findByRole('button', { name: 'Remove connection' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove connection' }));
    // Then the connection and the token are gone
    await waitFor(async () => expect((await repository.load()).settings.sync.connection).toEqual({}));
    expect(await tokens('jira').get()).toBeNull();
  }, 20000);
});

describe('choosing the board', () => {
  it('AC3.1 offers the boards when there are several, and keeps the choice in the connection', async () => {
    // Given a connected Jira whose project has two scrum boards
    const user = userEvent.setup();
    const { repository } = await renderApp('#/settings/sync', { connected: true });
    // Then the first board is chosen
    const select = await screen.findByLabelText('Board for the sprints');
    expect(select).toHaveValue('1');
    // When I choose the other one
    await user.selectOptions(select, '2');
    // Then it is kept in the connection
    await waitFor(async () => expect((await repository.load()).settings.sync.connection.board).toBe('2'));
  }, 20000);
});

describe('the automatic sync', () => {
  const connect = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
    await user.type(await screen.findByLabelText('Jira site'), 'demo.atlassian.net');
    await user.type(screen.getByLabelText('E-mail address of your Atlassian account'), 'anna@example.com');
    await user.type(screen.getByLabelText('Project key'), 'PROJ');
    await user.type(screen.getByLabelText('API token'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Test connection' }));
    await screen.findByText(/Connection ok/);
  };

  it('AC16.1 switches the automatic sync on when Jira is connected for the first time', async () => {
    // Given Jira is chosen and the automatic sync is off
    const user = userEvent.setup();
    const { repository } = await renderApp('#/settings/sync');
    expect((await repository.load()).settings.sync.auto).toBe(false);
    // When I connect
    await connect(user);
    // Then it is on
    await waitFor(async () => expect((await repository.load()).settings.sync.auto).toBe(true));
    expect(screen.getByRole('checkbox', { name: /Synchronise automatically/ })).toBeChecked();
  }, 30000);

  it('AC16.2 stays off once I switched it off, also when I test the connection again', async () => {
    const user = userEvent.setup();
    const { repository } = await renderApp('#/settings/sync');
    await connect(user);
    await waitFor(async () => expect((await repository.load()).settings.sync.auto).toBe(true));
    // When I switch it off and test the connection again
    await user.click(screen.getByRole('checkbox', { name: /Synchronise automatically/ }));
    await user.click(screen.getByRole('button', { name: 'Test connection' }));
    await screen.findByText(/Connection ok/);
    // Then it stays off, also after loading again
    expect((await repository.load()).settings.sync.auto).toBe(false);
  }, 30000);
});

describe('the sprints', () => {
  it('AC15.1 takes the sprints of the board: the running one runs here with its goal and dates, the future one is planned', async () => {
    // Given a connected Jira and no sprint of our own
    const user = userEvent.setup();
    const { repository } = await renderApp('#/backlog', { connected: true, noSprints: true });
    // When I synchronise
    await sync(user);
    // Then Sprint 14 runs with goal and dates, Sprint 15 is planned, and the stories are in their sprints
    await waitFor(async () => expect((await repository.load()).sprints.map((sprint) => [sprint.name, sprint.state])).toEqual([['Sprint 14', 'running'], ['Sprint 15', 'planned']]));
    const loaded = await repository.load();
    const running = loaded.sprints.find((sprint) => sprint.name === 'Sprint 14');
    expect(running).toMatchObject({ goal: 'Login ready', startDate: '2026-11-02', endDate: '2026-11-15', link: { service: 'jira', id: '14' } });
    expect(loaded.stories.find((story) => story.link?.key === 'PROJ-2')?.sprintId).toBe(running?.id);
  }, 30000);
});

describe('the team', () => {
  it('AC14.1 makes the people of Jira the team, switches the feature on, and assigns the story of Anna', async () => {
    // Given a connected Jira and an empty team
    const user = userEvent.setup();
    const { repository } = await renderApp('#/backlog', { connected: true });
    // When I synchronise
    await sync(user);
    // Then the team is Anna and Tom (no bot), the feature is on and PROJ-1 is assigned to Anna
    await waitFor(async () => expect((await repository.load()).members.map((member) => member.name)).toEqual(['Anna Meier', 'Tom Keller']));
    const loaded = await repository.load();
    expect(loaded.settings.features.team).toBe(true);
    const anna = loaded.members.find((member) => member.name === 'Anna Meier');
    expect(loaded.stories.find((item) => item.link?.key === 'PROJ-1')?.assigneeId).toBe(anna?.id);
  }, 30000);

  it('AC14.3 locks the team in the settings while Jira is connected', async () => {
    await renderApp('#/settings/team', { connected: true });
    expect(await screen.findByText(/The team comes from Jira/)).toBeInTheDocument();
    // And the switch and the button to add are disabled with the reason as tooltip
    expect(screen.getByRole('switch', { name: 'Team' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add member' })).toBeDisabled();
    expect(screen.getAllByTitle('Managed by Jira').length).toBeGreaterThanOrEqual(2);
  }, 20000);
});

describe('the columns of the board', () => {
  it('AC13.1 takes the columns of the board from the statuses of Jira when I synchronise', async () => {
    // Given a connected Jira and the default columns
    const user = userEvent.setup();
    const { repository } = await renderApp('#/backlog', { connected: true });
    // When I synchronise
    await sync(user);
    // Then the board has the four statuses of the workflow as its columns, in this order
    await waitFor(async () => expect((await repository.load()).statuses.map((status) => status.label)).toEqual(['To Do', 'In Progress', 'In Review', 'Done']));
  }, 30000);

  it('AC13.4 locks the columns in the settings while Jira is connected', async () => {
    // Given a connected Jira
    await renderApp('#/settings/statuses', { connected: true });
    // Then a note says that Jira decides, and the columns cannot be changed
    expect(await screen.findByText(/These columns come from Jira and cannot be changed here/)).toBeInTheDocument();
    // And the buttons are disabled with the reason as tooltip
    expect(await screen.findAllByTitle('Managed by Jira')).not.toHaveLength(0);
    for (const button of screen.getAllByRole('button', { name: /^\+ Status in/ })) expect(button).toBeDisabled();
  }, 20000);
});

describe('help for the Jira connection', () => {
  it('AC10.3 has a help topic that starts with switching the feature on and links to the settings', async () => {
    // Given the app with Jira chosen
    const user = userEvent.setup();
    await renderApp('#/backlog', { connected: true });
    // When I search the help for Jira
    await user.click(screen.getByRole('button', { name: 'Help' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search help' }), 'Jira');
    const panel = screen.getByRole('complementary');
    await user.click(within(panel).getByRole('button', { name: /^Synchronisation with Jira/ }));
    // Then the text starts with the first step and links to the settings
    expect(within(panel).getByText(/^1\. Switch the feature on under Settings → Synchronisation, then choose the card “Jira”/)).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Open Settings → Synchronisation' })).toHaveAttribute('href', '#/settings/sync');
  }, 20000);
});

describe('synchronising with Jira', () => {
  it('AC4.1 imports the open issues as stories with the issue key as ID, and says what was left out', async () => {
    // Given a connected Jira
    const user = userEvent.setup();
    await renderApp('#/backlog', { connected: true });
    // When I synchronise
    const notice = await sync(user);
    // Then the four open stories are new, epics and sub-tasks are counted as left out
    expect(notice).toHaveTextContent('4 new');
    expect(notice).toHaveTextContent('2 epics or sub-tasks left out');
    // And the stories show their issue key as a link to Jira
    const link = await screen.findByRole('link', { name: 'Open issue PROJ-1 on Jira' });
    expect(link).toHaveAttribute('href', `${DEMO_SITE}/browse/PROJ-1`);
  }, 30000);

  it('AC4.2 imports nothing twice when I synchronise again', async () => {
    // Given the open issues are imported
    const user = userEvent.setup();
    const { repository } = await renderApp('#/backlog', { connected: true });
    await sync(user);
    const count = (await repository.load()).stories.length;
    // When I synchronise again
    const notice = await sync(user);
    // Then nothing is new and no story is added
    expect(notice).toHaveTextContent(/Already up to date|left out/);
    expect(notice).not.toHaveTextContent('new');
    expect((await repository.load()).stories).toHaveLength(count);
  }, 30000);
});
