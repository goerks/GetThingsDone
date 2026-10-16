import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { LocalStorageRepository } from './data/localStorageRepository';
import { seedSnapshot } from './data/seed';
import { todayIso } from './domain/sprints';
import { WORKFLOW_END, type Snapshot, type Workflow } from './domain/types';
import { DEFAULT_WORKFLOW, setEnabled, setFree, setStart, setTransition } from './domain/workflow';
import i18n, { initI18n } from './i18n';

beforeAll(() => {
  initI18n('en');
});

type User = ReturnType<typeof userEvent.setup>;

/** The demo statuses: To do (Not started), In progress and Review (In progress), Done (Done). */
const STATUSES = [
  { id: 'todo', label: null, category: 'not_started' as const },
  { id: 'in_progress', label: null, category: 'in_progress' as const },
  { id: 'review', label: null, category: 'in_progress' as const },
  { id: 'done', label: null, category: 'done' as const }
];

/** The workflow switched on, with the given transitions forbidden. */
function restricted(blocked: Array<[string, string]> = [['todo', 'done']]): Workflow {
  return blocked.reduce((workflow, [from, to]) => setTransition(workflow, from, to, false), setEnabled(DEFAULT_WORKFLOW, true));
}

async function open(hash: string, workflow: Workflow = DEFAULT_WORKFLOW, change: (snapshot: Snapshot) => Snapshot = (snapshot) => snapshot): Promise<LocalStorageRepository> {
  const snapshot = seedSnapshot(todayIso());
  const repository = new LocalStorageRepository();
  await repository.replaceAll(change({ ...snapshot, settings: { ...snapshot.settings, workflow } }));
  window.location.hash = hash;
  render(<App repository={repository} />);
  await screen.findByRole('heading', { level: 1 });
  return repository;
}

const story = (code: string): HTMLElement => screen.getByRole('group', { name: new RegExp(`${code}: `) });
const chip = (from: string, to: string): HTMLElement => screen.getByRole('button', { name: `From ${from} to ${to}` });
const endChip = (from: string): HTMLElement => screen.getByRole('button', { name: `From ${from} to the end (delete)` });
const startChip = (status: string): HTMLElement => screen.getByRole('button', { name: `A new story starts in ${status}` });
const switchOf = (name: string): HTMLElement => screen.getByRole('switch', { name });
const group = (name: string): HTMLElement => screen.getByRole('region', { name });

async function openStory(user: User, code: string): Promise<HTMLElement> {
  await user.click(story(code));
  return await screen.findByRole('dialog', { name: new RegExp(`^${code}: `) });
}

const optionsOf = (dialog: HTMLElement): string[] => within(within(dialog).getByRole('combobox', { name: 'Status' })).getAllByRole('option').map((option) => option.textContent ?? '');

async function reload(repository: LocalStorageRepository, hash: string): Promise<void> {
  document.body.innerHTML = '';
  window.location.hash = hash;
  render(<App repository={repository} />);
  await screen.findByRole('heading', { level: 1 });
}

describe('Settings › Workflows (#49)', () => {
  it('AC11.1 is off by default: only the switch and a note, no list', async () => {
    // Given the demo data and a workflow that was never touched
    await open('#/settings/workflows');
    // When I look at the page
    // Then the switch "Activate the workflow" is off
    expect(switchOf('Activate the workflow')).not.toBeChecked();
    // And there is a note, but not yet the list "from here to …"
    expect(screen.getByText(/Off by default/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Start · new story' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^From / })).not.toBeInTheDocument();
  });

  it('AC11.3 shows the list when the workflow is activated, with every transition allowed', async () => {
    const user = userEvent.setup();
    // Given the workflow is off
    const repository = await open('#/settings/workflows');
    // When I switch "Activate the workflow" on
    await user.click(switchOf('Activate the workflow'));
    // Then the list appears and every transition is allowed
    expect(group('Start · new story')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^From .* to (?!the end)/ }).every((button) => button.getAttribute('aria-pressed') === 'true')).toBe(true);
    expect(endChip('Done')).toHaveAttribute('aria-pressed', 'true');
    await waitFor(async () => expect((await repository.load()).settings.workflow.enabled).toBe(true));
  });

  it('AC2.1 lists the start, the categories with one row per status, and the other statuses and the end as targets', async () => {
    // Given the workflow is on
    await open('#/settings/workflows', setEnabled(DEFAULT_WORKFLOW, true));
    // Then there is a row "New story" with the statuses of "Not started" as its targets
    const start = group('Start · new story');
    expect(within(start).getAllByRole('button').map((button) => button.textContent?.replace('✓', ''))).toEqual(['To do']);
    // And one block per category with a row per status
    for (const [category, names] of [['Not started', ['To do']], ['In progress', ['In progress', 'Review']], ['Done', ['Done']]] as const) {
      const block = group(category);
      expect(within(block).getAllByRole('group').map((row) => row.getAttribute('aria-label'))).toEqual(names.map((name) => `Where a story may move from ${name}`));
    }
    // And a status is never a target in its own row, while the end always is
    const review = within(group('In progress')).getByRole('group', { name: 'Where a story may move from Review' });
    expect(within(review).getAllByRole('button').map((button) => button.textContent?.replace('✓', ''))).toEqual(['To do', 'In progress', 'Done', 'End (delete)']);
  });

  it('AC2.2 switches a target with the keyboard and names it for the screen reader', async () => {
    const user = userEvent.setup();
    // Given the workflow is on
    await open('#/settings/workflows', setEnabled(DEFAULT_WORKFLOW, true));
    // When I focus "Review" → "Done" and press Space
    const target = chip('Review', 'Done');
    target.focus();
    expect(target).toHaveFocus();
    expect(target).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard(' ');
    // Then it is off, and its name says where it goes
    expect(target).toHaveAttribute('aria-pressed', 'false');
    expect(target).toHaveAccessibleName('From Review to Done');
    await user.keyboard('{Enter}');
    expect(target).toHaveAttribute('aria-pressed', 'true');
  });

  it('AC1.2 forbids a transition, and AC7.1 it is still forbidden after a reload', async () => {
    const user = userEvent.setup();
    // Given the workflow is on
    const repository = await open('#/settings/workflows', setEnabled(DEFAULT_WORKFLOW, true));
    // When I switch "To do" → "Done" off
    await user.click(chip('To do', 'Done'));
    expect(chip('To do', 'Done')).toHaveAttribute('aria-pressed', 'false');
    await waitFor(async () => expect((await repository.load()).settings.workflow.story.blocked).toEqual({ todo: ['done'] }));
    // And reload the app
    await reload(repository, '#/settings/workflows');
    // Then it is still off
    expect(chip('To do', 'Done')).toHaveAttribute('aria-pressed', 'false');
    expect(chip('To do', 'In progress')).toHaveAttribute('aria-pressed', 'true');
  });

  it('AC11.4 keeps what was set when the workflow is switched off and on', async () => {
    const user = userEvent.setup();
    // Given the workflow is on and "To do" → "Done" is forbidden
    await open('#/settings/workflows', restricted());
    // When I switch the workflow off and on again
    await user.click(switchOf('Activate the workflow'));
    expect(screen.queryByRole('button', { name: /^From / })).not.toBeInTheDocument();
    await user.click(switchOf('Activate the workflow'));
    // Then "To do" → "Done" is still forbidden
    expect(chip('To do', 'Done')).toHaveAttribute('aria-pressed', 'false');
  });

  it('AC1.3 sets where a new story starts, and AC1.4 keeps the last start on', async () => {
    const user = userEvent.setup();
    // Given "Not started" has two statuses, "To do" and "Ready", and the workflow is on
    const withReady = (snapshot: Snapshot): Snapshot => ({
      ...snapshot,
      statuses: [STATUSES[0], { id: 'ready', label: 'Ready', category: 'not_started' }, ...STATUSES.slice(1)]
    });
    const repository = await open('#/settings/workflows', setEnabled(DEFAULT_WORKFLOW, true), withReady);
    // Then only the first one is a start, and it cannot be switched off (AC1.4)
    expect(startChip('To do')).toHaveAttribute('aria-pressed', 'true');
    expect(startChip('Ready')).toHaveAttribute('aria-pressed', 'false');
    expect(startChip('To do')).toBeDisabled();
    // When I allow "Ready" and switch "To do" off
    await user.click(startChip('Ready'));
    await user.click(startChip('To do'));
    // Then "Ready" is the only start, and now it cannot be switched off
    expect(startChip('Ready')).toBeDisabled();
    await waitFor(async () => expect((await repository.load()).settings.workflow.story.start).toEqual(['ready']));
    // And a new story starts in "Ready"
    window.location.hash = '#/board';
    const board = await screen.findByRole('region', { name: 'Ready' });
    expect(screen.queryByRole('button', { name: '+ Story in To do' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Story in In progress' })).not.toBeInTheDocument();
    await user.click(within(board).getByRole('button', { name: '+ Story in Ready' }));
    await user.type(within(board).getByRole('textbox', { name: 'Title of the new story in Ready' }), 'Starts in Ready{Enter}');
    await waitFor(async () => expect((await repository.load()).stories.find((item) => item.title === 'Starts in Ready')?.status).toBe('ready'));
  });

  it('AC4.2 warns when no status leads to the end, and still saves', async () => {
    const user = userEvent.setup();
    // Given the workflow is on and the end is allowed everywhere
    const repository = await open('#/settings/workflows', setEnabled(DEFAULT_WORKFLOW, true));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // When I switch "End (delete)" off for every status
    for (const name of ['To do', 'In progress', 'Review', 'Done']) await user.click(endChip(name));
    // Then a warning says that stories cannot be deleted any more
    expect(screen.getByRole('alert')).toHaveTextContent('No status leads to the end');
    // And it is saved all the same
    await waitFor(async () => expect(Object.keys((await repository.load()).settings.workflow.story.blocked).sort()).toEqual(['done', 'in_progress', 'review', 'todo']));
  });

  it('AC9.1 turns a category free with its switch, and AC9.2 shows an exception made afterwards', async () => {
    const user = userEvent.setup();
    // Given the workflow is on, the switch of "In progress" is off and both directions between its statuses are forbidden
    const off = setFree(restricted([['in_progress', 'review'], ['review', 'in_progress'], ['todo', 'done']]), STATUSES, 'in_progress', false);
    await open('#/settings/workflows', off);
    const free = switchOf('Free transitions within “In progress”');
    expect(free).not.toBeChecked();
    // When I turn the switch on
    await user.click(free);
    // Then both directions are allowed, "To do" → "Done" is still forbidden
    expect(chip('In progress', 'Review')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('Review', 'In progress')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('To do', 'Done')).toHaveAttribute('aria-pressed', 'false');
    // And when I forbid one of them, the switch stays on and says "with exceptions"
    await user.click(chip('Review', 'In progress'));
    expect(chip('Review', 'In progress')).toHaveAttribute('aria-pressed', 'false');
    expect(switchOf('Free transitions within “In progress”')).toBeChecked();
    expect(within(group('In progress')).getByText('with exceptions')).toBeInTheDocument();
  });

  it('AC9.3 keeps the transitions when the switch is turned off', async () => {
    const user = userEvent.setup();
    // Given the switch of "In progress" is on and everything inside is allowed
    await open('#/settings/workflows', setEnabled(DEFAULT_WORKFLOW, true));
    expect(switchOf('Free transitions within “In progress”')).toBeChecked();
    // When I turn it off
    await user.click(switchOf('Free transitions within “In progress”'));
    // Then everything stays allowed
    expect(switchOf('Free transitions within “In progress”')).not.toBeChecked();
    expect(chip('In progress', 'Review')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('Review', 'In progress')).toHaveAttribute('aria-pressed', 'true');
  });

  it('AC9.4 greys out the switch of a category with a single status', async () => {
    // Given the demo statuses: "Done" has one status
    await open('#/settings/workflows', setEnabled(DEFAULT_WORKFLOW, true));
    // Then its switch is disabled and says "only one status"
    expect(switchOf('Free transitions within “Done”')).toBeDisabled();
    expect(within(group('Done')).getByText('only one status')).toBeInTheDocument();
    expect(switchOf('Free transitions within “In progress”')).toBeEnabled();
  });

  it('AC6.1 drops the row and the transitions of a removed status, and AC6.2 gives a new status every transition', async () => {
    const user = userEvent.setup();
    // Given "To do" → "Review" and "Review" → "Done" are forbidden
    const repository = await open('#/settings/statuses', restricted([['todo', 'review'], ['review', 'done']]));
    // When I remove "Review" (its story moves to "In progress")
    await user.click(screen.getByRole('button', { name: 'Remove status Review' }));
    const dialog = screen.getByRole('dialog', { name: 'Remove status "Review"?' });
    await user.click(within(dialog).getByRole('button', { name: 'Move 1 story and remove' }));
    // And add a status "Test" in "In progress"
    await user.click(screen.getByRole('button', { name: '+ Status in "In progress"' }));
    await user.type(screen.getByRole('textbox', { name: 'Name of the new status in "In progress"' }), 'Test{Enter}');
    await screen.findByRole('textbox', { name: 'Name of status Test' });
    // Then the stored workflow no longer refers to "Review"
    await waitFor(async () => expect((await repository.load()).settings.workflow.story.blocked).toEqual({}));
    // And on the workflow page "Review" has no row, "Test" has one and every transition from and to it is allowed
    await user.click(screen.getByRole('link', { name: 'Workflows' }));
    await screen.findByRole('heading', { level: 2, name: 'Workflows' });
    expect(screen.queryByRole('group', { name: 'Where a story may move from Review' })).not.toBeInTheDocument();
    const test = screen.getByRole('group', { name: 'Where a story may move from Test' });
    expect(within(test).getAllByRole('button').every((button) => button.getAttribute('aria-pressed') === 'true')).toBe(true);
    expect(chip('To do', 'Test')).toHaveAttribute('aria-pressed', 'true');
  });

  it('AC10.1 has rows for the statuses of the stories only, nothing for epics', async () => {
    // Given the workflow is on
    await open('#/settings/workflows', setEnabled(DEFAULT_WORKFLOW, true));
    // Then there are rows for the four statuses and nothing that mentions epics
    expect(screen.getAllByRole('group', { name: /^Where a story may move from / })).toHaveLength(4);
    expect(document.querySelector('.workflows-settings')?.textContent).not.toMatch(/epic/i);
  });

  it.each([
    ['de', 'Workflow aktivieren', 'Ende (löschen)'],
    ['fr', 'Activer le workflow', 'Fin (supprimer)'],
    ['it', 'Attiva il workflow', 'Fine (elimina)'],
    ['en', 'Activate the workflow', 'End (delete)']
  ])('AC8.1 shows the page in %s', async (language, activate, end) => {
    await i18n.changeLanguage(language);
    try {
      // Given the workflow is on
      await open('#/settings/workflows', setEnabled(DEFAULT_WORKFLOW, true));
      // Then the switch, the end and the notes are in that language
      expect(switchOf(activate)).toBeChecked();
      expect(screen.getAllByText(end, { exact: false }).length).toBeGreaterThan(0);
      expect(screen.queryByText(/^workflow\./)).not.toBeInTheDocument();
    } finally {
      await i18n.changeLanguage('en');
    }
  });
});

describe('The workflow in stories, the menu and deleting (#49)', () => {
  it('AC3.5 offers only the current status and the allowed targets in the story dialog', async () => {
    const user = userEvent.setup();
    // Given S-6 is in "To do", "To do" → "Done" is forbidden
    await open('#/board', restricted());
    // When I open S-6 and open the status choice
    const dialog = await openStory(user, 'S-6');
    // Then "To do", "In progress" and "Review" are offered, not "Done"
    expect(optionsOf(dialog)).toEqual(['To do', 'In progress', 'Review']);
  });

  it('AC5.1 keeps a story where it is and offers it only the transitions that are still allowed', async () => {
    const user = userEvent.setup();
    // Given S-2 is in "Review" and every way out but "In progress" is forbidden
    await open('#/board', restricted([['review', 'todo'], ['review', 'done']]));
    // When I open S-2
    const dialog = await openStory(user, 'S-2');
    // Then its status is still "Review" and the only other choice is "In progress"
    expect(within(dialog).getByRole('combobox', { name: 'Status' })).toHaveValue('review');
    expect(optionsOf(dialog)).toEqual(['In progress', 'Review']);
  });

  it('AC3.6 offers only the allowed targets in the menu of a card in the backlog', async () => {
    const user = userEvent.setup();
    // Given S-6 is in "To do", "To do" → "Done" is forbidden
    await open('#/backlog', restricted());
    // When I open the menu of S-6 with a right click and the submenu Status
    await user.pointer({ keys: '[MouseRight]', target: story('S-6') });
    const status = await screen.findByRole('menuitem', { name: 'Status' });
    await user.click(status);
    // Then the choices are "To do", "In progress" and "Review"
    const choices = await screen.findAllByRole('menuitemradio');
    expect(choices.map((item) => item.textContent?.replace('✓', ''))).toEqual(['To do', 'In progress', 'Review']);
  });

  it('AC4.1 refuses to delete a story in a status without a way to the end, and deletes one in another status', async () => {
    const user = userEvent.setup();
    // Given the end is forbidden for "Done" ("S-5" is done, "S-6" is in "To do")
    const repository = await open('#/board', restricted([['done', WORKFLOW_END]]));
    // When I try to delete S-5
    let dialog = await openStory(user, 'S-5');
    await user.click(within(dialog).getByRole('button', { name: 'Delete story' }));
    // Then the story stays, no question is asked, the dialog stays open and a notice gives the reason
    expect(await screen.findByText(/cannot be deleted from “Done”/)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /^S-5: / })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Keep story' })).not.toBeInTheDocument();
    expect((await repository.load()).stories.some((item) => item.code === 'S-5')).toBe(true);
    // And S-6 in "To do" can be deleted
    await user.click(within(screen.getByRole('dialog', { name: /^S-5: / })).getByRole('button', { name: 'Close' }));
    dialog = await openStory(user, 'S-6');
    await user.click(within(dialog).getByRole('button', { name: 'Delete story' }));
    await user.click(within(dialog).getByRole('button', { name: /^Delete$/ }));
    await waitFor(async () => expect((await repository.load()).stories.some((item) => item.code === 'S-6')).toBe(false));
  });

  it('AC11.5 ignores a saved start and a saved end rule while the workflow is off', async () => {
    const user = userEvent.setup();
    // Given the workflow is off but saved: the end is forbidden for "Done" and "Ready" is the start
    const saved = { ...setStart(setTransition(setEnabled(DEFAULT_WORKFLOW, true), 'done', WORKFLOW_END, false), [STATUSES[0], { id: 'ready', label: 'Ready', category: 'not_started' }], 'ready', true), enabled: false };
    const repository = await open('#/board', saved, (snapshot) => ({ ...snapshot, statuses: [STATUSES[0], { id: 'ready', label: 'Ready', category: 'not_started' }, ...STATUSES.slice(1)] }));
    // When I delete S-5 in "Done" and add a story
    const dialog = await openStory(user, 'S-5');
    await user.click(within(dialog).getByRole('button', { name: 'Delete story' }));
    await user.click(within(dialog).getByRole('button', { name: /^Delete$/ }));
    await waitFor(async () => expect((await repository.load()).stories.some((item) => item.code === 'S-5')).toBe(false));
    // Then S-5 is gone, and every column offers "+ Story", including "To do"
    expect(screen.getByRole('button', { name: '+ Story in To do' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Story in Ready' })).toBeInTheDocument();
  });

  it('AC12.1 AC12.2 AC12.3 lists versions, names one and goes back to a working one after a confirmation', async () => {
    const user = userEvent.setup();
    // Given the workflow is on and has no version yet
    const repository = await open('#/settings/workflows', setEnabled(DEFAULT_WORKFLOW, true));
    const versions = (): HTMLElement[] => within(screen.getByRole('region', { name: 'Versions' })).queryAllByRole('listitem');
    expect(versions()).toHaveLength(0);
    // When I forbid "To do" → "Done"
    await user.click(chip('To do', 'Done'));
    // Then there are two versions: the state before and the new one, marked as current
    expect(versions()).toHaveLength(2);
    expect(within(versions()[0]).getByText('Current')).toBeInTheDocument();
    // When I name the older one and break the workflow by forbidding "To do" → "In progress"
    await user.type(within(versions()[1]).getByRole('textbox'), 'Before the rebuild{Enter}');
    await user.click(chip('To do', 'In progress'));
    expect(versions()).toHaveLength(3);
    // And go back to the named version, first cancelling the confirmation
    await user.click(within(versions()[2]).getByRole('button', { name: /^Go back to the version from/ }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(chip('To do', 'Done')).toHaveAttribute('aria-pressed', 'false');
    await user.click(within(versions()[2]).getByRole('button', { name: /^Go back to the version from/ }));
    await user.click(screen.getByRole('button', { name: 'Go back' }));
    // Then the transitions are those of that version, a new version was added, and nothing was removed
    expect(chip('To do', 'Done')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('To do', 'In progress')).toHaveAttribute('aria-pressed', 'true');
    expect(versions()).toHaveLength(4);
    expect(within(versions()[0]).getByText('Current')).toBeInTheDocument();
    // And the name and the versions are still there after a reload
    await reload(repository, '#/settings/workflows');
    expect(versions()).toHaveLength(4);
    expect(within(versions()[3]).getByRole('textbox')).toHaveValue('Before the rebuild');
  });
});
