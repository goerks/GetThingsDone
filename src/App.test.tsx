import { describe, expect, it, beforeAll } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { LocalStorageRepository } from './data/localStorageRepository';
import { initI18n } from './i18n';
import { parseHash } from './router';
import { seedSnapshot } from './data/seed';
import { addDays } from './domain/sprints';

beforeAll(() => {
  initI18n('en');
});

async function renderApp(): Promise<LocalStorageRepository> {
  const repository = new LocalStorageRepository();
  render(<App repository={repository} />);
  await screen.findByRole('heading', { name: 'Sprint 1', level: 1 });
  return repository;
}

describe('board', () => {
  it('shows the demo stories in their columns', async () => {
    await renderApp();
    const inProgress = screen.getByRole('region', { name: 'In progress' });
    expect(within(inProgress).getByText('Create a story with title and description')).toBeInTheDocument();
    expect(within(inProgress).getByText('Keep all data in a local database')).toBeInTheDocument();
    const done = screen.getByRole('region', { name: 'Done' });
    expect(within(done).getByText('Switch the UI language (DE, EN, FR, IT)')).toBeInTheDocument();
  });

  it('does not show stories that are not in the sprint', async () => {
    await renderApp();
    expect(screen.queryByText('Plan releases on a story map')).not.toBeInTheDocument();
  });

  it('makes the whole card a keyboard stop that is dragged with space and opened with Enter', async () => {
    const user = userEvent.setup();
    await renderApp();
    const card = screen.getByRole('group', { name: 'S-3: Reorder the backlog by priority' });
    expect(card).toHaveAttribute('tabindex', '0');
    expect(card).toHaveAttribute('aria-roledescription', 'story card');
    expect(screen.queryByRole('button', { name: /^Move / })).not.toBeInTheDocument();
    card.focus();
    await user.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog', { name: 'S-3: Reorder the backlog by priority' });
    expect(within(dialog).getByRole('heading', { level: 2, name: /Reorder the backlog by priority/ })).toBeInTheDocument();
    expect(window.location.hash).toBe('');
  });

  it('opens a story on double click', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.dblClick(screen.getByRole('group', { name: 'S-4: Keep all data in a local database' }));
    expect(screen.getByRole('dialog', { name: 'S-4: Keep all data in a local database' })).toBeInTheDocument();
  });

  it('shows each column as its own lane without a drop target at rest', async () => {
    await renderApp();
    const columns = document.querySelectorAll('.column');
    expect(columns).toHaveLength(4);
    expect(document.querySelector('[data-drop-target]')).toBeNull();
  });

  it('summarises the sprint', async () => {
    await renderApp();
    expect(screen.getByText(/6 stories · 23 points/)).toBeInTheDocument();
  });

  it('creates a story in "To do" through a dialog', async () => {
    const user = userEvent.setup();
    const repository = await renderApp();
    await user.click(screen.getByRole('button', { name: 'New story' }));
    const dialog = screen.getByRole('dialog', { name: 'New story' });
    expect(within(dialog).getByLabelText('Sprint')).toHaveDisplayValue(/^Sprint 1/);
    await user.type(within(dialog).getByLabelText('Title'), 'Export to CSV');
    await user.click(within(dialog).getByRole('button', { name: 'Add story' }));

    const todo = screen.getByRole('region', { name: 'To do' });
    expect(within(todo).getByText('Export to CSV')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const saved = await repository.load();
    expect(saved.stories.some((s) => s.title === 'Export to CSV' && s.code === 'S-8' && s.sprintId === 'sprint-1')).toBe(true);
  });

  it('closes the new story dialog without saving on cancel', async () => {
    const user = userEvent.setup();
    const repository = await renderApp();
    await user.click(screen.getByRole('button', { name: 'New story' }));
    await user.type(screen.getByLabelText('Title'), 'Never saved');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect((await repository.load()).stories.some((s) => s.title === 'Never saved')).toBe(false);
  });
});

describe('backlog', () => {
  async function openBacklog(): Promise<LocalStorageRepository> {
    const user = userEvent.setup();
    const repository = await renderApp();
    await user.click(screen.getByRole('link', { name: 'Backlog' }));
    await screen.findByRole('heading', { name: 'Backlog', level: 1 });
    return repository;
  }

  it('shows one section per sprint and the unplanned stories last', async () => {
    await openBacklog();
    const names = screen
      .getAllByRole('region')
      .map((section) => document.getElementById(section.getAttribute('aria-labelledby') ?? '')?.textContent);
    // The velocity panel (#24) sits above the sprint sections.
    expect(names).toEqual(['Velocity', 'Sprint 1', 'Sprint 2', 'Not planned']);
    const sprint = screen.getByRole('region', { name: 'Sprint 1' });
    const rest = screen.getByRole('region', { name: 'Not planned' });
    expect(within(sprint).getByText('running')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Sprint 2' })).getByText('Drag stories here to plan them into Sprint 2.')).toBeInTheDocument();
    expect(within(sprint).getAllByRole('group')).toHaveLength(6);
    expect(within(sprint).getByText('6 stories · 23 points')).toBeInTheDocument();
    expect(within(rest).getByRole('group', { name: 'Rank 7, S-7: Plan releases on a story map' })).toBeInTheDocument();
  });

  it('numbers the ranks across both sections', async () => {
    await openBacklog();
    expect(screen.getByRole('group', { name: 'Rank 1, S-1: Create a story with title and description' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Rank 6, S-6: Operate the board with the keyboard only' })).toBeInTheDocument();
  });

  it('has no move or sprint buttons, the rows are dragged instead', async () => {
    await openBacklog();
    expect(screen.queryByRole('button', { name: /^Move .* (up|down)$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sprint 1 –/ })).not.toBeInTheDocument();
    const row = screen.getByRole('group', { name: /S-2: Tick off acceptance criteria/ });
    expect(row).toHaveAttribute('tabindex', '0');
    expect(row).toHaveAttribute('aria-roledescription', 'backlog story');
  });

  it('adds a new story below the sprint line from a dialog', async () => {
    const user = userEvent.setup();
    const repository = await openBacklog();
    await user.click(screen.getByRole('button', { name: 'New story' }));
    const dialog = screen.getByRole('dialog', { name: 'New story' });
    expect(within(dialog).getByLabelText('Sprint')).toHaveDisplayValue('Not planned');
    await user.type(within(dialog).getByLabelText('Title'), 'Import from Jira');
    await user.click(within(dialog).getByRole('button', { name: 'Add story' }));

    const rest = screen.getByRole('region', { name: 'Not planned' });
    expect(within(rest).getByRole('group', { name: 'Rank 8, S-8: Import from Jira' })).toBeInTheDocument();
    expect((await repository.load()).stories.find((s) => s.code === 'S-8')?.sprintId).toBeNull();
  });

  it('opens a story with Enter', async () => {
    const user = userEvent.setup();
    await openBacklog();
    screen.getByRole('group', { name: /S-7: Plan releases on a story map/ }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: 'S-7: Plan releases on a story map' })).toBeInTheDocument();
  });
});

describe('story detail', () => {
  it('ticks a criterion and updates the progress', async () => {
    const user = userEvent.setup();
    const repository = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Create a story with title and description' }));

    expect(await screen.findByText('2 of 4 accepted')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'A new story appears in "To do"' }));
    expect(screen.getByText('3 of 4 accepted')).toBeInTheDocument();
    const saved = await repository.load();
    expect(saved.stories.find((s) => s.id === 'story-1')?.criteria.find((c) => c.id === 'c-1-3')?.done).toBe(true);
  });

  it('announces when every criterion is accepted', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole('button', { name: 'Tick off acceptance criteria' }));
    expect(screen.queryByText(/All criteria accepted/)).not.toBeInTheDocument();
    await user.click(await screen.findByRole('checkbox', { name: /marked as ready to merge/ }));
    expect(screen.getByText(/All criteria accepted/)).toHaveAttribute('role', 'status');
  });

  it('adds a criterion', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole('button', { name: 'Reorder the backlog by priority' }));
    await user.type(await screen.findByLabelText('New criterion'), 'Works with 500 stories');
    await user.click(screen.getByRole('button', { name: 'Add criterion' }));
    expect(screen.getByRole('checkbox', { name: 'Works with 500 stories' })).toBeInTheDocument();
  });

  it('edits the title and saves it', async () => {
    const user = userEvent.setup();
    const repository = await renderApp();
    await user.dblClick(screen.getByRole('group', { name: /S-3:/ }));
    await user.click(await screen.findByRole('button', { name: /edit Title/ }));
    const field = screen.getByRole('textbox', { name: 'Title' });
    await user.clear(field);
    await user.type(field, 'Prioritise the backlog{Enter}');

    expect(screen.getByRole('heading', { level: 2, name: /Prioritise the backlog/ })).toBeInTheDocument();
    const saved = await repository.load();
    expect(saved.stories.find((s) => s.id === 'story-3')?.title).toBe('Prioritise the backlog');
  });

  it('discards an edit with Escape and ignores an empty title', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.dblClick(screen.getByRole('group', { name: /S-3:/ }));
    await user.click(await screen.findByRole('button', { name: /edit Title/ }));
    await user.type(screen.getByRole('textbox', { name: 'Title' }), ' changed{Escape}');
    expect(screen.getByRole('heading', { level: 2, name: /^Reorder the backlog by priority/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /edit Title/ }));
    await user.clear(screen.getByRole('textbox', { name: 'Title' }));
    await user.keyboard('{Enter}');
    expect(screen.getByRole('heading', { level: 2, name: /^Reorder the backlog by priority/ })).toBeInTheDocument();
  });

  it('edits the description, saved when the field is left', async () => {
    const user = userEvent.setup();
    const repository = await renderApp();
    await user.dblClick(screen.getByRole('group', { name: /S-3:/ }));
    await user.click(await screen.findByRole('button', { name: /edit Description/ }));
    const field = screen.getByRole('textbox', { name: 'Description' });
    await user.clear(field);
    await user.type(field, 'First line{Enter}Second line');
    await user.tab();

    const saved = await repository.load();
    expect(saved.stories.find((s) => s.id === 'story-3')?.description).toBe('First line\nSecond line');
  });

  it('changes status, epic, points and sprint membership', async () => {
    const user = userEvent.setup();
    const repository = await renderApp();
    await user.dblClick(screen.getByRole('group', { name: /S-3:/ }));
    await user.selectOptions(await screen.findByLabelText('Status'), 'review');
    await user.selectOptions(screen.getByLabelText('Epic'), 'epic-storage');
    await user.selectOptions(screen.getByLabelText('Points'), '8');
    await user.selectOptions(screen.getByLabelText('Sprint'), 'Not planned');

    const saved = (await repository.load()).stories.find((s) => s.id === 'story-3');
    expect(saved).toMatchObject({ status: 'review', epicId: 'epic-storage', points: 8, sprintId: null });
  });

  it('creates a new epic from the epic field', async () => {
    const user = userEvent.setup();
    const repository = await renderApp();
    await user.dblClick(screen.getByRole('group', { name: /S-3:/ }));
    await user.selectOptions(await screen.findByLabelText('Epic'), '+ New epic…');
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Reporting{Enter}');

    const saved = await repository.load();
    const epic = saved.epics.find((e) => e.name === 'Reporting');
    expect(epic?.colorKey).toBe('rose');
    expect(saved.stories.find((s) => s.id === 'story-3')?.epicId).toBe(epic?.id);
  });

  it('edits and deletes acceptance criteria', async () => {
    const user = userEvent.setup();
    const repository = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Create a story with title and description' }));
    const editButtons = await screen.findAllByRole('button', { name: /edit Criterion/ });
    await user.click(editButtons[0]);
    const field = screen.getByRole('textbox', { name: 'Criterion' });
    await user.clear(field);
    await user.type(field, 'A story needs a short title{Enter}');
    expect(screen.getByRole('checkbox', { name: 'A story needs a short title' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete criterion: The description is optional' }));
    expect(screen.queryByRole('checkbox', { name: 'The description is optional' })).not.toBeInTheDocument();
    expect(screen.getByText('1 of 3 accepted')).toBeInTheDocument();

    const criteria = (await repository.load()).stories.find((s) => s.id === 'story-1')?.criteria ?? [];
    expect(criteria.map((c) => c.text)).toEqual([
      'A story needs a short title',
      'A new story appears in "To do"',
      'The story gets the next free key'
    ]);
  });

  it('offers a keyboard handle to reorder criteria', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole('button', { name: 'Create a story with title and description' }));
    expect(await screen.findByRole('button', { name: 'Move criterion: A story needs a title' })).toBeInTheDocument();
  });

  it('deletes a story only after confirmation', async () => {
    const user = userEvent.setup();
    const repository = await renderApp();
    await user.dblClick(screen.getByRole('group', { name: /S-3:/ }));
    await user.click(await screen.findByRole('button', { name: 'Delete story' }));
    expect(screen.getByText('Delete S-3 and its 3 criteria? This cannot be undone.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep story' }));
    expect((await repository.load()).stories.some((s) => s.id === 'story-3')).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Delete story' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sprint 1', level: 1 })).toBeInTheDocument();
    expect(screen.queryByText('Reorder the backlog by priority')).not.toBeInTheDocument();
    expect((await repository.load()).stories.some((s) => s.id === 'story-3')).toBe(false);
  });

  it('opens a story over the current page and returns there when closed', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole('link', { name: 'Backlog' }));
    await user.click(await screen.findByRole('button', { name: 'Tick off acceptance criteria' }));
    const dialog = screen.getByRole('dialog', { name: 'S-2: Tick off acceptance criteria' });
    expect(screen.getByRole('heading', { name: 'Backlog', level: 1 })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.location.hash).toBe('#/backlog');
  });

  it('opens the epic of a story from its epic name', async () => {
    const user = userEvent.setup();
    await renderApp();
    const card = screen.getByRole('group', { name: /S-4/ });
    await user.click(within(card).getByRole('button', { name: 'Local storage' }));
    expect(screen.getByRole('dialog', { name: 'Local storage' })).toBeInTheDocument();
  });
});

describe('epics', () => {
  async function openEpics(): Promise<LocalStorageRepository> {
    const user = userEvent.setup();
    const repository = await renderApp();
    await user.click(screen.getByRole('link', { name: 'Epics' }));
    await screen.findByRole('heading', { name: 'Epics', level: 1 });
    return repository;
  }

  it('lists the epics with their number of stories', async () => {
    await openEpics();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    expect(within(rows[0]).getByRole('button', { name: /Boards.*2 stories/ })).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('creates an epic with a chosen colour through a dialog', async () => {
    const user = userEvent.setup();
    const repository = await openEpics();
    await user.click(screen.getByRole('button', { name: 'New epic' }));
    const dialog = screen.getByRole('dialog', { name: 'New epic' });
    await user.type(within(dialog).getByLabelText('Name'), 'Reporting');
    await user.click(within(within(dialog).getByRole('group', { name: 'Colour' })).getByRole('radio', { name: 'Slate' }));
    await user.click(within(dialog).getByRole('button', { name: 'Add epic' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect((await repository.load()).epics.find((e) => e.name === 'Reporting')?.colorKey).toBe('slate');
  });

  it('renames and recolours an epic in its dialog', async () => {
    const user = userEvent.setup();
    const repository = await openEpics();
    await user.click(screen.getByRole('button', { name: /^Boards/ }));
    const dialog = screen.getByRole('dialog', { name: 'Boards' });
    await user.click(within(dialog).getByRole('button', { name: /edit Name/ }));
    const field = within(dialog).getByRole('textbox', { name: 'Name' });
    await user.clear(field);
    await user.type(field, 'Board{Enter}');
    await user.click(within(within(dialog).getByRole('group', { name: 'Colour of Board' })).getByRole('radio', { name: 'Green' }));

    const saved = await repository.load();
    expect(saved.epics.find((e) => e.id === 'epic-boards')).toMatchObject({ name: 'Board', colorKey: 'green' });
  });

  it('does not delete an epic that still has stories, but deletes an empty one', async () => {
    const user = userEvent.setup();
    const repository = await openEpics();
    await user.click(screen.getByRole('button', { name: /^Boards/ }));
    let dialog = screen.getByRole('dialog', { name: 'Boards' });
    expect(within(dialog).getByRole('button', { name: 'Delete epic' })).toBeDisabled();
    expect(within(dialog).getByText('Used by 2 stories. Move them to another epic first.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));

    await user.click(screen.getByRole('button', { name: 'New epic' }));
    dialog = screen.getByRole('dialog', { name: 'New epic' });
    await user.type(within(dialog).getByLabelText('Name'), 'Empty');
    await user.click(within(dialog).getByRole('button', { name: 'Add epic' }));
    await user.click(screen.getByRole('button', { name: /^Empty/ }));
    await user.click(within(screen.getByRole('dialog', { name: 'Empty' })).getByRole('button', { name: 'Delete epic' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Empty/ })).not.toBeInTheDocument();
    expect((await repository.load()).epics.some((e) => e.name === 'Empty')).toBe(false);
  });
});

describe('story map', () => {
  async function openMap(): Promise<LocalStorageRepository> {
    const user = userEvent.setup();
    const repository = await renderApp();
    await user.click(screen.getByRole('link', { name: 'Story Map' }));
    await screen.findByRole('heading', { name: 'Story Map', level: 1 });
    return repository;
  }
  const cell = (sprint: string, epic: string): HTMLElement => screen.getByRole('list', { name: `${sprint} ${epic}` });

  it('shows epics as columns and the running and future sprints as rows, with "Not planned" last', async () => {
    await openMap();
    expect(screen.getByText('4 epics · 2 sprints · 7 stories')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Sprint 1, .+, running$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Sprint 2/ })).toBeInTheDocument();
    expect(within(cell('Sprint 1', 'Boards')).getAllByRole('group').map((card) => card.getAttribute('aria-label'))).toEqual([
      'S-1: Create a story with title and description',
      'S-2: Tick off acceptance criteria'
    ]);
    expect(within(cell('Not planned', 'Backlog')).getByRole('group', { name: 'S-7: Plan releases on a story map' })).toBeInTheDocument();
    expect(within(cell('Sprint 2', 'Boards')).queryAllByRole('group')).toHaveLength(0);
  });

  it('makes every card a keyboard stop that opens with Enter', async () => {
    const user = userEvent.setup();
    await openMap();
    const card = within(cell('Sprint 1', 'Local storage')).getByRole('group', { name: /S-4/ });
    expect(card).toHaveAttribute('tabindex', '0');
    card.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: 'S-4: Keep all data in a local database' })).toBeInTheDocument();
  });

  it('adds a sprint after the last one, prefilled for two weeks', async () => {
    const user = userEvent.setup();
    const repository = await openMap();
    await user.click(screen.getAllByRole('button', { name: '+ Sprint' })[0]);
    const dialog = screen.getByRole('dialog', { name: 'New sprint' });
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Sprint 3');
    const sprint2 = (await repository.load()).sprints.find((sprint) => sprint.id === 'sprint-2');
    expect(within(dialog).getByLabelText('Start')).toHaveValue(addDays(sprint2?.endDate ?? '', 1));
    await user.click(within(dialog).getByRole('button', { name: 'Add sprint' }));

    expect(screen.getByRole('button', { name: /^Sprint 3/ })).toBeInTheDocument();
    expect((await repository.load()).sprints.map((sprint) => sprint.name)).toContain('Sprint 3');
  });

  it('refuses a sprint that ends before it starts', async () => {
    const user = userEvent.setup();
    await openMap();
    await user.click(screen.getAllByRole('button', { name: '+ Sprint' })[0]);
    const dialog = screen.getByRole('dialog', { name: 'New sprint' });
    const end = within(dialog).getByLabelText('End');
    await user.clear(end);
    await user.type(end, '2000-01-01');
    await user.click(within(dialog).getByRole('button', { name: 'Add sprint' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('the end cannot be before the start');
  });

  it('edits a sprint from its label', async () => {
    const user = userEvent.setup();
    const repository = await openMap();
    await user.click(screen.getByRole('button', { name: /^Sprint 2/ }));
    const dialog = screen.getByRole('dialog', { name: 'Edit sprint' });
    await user.clear(within(dialog).getByLabelText('Name'));
    await user.type(within(dialog).getByLabelText('Name'), 'Release prep');
    await user.clear(within(dialog).getByLabelText('Start'));
    await user.type(within(dialog).getByLabelText('Start'), '2020-01-06');
    await user.clear(within(dialog).getByLabelText('End'));
    await user.type(within(dialog).getByLabelText('End'), '2020-01-19');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('button', { name: /^Release prep/ })).toBeInTheDocument();
    expect((await repository.load()).sprints.find((sprint) => sprint.id === 'sprint-2')).toMatchObject({
      name: 'Release prep',
      startDate: '2020-01-06',
      endDate: '2020-01-19'
    });
    await user.click(screen.getByRole('link', { name: 'Backlog' }));
    expect(await screen.findByRole('region', { name: 'Release prep' })).toBeInTheDocument();
  });

  it('adds an epic as a new column', async () => {
    const user = userEvent.setup();
    const repository = await openMap();
    await user.click(screen.getByRole('button', { name: 'Add epic' }));
    const dialog = screen.getByRole('dialog', { name: 'New epic' });
    await user.type(within(dialog).getByLabelText('Name'), 'Reporting');
    await user.click(within(dialog).getByRole('button', { name: 'Add epic' }));
    expect(cell('Sprint 1', 'Reporting')).toBeInTheDocument();
    expect((await repository.load()).epics.find((epic) => epic.name === 'Reporting')?.position).toBe(4);
  });

  it('creates a story directly in a cell with epic and sprint of that cell (quick add)', async () => {
    const user = userEvent.setup();
    const repository = await openMap();
    await user.click(screen.getByRole('button', { name: 'New story in Local storage, Sprint 2' }));
    await user.type(screen.getByRole('textbox', { name: 'Title of the new story in Sprint 2, Local storage' }), 'Back up the database{Enter}');

    expect(within(cell('Sprint 2', 'Local storage')).getByRole('group', { name: 'S-8: Back up the database' })).toBeInTheDocument();
    expect((await repository.load()).stories.find((story) => story.code === 'S-8')).toMatchObject({
      epicId: 'epic-storage',
      sprintId: 'sprint-2'
    });
  });

  it('has the "New story" button at the top like every page, and "+ Sprint" only in the map', async () => {
    await openMap();
    const head = screen.getByRole('heading', { name: 'Story Map', level: 1 }).parentElement as HTMLElement;
    expect(within(head).getByRole('button', { name: 'New story' })).toBeInTheDocument();
    expect(within(head).queryByRole('button', { name: '+ Sprint' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '+ Sprint' })).toHaveLength(1);
  });

  it('opens an epic from its column header', async () => {
    const user = userEvent.setup();
    await openMap();
    await user.click(screen.getByRole('button', { name: /^Local storage1 story/ }));
    expect(screen.getByRole('dialog', { name: 'Local storage' })).toBeInTheDocument();
  });

  it('switches to compact cards and remembers the choice', async () => {
    const user = userEvent.setup();
    await openMap();
    const toggle = screen.getByRole('button', { name: 'Compact' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelector('.map--compact')).not.toBeNull();
    expect(window.localStorage.getItem('getitdone.mapCompact')).toBe('true');
    await user.click(toggle);
    expect(document.querySelector('.map--compact')).toBeNull();
  });

  it('lets only sprints that have not started be dragged', async () => {
    await openMap();
    expect(screen.getByRole('button', { name: /^Sprint 2/ })).toHaveAttribute('aria-roledescription', 'sprint');
    expect(screen.getByRole('button', { name: /^Sprint 1/ })).not.toHaveAttribute('aria-roledescription');
  });

  it('marks nothing as a drop target at rest', async () => {
    await openMap();
    expect(document.querySelector('[data-drop-target]')).toBeNull();
    expect(document.querySelector('.map-epic--target, .map-sprint--target')).toBeNull();
  });
});

describe('sprints on the board', () => {
  it('asks to create a sprint when there is none', async () => {
    const snapshot = seedSnapshot('2026-10-11');
    window.localStorage.setItem(
      'getitdone.snapshot.v1',
      JSON.stringify({ ...snapshot, sprints: [], stories: snapshot.stories.map((story) => ({ ...story, sprintId: null })) })
    );
    render(<App repository={new LocalStorageRepository()} />);
    expect(await screen.findByRole('heading', { name: 'No sprint yet', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create one on the story map' })).toHaveAttribute('href', '#/map');
  });

  it('migrates browser data of release 0.1 to a running "Sprint 1"', async () => {
    const snapshot = seedSnapshot('2026-10-11');
    const old = {
      epics: snapshot.epics.map(({ position: _position, ...epic }) => ({ ...epic, colorKey: 'boards' })),
      stories: snapshot.stories.map(({ sprintId, ...story }) => ({ ...story, inSprint: sprintId !== null }))
    };
    window.localStorage.setItem('getitdone.snapshot.v1', JSON.stringify(old));
    render(<App repository={new LocalStorageRepository()} />);
    expect(await screen.findByRole('heading', { name: 'Sprint 1', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/6 stories · 23 points/)).toBeInTheDocument();
    const stored = JSON.parse(window.localStorage.getItem('getitdone.snapshot.v1') ?? '{}');
    expect(stored.sprints).toHaveLength(1);
  });
});

describe('fields', () => {
  async function openFields(): Promise<LocalStorageRepository> {
    const repository = await renderApp();
    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: 'Settings' }));
    await screen.findByRole('heading', { level: 2, name: 'Fields' });
    return repository;
  }

  async function openStory(code: RegExp): Promise<void> {
    window.location.hash = '#/board';
    const user = userEvent.setup();
    await user.dblClick(await screen.findByRole('group', { name: code }));
    await screen.findByRole('dialog', { name: code });
  }

  it('closes the settings with the gear and goes back to the page shown before', async () => {
    const user = userEvent.setup();
    render(<App repository={new LocalStorageRepository()} />);
    await screen.findByRole('heading', { name: 'Sprint 1', level: 1 });
    await user.click(screen.getByRole('link', { name: 'Backlog' }));
    await user.click(screen.getByRole('link', { name: 'Settings' }));
    expect(window.location.hash).toBe('#/settings/fields');
    await user.click(screen.getByRole('link', { name: 'Close settings' }));
    expect(window.location.hash).toBe('#/backlog');
    expect(await screen.findByRole('heading', { name: 'Backlog', level: 1 })).toBeInTheDocument();
  });

  it('opens the fields from the settings, not from the main navigation', async () => {
    await openFields();
    const main = screen.getByRole('navigation', { name: 'Main' });
    expect(within(main).queryByRole('link', { name: 'Fields' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Close settings' })).toHaveAttribute('aria-current', 'page');
    expect(window.location.hash).toBe('#/settings/fields');
    const sections = screen.getByRole('navigation', { name: 'Settings sections' });
    expect(within(sections).getByRole('link', { name: 'Fields' })).toHaveAttribute('aria-current', 'page');
    expect(within(sections).getByRole('link', { name: 'Status values' })).toHaveAttribute('href', '#/settings/statuses');
  });

  it('shows a matrix of fields and item types with fixed system and built-in fields', async () => {
    await openFields();
    expect(screen.getByRole('columnheader', { name: 'Stories' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Epics' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /^Sprints\s*Planned/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Releases' })).toBeInTheDocument();
    expect(screen.getByText('System fields')).toBeInTheDocument();
    expect(screen.getByText('Custom fields')).toBeInTheDocument();

    const titleForEpics = screen.getByRole('checkbox', { name: 'Title for Epics. System field, always used' });
    expect(titleForEpics).toBeChecked();
    expect(titleForEpics).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Points for Stories' })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: 'Epic for Stories. The epic cannot be hidden for now' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Rename field Key' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rename field Title' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /^Points for Epics/ })).not.toBeInTheDocument();
    expect(screen.getByText('Points does not exist for Epics')).toBeInTheDocument();

    expect(screen.getByRole('checkbox', { name: 'Priority for Stories' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Priority for Epics' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Business value for Epics' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Business value for Epics' })).toBeEnabled();
    const title = screen.getByRole('row', { name: /^Title / });
    expect(within(title).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual(['Rename field Title']);
    expect(screen.getByRole('button', { name: 'Edit field Priority' })).toBeInTheDocument();
  });

  it('puts a field on epics and edits its value in the epic dialog', async () => {
    const user = userEvent.setup();
    const repository = await openFields();
    await user.click(screen.getByRole('checkbox', { name: 'Business value for Epics' }));
    expect(screen.getByRole('checkbox', { name: 'Business value for Epics' })).toBeChecked();

    await user.click(screen.getByRole('link', { name: 'Epics' }));
    await user.click(await screen.findByRole('button', { name: /Local storage/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Local storage' });
    expect(within(dialog).getByLabelText('Priority')).toHaveValue('');
    await user.selectOptions(within(dialog).getByLabelText('Priority'), 'Could');
    const value = within(dialog).getByLabelText('Business value');
    await user.type(value, '13');
    await user.tab();

    const saved = await repository.load();
    expect(saved.assignments.some((item) => item.fieldId === 'field-demo-value' && item.itemType === 'epic')).toBe(true);
    expect(saved.epics.find((epic) => epic.id === 'epic-storage')?.values).toEqual({
      'field-demo-priority': 'opt-could',
      'field-demo-value': 13
    });
  });

  it('creates a select field that appears on the story page and saves its value', async () => {
    const user = userEvent.setup();
    const repository = await openFields();
    await user.click(screen.getByRole('button', { name: 'New field' }));
    const dialog = screen.getByRole('dialog', { name: 'New field' });
    await user.type(within(dialog).getByLabelText('Name'), 'Risk');
    await user.selectOptions(within(dialog).getByLabelText('Type'), 'single_select');
    await user.type(within(dialog).getByRole('textbox', { name: 'Option 1' }), 'Low');
    await user.click(within(dialog).getByRole('button', { name: 'Add option' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Option 2' }), 'High');
    await user.selectOptions(within(dialog).getByLabelText('Colour of option 2'), 'rose');
    expect(within(dialog).getByRole('checkbox', { name: 'Stories' })).toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: 'Add field' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('row', { name: /^Risk / })).toBeInTheDocument();

    await openStory(/S-3:/);
    await user.selectOptions(await screen.findByLabelText('Risk'), 'High');
    const saved = await repository.load();
    const risk = saved.fields.find((field) => field.label === 'Risk');
    expect(risk?.options.map((option) => [option.label, option.colorKey])).toEqual([
      ['Low', 'blue'],
      ['High', 'rose']
    ]);
    expect(saved.stories.find((s) => s.id === 'story-3')?.values[risk?.id ?? '']).toBe(risk?.options[1].id);
  });

  it('explains what is wrong with a new field', async () => {
    const user = userEvent.setup();
    await openFields();
    await user.click(screen.getByRole('button', { name: 'New field' }));
    const dialog = screen.getByRole('dialog', { name: 'New field' });
    await user.click(within(dialog).getByRole('button', { name: 'Add field' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a name.');
    await user.type(within(dialog).getByLabelText('Name'), 'priority');
    await user.click(within(dialog).getByRole('button', { name: 'Add field' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('A field with this name already exists.');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renames a field and removes an option together with its values', async () => {
    const user = userEvent.setup();
    const repository = await openFields();
    await user.click(screen.getByRole('button', { name: 'Edit field Priority' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit field' });
    const type = within(dialog).getByLabelText('Type');
    expect(within(type).getAllByRole('option').map((option) => option.textContent)).toEqual(['Single select', 'Multi select']);
    expect(within(dialog).getByText('Only type changes that keep every value are offered.')).toBeInTheDocument();
    const name = within(dialog).getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Importance');
    await user.click(within(dialog).getByRole('button', { name: 'Remove option 3' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('row', { name: /^Importance / })).toBeInTheDocument();
    const saved = await repository.load();
    const field = saved.fields.find((item) => item.id === 'field-demo-priority');
    expect(field?.label).toBe('Importance');
    expect(field?.options.map((option) => option.label)).toEqual(['Must', 'Should']);
    expect(saved.stories.find((s) => s.id === 'story-6')?.values['field-demo-priority']).toBeUndefined();
    expect(saved.stories.find((s) => s.id === 'story-1')?.values['field-demo-priority']).toBe('opt-must');
  });

  it('takes a field off stories without losing its values', async () => {
    const user = userEvent.setup();
    const repository = await openFields();
    await user.click(screen.getByRole('checkbox', { name: 'Business value for Stories' }));
    expect(screen.getByRole('checkbox', { name: 'Business value for Stories' })).not.toBeChecked();

    await openStory(/S-1:/);
    await screen.findByLabelText('Priority');
    expect(screen.queryByLabelText('Business value')).not.toBeInTheDocument();
    expect((await repository.load()).stories.find((s) => s.id === 'story-1')?.values['field-demo-value']).toBe(8);
  });

  it('deletes a field after saying how many stories lose a value', async () => {
    const user = userEvent.setup();
    const repository = await openFields();
    await user.click(screen.getByRole('button', { name: 'Delete field Priority' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete field Priority' });
    expect(dialog).toHaveTextContent('5 stories lose their value.');
    expect(dialog).toHaveTextContent('2 epics lose their value.');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(screen.queryByRole('row', { name: /^Priority / })).not.toBeInTheDocument();
    const saved = await repository.load();
    expect(saved.fields.some((field) => field.id === 'field-demo-priority')).toBe(false);
    expect(saved.stories.every((story) => story.values['field-demo-priority'] === undefined)).toBe(true);
  });

  it('edits text and number values on the story page', async () => {
    const user = userEvent.setup();
    const repository = await openFields();
    await user.click(screen.getByRole('button', { name: 'New field' }));
    const dialog = screen.getByRole('dialog', { name: 'New field' });
    await user.type(within(dialog).getByLabelText('Name'), 'Customer');
    await user.click(within(dialog).getByRole('button', { name: 'Add field' }));

    await openStory(/S-3:/);
    await user.click(await screen.findByRole('button', { name: /edit Customer/ }));
    await user.type(screen.getByRole('textbox', { name: 'Customer' }), ' ACME {Enter}');
    const value = screen.getByLabelText('Business value');
    expect(value).toHaveValue('5');
    await user.clear(value);
    await user.type(value, 'lots{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a number.');
    expect(value).toHaveAttribute('aria-invalid', 'true');
    await user.clear(value);
    await user.type(value, '7,5');
    await user.tab();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    const saved = await repository.load();
    const customer = saved.fields.find((field) => field.label === 'Customer');
    expect(saved.stories.find((s) => s.id === 'story-3')?.values).toMatchObject({
      [customer?.id ?? '']: 'ACME',
      'field-demo-value': 7.5
    });
  });

  it('makes a field required, so the new story dialog asks for it, with defaults filled in', async () => {
    const user = userEvent.setup();
    const repository = await openFields();
    await user.click(screen.getByRole('tab', { name: 'Layout' }));
    expect(screen.getByRole('tab', { name: 'Stories' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByText('Fixed position').length).toBeGreaterThan(0);
    const custom = screen.getByRole('list', { name: 'Custom fields' });
    const value = within(custom).getAllByRole('listitem')[1];
    expect(value).toHaveTextContent('Business value');
    await user.click(within(value).getByRole('checkbox', { name: 'Required' }));
    expect(within(value).getByRole('checkbox', { name: 'In create dialog' })).toBeDisabled();
    expect(within(value).getByRole('checkbox', { name: 'In create dialog' })).toBeChecked();

    window.location.hash = '#/board';
    await user.click(await screen.findByRole('button', { name: 'New story' }));
    const dialog = screen.getByRole('dialog', { name: 'New story' });
    expect(within(dialog).getByLabelText('Priority')).toHaveDisplayValue('Should');
    await user.type(within(dialog).getByLabelText('Title'), 'Needs a value');
    await user.click(within(dialog).getByRole('button', { name: 'Add story' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Please fill in: Business value');
    await user.type(within(dialog).getByLabelText(/^Business value/), '3');
    await user.tab();
    await user.click(within(dialog).getByRole('button', { name: 'Add story' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const saved = (await repository.load()).stories.find((story) => story.title === 'Needs a value');
    expect(saved?.values).toEqual({ 'field-demo-priority': 'opt-should', 'field-demo-value': 3 });
  });

  it('does not let a required field be cleared in the story dialog', async () => {
    const user = userEvent.setup();
    const repository = await openFields();
    await user.click(screen.getByRole('tab', { name: 'Layout' }));
    const custom = screen.getByRole('list', { name: 'Custom fields' });
    await user.click(within(within(custom).getAllByRole('listitem')[0]).getByRole('checkbox', { name: 'Required' }));

    await openStory(/S-1:/);
    await user.selectOptions(screen.getByLabelText(/^Priority/), 'No value');
    expect(screen.getByRole('alert')).toHaveTextContent('This field is required.');
    expect((await repository.load()).stories.find((s) => s.id === 'story-1')?.values['field-demo-priority']).toBe('opt-must');
  });

  it('shows the values of the fields chosen for the card', async () => {
    await renderApp();
    const card = screen.getByRole('group', { name: 'S-1: Create a story with title and description' });
    expect(within(card).getByText('Must')).toBeInTheDocument();
    expect(within(card).getByText('Priority:')).toHaveClass('sr-only');
  });

  it('sets a default value in the field dialog', async () => {
    const user = userEvent.setup();
    const repository = await openFields();
    await user.click(screen.getByRole('button', { name: 'Edit field Business value' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit field' });
    await user.type(within(dialog).getByLabelText('Default value'), '5');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect((await repository.load()).fields.find((field) => field.id === 'field-demo-value')?.defaultValue).toBe(5);
  });

  it('creates date, checkbox, multi select and link fields and fills them in', async () => {
    const user = userEvent.setup();
    const repository = await openFields();
    const create = async (name: string, type: string, options: string[] = []): Promise<void> => {
      await user.click(screen.getByRole('button', { name: 'New field' }));
      const dialog = screen.getByRole('dialog', { name: 'New field' });
      await user.type(within(dialog).getByLabelText('Name'), name);
      await user.selectOptions(within(dialog).getByLabelText('Type'), type);
      for (const [index, option] of options.entries()) {
        if (index > 0) await user.click(within(dialog).getByRole('button', { name: 'Add option' }));
        await user.type(within(dialog).getByRole('textbox', { name: `Option ${index + 1}` }), option);
      }
      await user.click(within(dialog).getByRole('button', { name: 'Add field' }));
    };
    await create('Due', 'date');
    await create('Reviewed', 'checkbox');
    await create('Platforms', 'multi_select', ['Windows', 'Web']);
    await create('Design', 'url');

    await openStory(/S-3:/);
    const dialog = screen.getByRole('dialog', { name: /S-3:/ });
    await user.type(within(dialog).getByLabelText('Due'), '2026-12-24');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Reviewed' }));
    const platforms = within(dialog).getByRole('group', { name: 'Platforms' });
    await user.click(within(platforms).getByRole('checkbox', { name: 'Web' }));
    await user.click(within(platforms).getByRole('checkbox', { name: 'Windows' }));
    await user.click(within(dialog).getByRole('button', { name: /edit Design/ }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Design' }), 'not a link{Enter}');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a web address');
    await user.click(within(dialog).getByRole('button', { name: /edit Design/ }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Design' }), 'figma.com/file/1{Enter}');
    expect(within(dialog).getByRole('link', { name: 'Open Design' })).toHaveAttribute('href', 'https://figma.com/file/1');

    const saved = await repository.load();
    const id = (name: string) => saved.fields.find((field) => field.label === name)?.id ?? '';
    const platformField = saved.fields.find((field) => field.label === 'Platforms');
    expect(saved.stories.find((s) => s.id === 'story-3')?.values).toMatchObject({
      [id('Due')]: '2026-12-24',
      [id('Reviewed')]: true,
      [id('Platforms')]: platformField?.options.map((option) => option.id),
      [id('Design')]: 'https://figma.com/file/1'
    });
  });

  it('turns a single select into a multi select and keeps the values', async () => {
    const user = userEvent.setup();
    const repository = await openFields();
    await user.click(screen.getByRole('button', { name: 'Edit field Priority' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit field' });
    await user.selectOptions(within(dialog).getByLabelText('Type'), 'multi_select');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    const saved = await repository.load();
    expect(saved.fields.find((field) => field.id === 'field-demo-priority')?.dataType).toBe('multi_select');
    expect(saved.fields.find((field) => field.id === 'field-demo-priority')?.defaultValue).toEqual(['opt-should']);
    expect(saved.stories.find((s) => s.id === 'story-1')?.values['field-demo-priority']).toEqual(['opt-must']);
    expect(saved.epics.find((e) => e.id === 'epic-boards')?.values['field-demo-priority']).toEqual(['opt-must']);
  });

  it('hides points, so the board, cards and dialogs leave them out, and shows them again', async () => {
    const user = userEvent.setup();
    const repository = await openFields();
    await user.click(screen.getByRole('checkbox', { name: 'Points for Stories' }));

    window.location.hash = '#/board';
    expect(await screen.findByText(/· 6 stories$/)).toBeInTheDocument();
    const card = screen.getByRole('group', { name: /S-1:/ });
    expect(within(card).queryByTitle('3 points')).not.toBeInTheDocument();
    await openStory(/S-1:/);
    expect(screen.queryByLabelText('Points')).not.toBeInTheDocument();
    expect((await repository.load()).stories.find((s) => s.id === 'story-1')?.points).toBe(3);

    await user.keyboard('{Escape}');
    window.location.hash = '#/settings/fields';
    await user.click(await screen.findByRole('checkbox', { name: 'Points for Stories' }));
    window.location.hash = '#/board';
    expect(await screen.findByText(/· 6 stories · 23 points$/)).toBeInTheDocument();
  });

  it('hides acceptance criteria, description and epic colour', async () => {
    const user = userEvent.setup();
    await openFields();
    await user.click(screen.getByRole('checkbox', { name: 'Acceptance criteria for Stories' }));
    await user.click(screen.getByRole('checkbox', { name: 'Description for Stories' }));
    await user.click(screen.getByRole('checkbox', { name: 'Colour for Epics' }));

    window.location.hash = '#/board';
    const card = await screen.findByRole('group', { name: /S-1:/ });
    expect(within(card).queryByRole('img', { name: /criteria accepted/ })).not.toBeInTheDocument();
    expect(card.querySelector('.epic')).not.toBeNull();
    expect(card.querySelector('.epic .epic__dot')).toBeNull();
    await openStory(/S-1:/);
    expect(screen.queryByRole('heading', { name: 'Acceptance criteria' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Description' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'New story' }));
    expect(within(screen.getByRole('dialog', { name: 'New story' })).queryByLabelText('Description')).not.toBeInTheDocument();
  });

  it('renames built-in and system fields with one label and resets them', async () => {
    const user = userEvent.setup();
    const repository = await openFields();
    await user.click(screen.getByRole('button', { name: 'Rename field Points' }));
    let dialog = screen.getByRole('dialog', { name: 'Rename field' });
    expect(within(dialog).getByText('The new name is shown in every language. The default is "Points".')).toBeInTheDocument();
    const name = within(dialog).getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Effort');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('rowheader', { name: 'Effort' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Rename field Status' }));
    dialog = screen.getByRole('dialog', { name: 'Rename field' });
    await user.clear(within(dialog).getByLabelText('Name'));
    await user.type(within(dialog).getByLabelText('Name'), 'State');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    window.location.hash = '#/board';
    expect(await screen.findByText(/· 6 stories · 23 Effort$/)).toBeInTheDocument();
    await openStory(/S-1:/);
    expect(screen.getByLabelText('Effort')).toBeInTheDocument();
    expect(screen.getByLabelText('State')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.selectOptions(screen.getByLabelText('Language'), 'de');
    window.location.hash = '#/settings/fields';
    expect(await screen.findByRole('rowheader', { name: 'Effort' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Feld Effort umbenennen' }));
    await user.click(screen.getByRole('button', { name: 'Auf «Punkte» zurücksetzen' }));
    expect(screen.getByRole('rowheader', { name: 'Punkte' })).toBeInTheDocument();
    const saved = await repository.load();
    expect(saved.fields.find((field) => field.builtinKey === 'points')?.label).toBeNull();
    expect(saved.fields.find((field) => field.builtinKey === 'status')?.label).toBe('State');
  });

  it('adds a text field for stories and epics, shows it everywhere and keeps its values after a reload', async () => {
    const user = userEvent.setup();
    const repository = await openFields();
    await user.click(screen.getByRole('button', { name: 'New field' }));
    const dialog = screen.getByRole('dialog', { name: 'New field' });
    await user.type(within(dialog).getByLabelText('Name'), 'Customer');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Epics' }));
    await user.click(within(dialog).getByRole('button', { name: 'Add field' }));

    expect(screen.getByRole('checkbox', { name: 'Customer for Stories' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Customer for Epics' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Edit field Customer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete field Customer' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Layout' }));
    expect(screen.getByText('Customer')).toBeInTheDocument();

    await openStory(/S-3:/);
    await user.click(screen.getByRole('button', { name: /edit Customer/ }));
    await user.type(screen.getByRole('textbox', { name: 'Customer' }), 'ACME{Enter}');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('link', { name: 'Epics' }));
    await screen.findByRole('heading', { name: 'Epics', level: 1 });
    await user.click(screen.getByRole('button', { name: /^Local storage/ }));
    const epic = await screen.findByRole('dialog', { name: 'Local storage' });
    await user.click(within(epic).getByRole('button', { name: /edit Customer/ }));
    await user.type(within(epic).getByRole('textbox', { name: 'Customer' }), 'Internal{Enter}');

    const saved = await repository.load();
    const customer = saved.fields.find((field) => field.label === 'Customer');
    expect(customer).toMatchObject({ kind: 'custom', dataType: 'text' });
    expect(saved.stories.find((s) => s.id === 'story-3')?.values[customer?.id ?? '']).toBe('ACME');
    expect(saved.epics.find((e) => e.id === 'epic-storage')?.values[customer?.id ?? '']).toBe('Internal');

    cleanup();
    window.location.hash = '#/board';
    await renderApp();
    await openStory(/S-3:/);
    expect(screen.getByRole('button', { name: /edit Customer/ })).toHaveTextContent('ACME');
  });

  it('offers no way to delete, edit or switch off system fields and the epic', async () => {
    const user = userEvent.setup();
    const repository = await openFields();
    const before = await repository.load();
    for (const name of ['Key', 'Title', 'Status', 'Description', 'Epic', 'Points', 'Acceptance criteria', 'Colour']) {
      expect(screen.queryByRole('button', { name: `Delete field ${name}` }), name).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: `Edit field ${name}` }), name).not.toBeInTheDocument();
    }
    expect(screen.getAllByRole('button', { name: /^Delete field / })).toHaveLength(4);

    const locked = [
      screen.getByRole('checkbox', { name: 'Key for Stories. System field, always used' }),
      screen.getByRole('checkbox', { name: 'Title for Stories. System field, always used' }),
      screen.getByRole('checkbox', { name: 'Title for Epics. System field, always used' }),
      screen.getByRole('checkbox', { name: 'Status for Stories. System field, always used' }),
      screen.getByRole('checkbox', { name: 'Epic for Stories. The epic cannot be hidden for now' })
    ];
    for (const checkbox of locked) {
      expect(checkbox).toBeDisabled();
      await user.click(checkbox);
      expect(checkbox).toBeChecked();
    }
    const after = await repository.load();
    expect(after.fields).toEqual(before.fields);
    expect(after.assignments).toEqual(before.assignments);
  });

  it('renames title, description, epic, criteria and colour and uses the names in every dialog, also after a reload', async () => {
    const user = userEvent.setup();
    const repository = await openFields();
    const rename = async (from: string, to: string): Promise<void> => {
      await user.click(screen.getByRole('button', { name: `Rename field ${from}` }));
      const dialog = screen.getByRole('dialog', { name: 'Rename field' });
      await user.clear(within(dialog).getByLabelText('Name'));
      if (to) await user.type(within(dialog).getByLabelText('Name'), to);
      await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    };
    await rename('Title', 'Summary');
    await rename('Description', 'Background');
    await rename('Epic', 'Theme');
    await rename('Acceptance criteria', 'Done when');
    await rename('Colour', 'Tint');
    for (const name of ['Summary', 'Background', 'Theme', 'Done when', 'Tint']) {
      expect(screen.getByRole('rowheader', { name }), name).toBeInTheDocument();
    }
    await user.click(screen.getByRole('tab', { name: 'Layout' }));
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Done when')).toBeInTheDocument();

    await openStory(/S-1:/);
    expect(screen.getByRole('button', { name: /edit Summary/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Background' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Done when' })).toBeInTheDocument();
    expect(screen.getByLabelText('Theme')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'New story' }));
    const create = screen.getByRole('dialog', { name: 'New story' });
    expect(within(create).getByLabelText('Summary')).toBeInTheDocument();
    expect(within(create).getByLabelText('Background')).toBeInTheDocument();
    expect(within(create).getByLabelText('Theme')).toBeInTheDocument();
    await user.click(within(create).getByRole('button', { name: 'Cancel' }));

    window.location.hash = '#/epics';
    await user.click(await screen.findByRole('button', { name: 'New epic' }));
    const newEpic = screen.getByRole('dialog', { name: 'New epic' });
    expect(within(newEpic).getByLabelText('Summary')).toBeInTheDocument();
    expect(within(newEpic).getByRole('group', { name: 'Tint' })).toBeInTheDocument();

    cleanup();
    window.location.hash = '#/board';
    await renderApp();
    window.location.hash = '#/settings/fields';
    expect(await screen.findByRole('rowheader', { name: 'Summary' })).toBeInTheDocument();
    await rename('Theme', '');
    expect(screen.getByRole('rowheader', { name: 'Epic' })).toBeInTheDocument();
    const saved = await repository.load();
    expect(saved.fields.find((field) => field.builtinKey === 'title')?.label).toBe('Summary');
    expect(saved.fields.find((field) => field.builtinKey === 'epic')?.label).toBeNull();
  });

  it('offers only the type changes that keep every value and converts a number to text', async () => {
    const user = userEvent.setup();
    const repository = await openFields();
    const typesOf = async (name: string): Promise<(string | null)[]> => {
      await user.click(screen.getByRole('button', { name: `Edit field ${name}` }));
      const dialog = screen.getByRole('dialog', { name: 'Edit field' });
      return within(within(dialog).getByLabelText('Type')).getAllByRole('option').map((option) => option.textContent);
    };
    const cancel = async (): Promise<void> => {
      await user.click(within(screen.getByRole('dialog', { name: 'Edit field' })).getByRole('button', { name: 'Cancel' }));
    };
    expect(await typesOf('Spec')).toEqual(['Link', 'Text']);
    await cancel();
    expect(await typesOf('Labels')).toEqual(['Multi select']);
    expect(screen.getByText('The type of this field cannot change without losing values. Create a new field instead.')).toBeInTheDocument();
    await cancel();
    expect(await typesOf('Business value')).toEqual(['Number', 'Text']);
    const dialog = screen.getByRole('dialog', { name: 'Edit field' });
    await user.selectOptions(within(dialog).getByLabelText('Type'), 'text');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    const saved = await repository.load();
    expect(saved.fields.find((field) => field.id === 'field-demo-value')?.dataType).toBe('text');
    expect(saved.stories.find((s) => s.id === 'story-1')?.values['field-demo-value']).toBe('8');
    expect(await typesOf('Business value')).toEqual(['Text', 'Long text']);
    await cancel();
    await openStory(/S-1:/);
    expect(screen.getByRole('button', { name: /edit Business value/ })).toHaveTextContent('8');
  });

  it('creates a story without an epic and clears the epic of a story', async () => {
    const user = userEvent.setup();
    const repository = await renderApp();
    await user.click(screen.getByRole('button', { name: 'New story' }));
    const dialog = screen.getByRole('dialog', { name: 'New story' });
    expect(within(dialog).getByLabelText('Epic')).toHaveValue('');
    await user.type(within(dialog).getByLabelText('Title'), 'Loose story');
    await user.click(within(dialog).getByRole('button', { name: 'Add story' }));
    expect(screen.getByRole('group', { name: 'S-8: Loose story' })).toBeInTheDocument();

    await openStory(/S-3:/);
    await user.selectOptions(await screen.findByLabelText('Epic'), 'No epic');
    const saved = await repository.load();
    expect(saved.stories.find((s) => s.code === 'S-8')?.epicId).toBeNull();
    expect(saved.stories.find((s) => s.id === 'story-3')?.epicId).toBeNull();
  });

  it('shows stories without an epic in their own column on the story map', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole('link', { name: 'Story Map' }));
    await screen.findByRole('heading', { name: 'Story Map', level: 1 });
    expect(screen.queryByText('No epic')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Plan releases on a story map' }));
    await user.selectOptions(await screen.findByLabelText('Epic'), 'No epic');
    await user.keyboard('{Escape}');
    const cell = screen.getByRole('list', { name: 'Not planned No epic' });
    expect(within(cell).getByRole('group', { name: 'S-7: Plan releases on a story map' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New story in No epic, Not planned' })).toBeInTheDocument();
  });

  it('opens data of release 0.1 and adds the built-in fields', async () => {
    const old = {
      epics: [{ id: 'e', name: 'Old', colorKey: 'boards' }],
      stories: [
        { id: 's', code: 'S-1', title: 'Old story', description: '', epicId: 'e', points: 2, status: 'todo', inSprint: true, rank: 0, criteria: [] }
      ]
    };
    window.localStorage.setItem('getitdone.snapshot.v1', JSON.stringify(old));
    const repository = new LocalStorageRepository();
    render(<App repository={repository} />);
    expect(await screen.findByRole('group', { name: 'S-1: Old story' })).toBeInTheDocument();
    const saved = await repository.load();
    expect(saved.fields.map((field) => field.builtinKey)).toContain('points');
    expect(saved.stories[0].values).toEqual({});
  });
});

describe('header', () => {
  it('switches the language and the document language', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.selectOptions(screen.getByLabelText('Language'), 'de');
    expect(screen.getByRole('region', { name: 'In Arbeit' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('de');
    await user.selectOptions(screen.getByLabelText('Sprache'), 'en');
  });

  it('switches the theme and remembers it', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('getitdone.theme')).toBe('dark');
    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('marks the current page', async () => {
    await renderApp();
    expect(screen.getByRole('link', { name: 'Board' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('router', () => {
  it('parses known routes and falls back to the board', () => {
    expect(parseHash('#/backlog')).toEqual({ name: 'backlog' });
    expect(parseHash('#/epics')).toEqual({ name: 'epics' });
    expect(parseHash('#/releases')).toEqual({ name: 'releases' });
    expect(parseHash('#/map')).toEqual({ name: 'map' });
    expect(parseHash('#/settings')).toEqual({ name: 'settings', section: 'fields' });
    expect(parseHash('#/settings/fields')).toEqual({ name: 'settings', section: 'fields' });
    expect(parseHash('#/fields')).toEqual({ name: 'settings', section: 'fields' });
    expect(parseHash('#/story/abc')).toEqual({ name: 'board' });
    expect(parseHash('')).toEqual({ name: 'board' });
    expect(parseHash('#/nonsense')).toEqual({ name: 'board' });
  });
});
