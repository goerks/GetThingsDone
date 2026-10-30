import { beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { LocalStorageRepository } from './data/localStorageRepository';
import { seedSnapshot } from './data/seed';
import { LABELS_FIELD_ID } from './domain/sync';
import { todayIso } from './domain/sprints';
import { initI18n } from './i18n';
import { fakeGithub, fakeIssue, REPO } from './test/fakeGithub';
import { logText, sync } from './test/syncHelpers';

beforeAll(() => {
  initI18n('en');
});

type Fake = ReturnType<typeof fakeGithub>;

interface Options {
  /** Switch the feature on and connect the repository with a token, as after the settings were filled in. */
  connected?: boolean;
  issues?: Parameters<typeof fakeGithub>[0];
}

async function renderApp(hash: string, { connected = true, issues = [] }: Options = {}): Promise<{ fake: Fake; repository: LocalStorageRepository }> {
  const fake = fakeGithub(issues);
  const repository = new LocalStorageRepository();
  const seed = seedSnapshot(todayIso());
  await repository.replaceAll({
    ...seed,
    settings: { ...seed.settings, features: { ...seed.settings.features, sync: connected }, sync: { ...seed.settings.sync, connection: connected ? { repo: REPO } : {} } }
  });
  if (connected) await fake.tokens.set('good');
  window.location.hash = hash;
  render(<App repository={repository} sync={fake.sync} />);
  await screen.findByRole('heading', { level: 1 });
  return { fake, repository };
}

describe('switching the feature on', () => {
  it('AC1.1 is off by default: no section, no button in the backlog', async () => {
    // Given a fresh app that was not set up
    const user = userEvent.setup();
    await renderApp('#/settings/sync', { connected: false });
    // When I look at the features and the backlog
    expect(screen.getByRole('switch', { name: /Synchronisation/ })).not.toBeChecked();
    // Then the connection is not shown and there is no button "Synchronise"
    expect(screen.queryByLabelText('Repository (owner/name)')).not.toBeInTheDocument();
    await user.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Backlog' }));
    await screen.findByRole('heading', { name: 'Backlog' });
    expect(screen.queryByRole('button', { name: 'Synchronise' })).not.toBeInTheDocument();
  });

  it('AC1.2 shows the section "GitHub" with repository and token as soon as the feature is on', async () => {
    // Given the feature is off
    const user = userEvent.setup();
    await renderApp('#/settings/sync', { connected: false });
    // When I switch it on and open the section
    await user.click(screen.getByRole('switch', { name: /Synchronisation/ }));
    // Then I can enter the repository and the token
    expect(await screen.findByLabelText('Repository (owner/name)')).toBeInTheDocument();
    expect(screen.getByLabelText('Access token')).toHaveAttribute('type', 'password');
  });

  it('AC1.5 hides the section, the button and the issue numbers when switched off, and brings them back with the connection', async () => {
    // Given an imported story and a connected repository
    const user = userEvent.setup();
    const { repository } = await renderApp('#/backlog', { issues: [fakeIssue(31, { title: 'Login' })] });
    await sync(user);
    expect(await screen.findByRole('link', { name: 'Open issue #31 on GitHub' })).toBeInTheDocument();
    // When I switch the feature off
    window.location.hash = '#/settings/sync';
    await user.click(await screen.findByRole('switch', { name: /Synchronisation/ }));
    // Then the connection is gone, and so are the button and the number in the backlog
    expect(screen.queryByLabelText('Repository (owner/name)')).not.toBeInTheDocument();
    window.location.hash = '#/backlog';
    await screen.findByRole('heading', { name: 'Backlog' });
    expect(screen.queryByRole('button', { name: 'Synchronise' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Open issue #31/ })).not.toBeInTheDocument();
    expect(screen.getByText('Login')).toBeInTheDocument();
    // And when I switch it on again, everything is back
    window.location.hash = '#/settings/sync';
    await user.click(await screen.findByRole('switch', { name: /Synchronisation/ }));
    window.location.hash = '#/backlog';
    expect(await screen.findByRole('link', { name: 'Open issue #31 on GitHub' })).toBeInTheDocument();
    expect((await repository.load()).settings.sync.connection.repo).toBe(REPO);
  });
});

describe('connecting the repository', () => {
  it('AC1.3 tests the connection, never shows the token again and keeps the repository', async () => {
    // Given the section GitHub without a connection
    const user = userEvent.setup();
    const { fake, repository } = await renderApp('#/settings/sync', { connected: false });
    // (the feature is off, so the settings show the features; switch it on first)
    await user.click(await screen.findByRole('switch', { name: /Synchronisation/ }));
    fake.state.issues = [fakeIssue(1), fakeIssue(2), fakeIssue(3)];
    // When I enter repository and token and test the connection
    await user.type(await screen.findByLabelText('Repository (owner/name)'), REPO);
    await user.type(screen.getByLabelText('Access token'), 'good');
    await user.click(screen.getByRole('button', { name: 'Test connection' }));
    // Then it says "Connection ok" with the number of open issues
    expect(await screen.findByText('✓ Connection ok · 3 open issues')).toBeInTheDocument();
    // And the token is not readable any more
    const token = screen.getByLabelText('Access token') as HTMLInputElement;
    expect(token.value).toBe('');
    expect(token).toHaveAttribute('placeholder', expect.stringContaining('Token saved'));
    expect(document.body.innerHTML).not.toContain('good"');
    expect(await fake.tokens.get()).toBe('good');
    await waitFor(async () => expect((await repository.load()).settings.sync.connection.repo).toBe(REPO));
    expect(JSON.stringify(await repository.load())).not.toContain('"good"');
  });

  it.each([
    ['', 'The repository is missing.'],
    ['abc', 'Use the form owner/name.']
  ])('AC1.4 says what is wrong with the repository "%s"', async (text, message) => {
    // Given the section GitHub
    const user = userEvent.setup();
    await renderApp('#/settings/sync', { connected: true });
    const field = await screen.findByLabelText('Repository (owner/name)');
    // When I enter the text and test the connection
    await user.clear(field);
    if (text) await user.type(field, text);
    await user.type(screen.getByLabelText('Access token'), 'good');
    await user.click(screen.getByRole('button', { name: 'Test connection' }));
    // Then I get the hint
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  it('AC1.4 says "Repository not found" for a repository that does not exist', async () => {
    // Given the section GitHub
    const user = userEvent.setup();
    await renderApp('#/settings/sync', { connected: true });
    const field = await screen.findByLabelText('Repository (owner/name)');
    // When I test a repository GitHub does not know
    await user.clear(field);
    await user.type(field, 'goerks/gibtesnicht');
    await user.type(screen.getByLabelText('Access token'), 'good');
    await user.click(screen.getByRole('button', { name: 'Test connection' }));
    // Then it says so, and the local data stays
    expect(await screen.findByRole('alert')).toHaveTextContent('Repository not found');
  });

  it('AC1.6 keeps the repository after a reload but asks for the token again', async () => {
    // Given a connection set up in this page
    const { repository } = await renderApp('#/settings/sync');
    expect(await screen.findByLabelText('Access token')).toHaveAttribute('placeholder', expect.stringContaining('Token saved'));
    // When the page is loaded again (a new page has an empty memory)
    const fresh = fakeGithub([]);
    cleanup();
    render(<App repository={repository} sync={fresh.sync} />);
    // Then the repository is there, the token is not, and a note asks for it
    expect(((await screen.findByLabelText('Repository (owner/name)')) as HTMLInputElement).value).toBe(REPO);
    expect(await screen.findByText(/Enter the token again/)).toBeInTheDocument();
    expect(screen.getByLabelText('Access token')).not.toHaveAttribute('placeholder', expect.stringContaining('Token saved'));
  });

  it('AC1.7 labels the preview "Demo" and works with any token', async () => {
    // Given the preview: no source is given, so the app uses the simulated GitHub
    const user = userEvent.setup();
    const repository = new LocalStorageRepository();
    const seed = seedSnapshot(todayIso());
    await repository.replaceAll({ ...seed, settings: { ...seed.settings, features: { ...seed.settings.features, sync: true } } });
    window.location.hash = '#/settings/sync';
    render(<App repository={repository} />);
    // When I connect with any token
    await user.type(await screen.findByLabelText('Repository (owner/name)'), REPO);
    await user.type(screen.getByLabelText('Access token'), 'whatever');
    await user.click(screen.getByRole('button', { name: 'Test connection' }));
    // Then it is marked as demo and finds the simulated issues; the refused token is named
    expect(await screen.findByText('✓ Connection ok · 3 open issues')).toBeInTheDocument();
    expect(screen.getAllByText('Demo').length).toBeGreaterThan(0);
    expect(screen.getByText(/Any text works, except “falsch”/)).toBeInTheDocument();
  });

  it('AC1.5 lets me disconnect: the repository and the token are removed', async () => {
    // Given a connection
    const user = userEvent.setup();
    const { fake, repository } = await renderApp('#/settings/sync');
    // When I disconnect
    await user.click(await screen.findByRole('button', { name: 'Remove connection' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove connection' }));
    // Then both are gone
    expect(await fake.tokens.get()).toBeNull();
    await waitFor(async () => expect((await repository.load()).settings.sync.connection.repo).toBeUndefined());
    expect((screen.getByLabelText('Repository (owner/name)') as HTMLInputElement).value).toBe('');
  });
});

describe('importing and syncing', () => {
  it('AC2.1 imports the open issues as stories with title, description, labels and the link', async () => {
    // Given the repository has 3 open issues (and one closed one, which GitHub does not list as open)
    const user = userEvent.setup();
    const { repository } = await renderApp('#/backlog', {
      issues: [
        fakeIssue(31, { title: 'Login', body: 'Users log in.', labels: ['feature'] }),
        fakeIssue(35, { title: 'Export as CSV' }),
        fakeIssue(38, { title: 'Dark mode' }),
        fakeIssue(29, { title: 'Imprint', state: 'closed' })
      ]
    });
    // When I synchronise for the first time
    const notice = await sync(user);
    // Then I get 3 new stories and no story for the closed issue
    expect(notice).toHaveTextContent('Synchronised: 3 new');
    for (const title of ['Login', 'Export as CSV', 'Dark mode']) expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.queryByText('Imprint')).not.toBeInTheDocument();
    const login = (await repository.load()).stories.find((story) => story.title === 'Login');
    expect(login).toMatchObject({ description: 'Users log in.', link: { state: 'open' } });
    expect(login?.values[LABELS_FIELD_ID]).toHaveLength(1);
  });

  it('AC2.2 does not import the same issues again', async () => {
    // Given 3 issues that were imported
    const user = userEvent.setup();
    const { repository } = await renderApp('#/backlog', { issues: [fakeIssue(1), fakeIssue(2), fakeIssue(3)] });
    await sync(user);
    const count = (await repository.load()).stories.length;
    // When I synchronise again
    const notice = await sync(user);
    // Then nothing new comes and the number of stories stays
    expect(notice).toHaveTextContent('Already up to date');
    expect((await repository.load()).stories).toHaveLength(count);
  });

  it('AC3.1 shows the changes of a synced story that GitHub changed', async () => {
    // Given an imported story
    const user = userEvent.setup();
    const { fake } = await renderApp('#/backlog', { issues: [fakeIssue(31, { title: 'Login', labels: ['feature'] })] });
    await sync(user);
    // When the title and a label change on GitHub and I synchronise
    fake.state.issues = [fakeIssue(31, { title: 'Login-Seite', labels: ['feature', 'bug'] })];
    await sync(user);
    // Then the log names the change and the story is updated
    const changes = await logText(user);
    expect(changes).toContain('Title changed: “Login” → “Login-Seite”');
    expect(changes).toContain('Labels: new bug');
    expect(screen.getByText('Login-Seite')).toBeInTheDocument();
  });

  it('AC3.2 puts a story into Done when its issue is closed, and back to the first status when it is opened again', async () => {
    // Given an imported story
    const user = userEvent.setup();
    const { fake, repository } = await renderApp('#/backlog', { issues: [fakeIssue(31, { title: 'Login' })] });
    await sync(user);
    const statusOf = async (): Promise<string | undefined> => (await repository.load()).stories.find((story) => story.title === 'Login')?.status;
    // When the issue is closed on GitHub
    fake.state.issues = [fakeIssue(31, { title: 'Login', state: 'closed' })];
    await sync(user);
    // Then the story is done and the log says so
    expect(await logText(user)).toContain('Closed on GitHub → status “Done”');
    await waitFor(async () => expect(await statusOf()).toBe('done'));
    // And when it is opened again, the story goes back to the first status
    fake.state.issues = [fakeIssue(31, { title: 'Login' })];
    await sync(user);
    expect(await logText(user)).toContain('Reopened on GitHub → status “To do”');
    await waitFor(async () => expect(await statusOf()).toBe('todo'));
  });

  it('AC3.3 and AC3.4 let GitHub win on the title and keep the plan of the story', async () => {
    // Given an imported story that I planned and renamed here
    const user = userEvent.setup();
    const { fake, repository } = await renderApp('#/backlog', { issues: [fakeIssue(31, { title: 'Login' })] });
    await sync(user);
    const story = (await repository.load()).stories.find((item) => item.title === 'Login');
    if (!story) throw new Error('story missing');
    await repository.updateStory({ ...story, title: 'My own title', points: 5, sprintId: 'sprint-2', status: 'in_progress' });
    // When GitHub has a new title of its own and I synchronise in a new page (it reads what the repository holds)
    fake.state.issues = [fakeIssue(31, { title: 'Login-Seite' })];
    cleanup();
    render(<App repository={repository} sync={fake.sync} />);
    await sync(user);
    // Then the title is GitHub's again and the plan is unchanged
    expect(await logText(user)).toContain('Title changed: “My own title” → “Login-Seite”');
    await waitFor(async () => {
      const after = (await repository.load()).stories.find((item) => item.id === story.id);
      expect(after).toMatchObject({ title: 'Login-Seite', points: 5, sprintId: 'sprint-2', status: 'in_progress' });
    });
  });

  it('AC3.5 shows the task list under "Acceptance criteria" as the criteria of the story', async () => {
    // Given an issue with a task list under the heading
    const user = userEvent.setup();
    const { repository } = await renderApp('#/backlog', {
      issues: [fakeIssue(31, { title: 'Login', body: 'Users log in.\n\n## Acceptance criteria\n- [ ] Login possible\n- [x] Error message for a wrong password' })]
    });
    // When I import it
    await sync(user);
    // Then the story has the two criteria, the second one ticked, and the list is not in the description
    const story = (await repository.load()).stories.find((item) => item.title === 'Login');
    expect(story?.criteria.map(({ text, done }) => ({ text, done }))).toEqual([
      { text: 'Login possible', done: false },
      { text: 'Error message for a wrong password', done: true }
    ]);
    expect(story?.description).toBe('Users log in.');
  });

  it('AC3.6 keeps a task list under another heading in the description', async () => {
    // Given an issue with a to-do list under another heading
    const user = userEvent.setup();
    const { repository } = await renderApp('#/backlog', { issues: [fakeIssue(31, { title: 'Login', body: 'Text\n\n## Todo\n- [ ] Buy milk' })] });
    // When I import it
    await sync(user);
    // Then there are no criteria and the list stays in the description
    const story = (await repository.load()).stories.find((item) => item.title === 'Login');
    expect(story?.criteria).toEqual([]);
    expect(story?.description).toContain('- [ ] Buy milk');
  });

  it('AC3.7 takes added, removed and ticked criteria from GitHub and overwrites my tick', async () => {
    // Given an imported story with two criteria, one of which I ticked here
    const user = userEvent.setup();
    const { fake, repository } = await renderApp('#/backlog', {
      issues: [fakeIssue(31, { title: 'Login', body: '## Acceptance criteria\n- [ ] A\n- [ ] B' })]
    });
    await sync(user);
    const story = (await repository.load()).stories.find((item) => item.title === 'Login');
    if (!story) throw new Error('story missing');
    await repository.setCriterionDone(story.criteria[0].id, true);
    // When GitHub has A (open), C (ticked) and D, and I synchronise in a new page
    fake.state.issues = [fakeIssue(31, { title: 'Login', body: '## Acceptance criteria\n- [ ] A\n- [x] C\n- [ ] D' })];
    cleanup();
    render(<App repository={repository} sync={fake.sync} />);
    await sync(user);
    // Then the criteria are GitHub's and the log counts what changed
    expect(await logText(user)).toContain('Criteria: 2 new, 1 removed, 1 tick changed');
    await waitFor(async () => {
      const after = (await repository.load()).stories.find((item) => item.id === story.id);
      expect(after?.criteria.map(({ text, done }) => ({ text, done }))).toEqual([
        { text: 'A', done: false },
        { text: 'C', done: true },
        { text: 'D', done: false }
      ]);
    });
  });

  it('AC3.8 answers with a short notice and lists the issues in the log', async () => {
    // Given one new, two changed and one closed issue since the last sync
    const user = userEvent.setup();
    const { fake } = await renderApp('#/backlog', { issues: [fakeIssue(1), fakeIssue(2), fakeIssue(3), fakeIssue(4)] });
    await sync(user);
    fake.state.issues = [fakeIssue(1, { title: 'One' }), fakeIssue(2, { title: 'Two' }), fakeIssue(3, { state: 'closed' }), fakeIssue(4), fakeIssue(5)];
    // When I synchronise
    const notice = await sync(user);
    // Then a notice counts them and no dialog opens
    expect(notice).toHaveTextContent('Synchronised: 1 new, 2 updated, 1 closed');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // And the log lists the issues
    expect(await logText(user)).toContain('#5');
  });

  it('AC3.8 shows the time of the last sync next to the button', async () => {
    // Given a connected repository that was never synchronised
    const user = userEvent.setup();
    await renderApp('#/backlog', { issues: [fakeIssue(1)] });
    expect(screen.getByText('GitHub · not synchronised yet')).toBeInTheDocument();
    // When I synchronise
    await sync(user);
    // Then the time of the sync stands there
    expect(await screen.findByText(/^GitHub · last sync /)).toBeInTheDocument();
  });
});

describe('issue numbers', () => {
  it('AC4.1 shows the number as a link to GitHub in the backlog and in the story', async () => {
    // Given an imported story and the demo stories of the team
    const user = userEvent.setup();
    await renderApp('#/backlog', { issues: [fakeIssue(31, { title: 'Login' })] });
    await sync(user);
    // When I look at the backlog
    const link = await screen.findByRole('link', { name: 'Open issue #31 on GitHub' });
    // Then the number is a link that opens the issue in a new tab
    expect(link).toHaveTextContent('#31');
    expect(link).toHaveAttribute('href', 'https://github.com/goerks/GetThingsDone/issues/31');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    // And a click on it does not open the story
    await user.click(link);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // And the story shows it as well, while the stories of the team have no number
    await user.click(screen.getByRole('button', { name: 'Login' }));
    const story = await screen.findByRole('dialog', { name: /Login/ });
    expect(within(story).getByRole('link', { name: 'Open issue #31 on GitHub' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Open issue/ })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: /Open issue/ }).every((item) => item.textContent === '#31')).toBe(true);
  });

  it('AC4.2 shows no number and no link on the stories of the team', async () => {
    // Given the demo stories of the team and a connected repository without issues
    const user = userEvent.setup();
    await renderApp('#/backlog');
    // When I synchronise
    await sync(user);
    // Then no story has an issue number
    expect(screen.getAllByText(/^S-\d+$/).length).toBeGreaterThan(5);
    expect(screen.queryAllByRole('link', { name: /Open issue/ })).toHaveLength(0);
    // And a story of the team has none in its dialog either
    await user.click(screen.getByRole('button', { name: 'Create a story with title and description' }));
    const story = await screen.findByRole('dialog', { name: /S-1:/ });
    expect(within(story).queryByRole('link', { name: /Open issue/ })).not.toBeInTheDocument();
  });
});

describe('the notice after a sync and the sync log', () => {
  it('AC17.1 answers with a short notice with a log button and opens no dialog', async () => {
    // Given two new issues on GitHub
    const user = userEvent.setup();
    await renderApp('#/backlog', { issues: [fakeIssue(1), fakeIssue(2)] });
    // When I synchronise
    const notice = await sync(user);
    // Then a short notice names the numbers and offers the log, and no dialog opens
    expect(notice).toHaveTextContent('Synchronised: 2 new');
    expect(within(notice).getByRole('button', { name: 'Log' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('AC17.2 says that everything is up to date', async () => {
    const user = userEvent.setup();
    await renderApp('#/backlog', { issues: [fakeIssue(1)] });
    await sync(user);
    expect(await sync(user)).toHaveTextContent('Already up to date');
  });

  it('AC17.3 leads from the notice to the sync log', async () => {
    // Given a notice after a sync
    const user = userEvent.setup();
    await renderApp('#/backlog', { issues: [fakeIssue(1)] });
    const notice = await sync(user);
    // When I choose "Log"
    await user.click(within(notice).getByRole('button', { name: 'Log' }));
    // Then the sync log in the settings opens
    await waitFor(() => expect(window.location.hash).toBe('#/settings/sync'));
    expect(await screen.findByRole('heading', { name: /Sync log/ })).toBeInTheDocument();
  });

  it('AC17.4 keeps an error notice until it is closed', async () => {
    // Given no network
    const user = userEvent.setup();
    const { fake } = await renderApp('#/backlog', { issues: [fakeIssue(1)] });
    fake.state.offline = true;
    // When I synchronise
    const notice = await sync(user);
    // Then the notice is an error with a log button, and it is still there after the usual 5 seconds
    expect(notice).toHaveClass('toast--error');
    expect(within(notice).getByRole('button', { name: 'Log' })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 5600));
    expect(notice).toBeInTheDocument();
    await user.click(within(notice).getByRole('button', { name: 'Dismiss' }));
    expect(notice).not.toBeInTheDocument();
  }, 15000);

  it('AC18.1 has the automatic sync off by default and runs nothing by itself', async () => {
    // Given a connected repository
    const { fake } = await renderApp('#/settings/sync', { issues: [fakeIssue(1)] });
    // Then the switch is off, nothing was fetched and there is no notice
    expect(await screen.findByRole('checkbox', { name: 'Synchronise automatically' })).not.toBeChecked();
    expect(fake.state.calls).toBe(0);
    expect(document.querySelector('.toast')).toBeNull();
    expect(screen.getByText('No runs yet.')).toBeInTheDocument();
  });

  it('AC20.1 logs every run with its trigger', async () => {
    // Given a sync by hand
    const user = userEvent.setup();
    await renderApp('#/backlog', { issues: [fakeIssue(1)] });
    await sync(user);
    // When I open the sync log
    window.location.hash = '#/settings/sync';
    // Then there is a row with the trigger "Manual" and the result
    const toggle = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('.github-log__toggle');
      if (!found) throw new Error('no row');
      return found;
    });
    expect(toggle).toHaveTextContent('Manual');
    expect(toggle).toHaveTextContent('Synchronised: 1 new');
    expect(toggle).toHaveTextContent('ok');
  });

  it('AC20.2 shows the single changes of a run', async () => {
    // Given an imported story whose title changed on GitHub
    const user = userEvent.setup();
    const { fake } = await renderApp('#/backlog', { issues: [fakeIssue(31, { title: 'Login' })] });
    await sync(user);
    fake.state.issues = [fakeIssue(31, { title: 'Login-Seite' })];
    await sync(user);
    // Then the newest run lists the ticket with the change
    const text = await logText(user);
    expect(text).toContain('#31');
    expect(text).toContain('Title changed: “Login” → “Login-Seite”');
  });

  it('AC20.4 clears the log', async () => {
    // Given a run in the log that is still there after a reload
    const user = userEvent.setup();
    const { fake, repository } = await renderApp('#/backlog', { issues: [fakeIssue(1)] });
    await sync(user);
    await waitFor(async () => expect((await repository.load()).settings.sync.log).toHaveLength(1));
    cleanup();
    window.location.hash = '#/settings/sync';
    render(<App repository={repository} sync={fake.sync} />);
    expect(await screen.findByRole('button', { name: /Synchronised: 1 new/ })).toBeInTheDocument();
    // When I press "Clear"
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    // Then the log is empty, also in the stored data
    expect(await screen.findByText('No runs yet.')).toBeInTheDocument();
    await waitFor(async () => expect((await repository.load()).settings.sync.log).toEqual([]));
  });
});

describe('when something goes wrong', () => {
  const titles = (): string[] => screen.getAllByText(/^S-\d+$/).map((item) => item.textContent ?? '');

  it('AC5.1 says there is no connection and keeps the local data', async () => {
    // Given a connected repository and no network
    const user = userEvent.setup();
    const { fake, repository } = await renderApp('#/backlog', { issues: [fakeIssue(1)] });
    fake.state.offline = true;
    const before = titles();
    // When I synchronise
    const notice = await sync(user);
    // Then a clear message appears and nothing changed
    expect(notice).toHaveTextContent('Synchronisation failed: No connection to GitHub. The app keeps working with your local data.');
    expect(titles()).toEqual(before);
    expect((await repository.load()).stories.some((story) => story.link)).toBe(false);
    // And I can keep working: the board is there
    await user.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Board' }));
    await waitFor(() => expect(window.location.hash).toBe('#/board'));
    await waitFor(() => expect(document.querySelector('.board')).not.toBeNull());
  });

  it('AC5.2 says the token was refused and keeps the local data', async () => {
    // Given a token that GitHub refuses
    const user = userEvent.setup();
    const { fake, repository } = await renderApp('#/backlog', { issues: [fakeIssue(1)] });
    await fake.tokens.set('expired');
    const count = (await repository.load()).stories.length;
    // When I synchronise
    const notice = await sync(user);
    // Then I am told so, and no story is added
    expect(notice).toHaveTextContent('GitHub refused the access token');
    expect((await repository.load()).stories).toHaveLength(count);
  });

  it('AC5.1 tells me to set up the connection when repository or token are missing', async () => {
    // Given a repository without a token (a new page has no token in memory)
    const user = userEvent.setup();
    const { fake } = await renderApp('#/backlog');
    await fake.tokens.clear();
    // When I synchronise
    const notice = await sync(user);
    // Then the message says so and the log button leads to the settings
    expect(notice).toHaveTextContent('The connection is not set up');
    await user.click(within(notice).getByRole('button', { name: 'Log' }));
    await waitFor(() => expect(window.location.hash).toBe('#/settings/sync'));
  });
});

describe('help for the GitHub connection', () => {
  const panel = (): HTMLElement => screen.getByRole('complementary');
  const openTopic = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
    await user.click(screen.getByRole('button', { name: 'Help' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search help' }), 'GitHub issues');
    await user.click(within(panel()).getByRole('button', { name: /^Synchronisation with GitHub/ }));
  };

  it('Help: tells to switch the feature on first and does not link to the places that need it while it is off', async () => {
    // Given the feature is off
    const user = userEvent.setup();
    await renderApp('#/backlog', { connected: false });
    // When I open the help topic
    await openTopic(user);
    // Then the text starts with switching the feature on, and the places that need it are locked
    expect(within(panel()).getByText(/^1\. Switch the feature on under Settings → Synchronisation/)).toBeInTheDocument();
    expect(within(panel()).getByRole('link', { name: 'Open Settings → Synchronisation' })).toHaveAttribute('href', '#/settings/sync');
  });

  it('Help: links to the section GitHub once the feature is on', async () => {
    // Given the feature is on
    const user = userEvent.setup();
    await renderApp('#/backlog');
    // When I open the help topic
    await openTopic(user);
    // Then the section GitHub is a link
    expect(within(panel()).getByRole('link', { name: 'Open Settings → Synchronisation' })).toHaveAttribute('href', '#/settings/sync');
  });
});

describe('texts', () => {
  it('AC6.1 has every text of the GitHub connection in German, English, French and Italian', async () => {
    // Given the four language files
    const files = await Promise.all(['de', 'en', 'fr', 'it'].map(async (code) => [code, (await import(`./i18n/${code}.json`)).default] as const));
    const keys = (value: unknown, prefix = ''): string[] =>
      Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => (typeof item === 'object' && item !== null ? keys(item, `${prefix}${key}.`) : [`${prefix}${key}`]));
    // When I compare the keys of "sync" and "github" (plural forms differ per language, so they are compared without their ending)
    const base = (name: string): string => name.replace(/_(zero|one|two|few|many|other)$/, '');
    const names = (file: Record<string, unknown>): string[] => [...new Set([...keys(file.sync, 'sync.'), ...keys(file.github, 'github.'), ...keys(file.jira, 'jira.')].map(base))].sort();
    // Then every language has the same texts, and none is empty
    const english = names(files[1][1]);
    for (const [code, file] of files) {
      expect(names(file), code).toEqual(english);
      expect(keys(file.sync).length, code).toBeGreaterThan(40);
      const flat = JSON.stringify([file.sync, file.github]);
      expect(flat, code).not.toContain('""');
    }
  });

  it('AC6.1 shows the section and the sync button in German', async () => {
    // Given the app in German
    const user = userEvent.setup();
    await i18nChange('de');
    await renderApp('#/backlog', { issues: [fakeIssue(1)] });
    // When I look at the backlog and synchronise
    await user.click(await screen.findByRole('button', { name: 'Synchronisieren' }));
    // Then the notice is in German
    expect(await screen.findByText('Synchronisiert: 1 neu')).toBeInTheDocument();
  });
});

async function i18nChange(language: string): Promise<void> {
  const { default: i18n } = await import('./i18n');
  await i18n.changeLanguage(language);
}
