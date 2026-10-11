import { describe, expect, it, beforeAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
    expect(window.location.hash).toBe('#/story/story-3');
    expect(await screen.findByRole('heading', { level: 1, name: /Reorder the backlog by priority/ })).toBeInTheDocument();
  });

  it('opens a story on double click', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.dblClick(screen.getByRole('group', { name: 'S-4: Keep all data in a local database' }));
    expect(window.location.hash).toBe('#/story/story-4');
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
    expect(names).toEqual(['Sprint 1', 'Sprint 2', 'Not planned']);
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
    const main = screen.getByRole('main');
    expect(within(main).getAllByRole('button').map((b) => b.textContent)).toEqual(['New story']);
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
    expect(window.location.hash).toBe('#/story/story-7');
  });
});

describe('story detail', () => {
  it('ticks a criterion and updates the progress', async () => {
    const user = userEvent.setup();
    const repository = await renderApp();
    await user.click(screen.getByRole('link', { name: 'Create a story with title and description' }));

    expect(await screen.findByText('2 of 4 accepted')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'A new story appears in "To do"' }));
    expect(screen.getByText('3 of 4 accepted')).toBeInTheDocument();
    const saved = await repository.load();
    expect(saved.stories.find((s) => s.id === 'story-1')?.criteria.find((c) => c.id === 'c-1-3')?.done).toBe(true);
  });

  it('announces when every criterion is accepted', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole('link', { name: 'Tick off acceptance criteria' }));
    expect(screen.queryByText(/All criteria accepted/)).not.toBeInTheDocument();
    await user.click(await screen.findByRole('checkbox', { name: /marked as ready to merge/ }));
    expect(screen.getByText(/All criteria accepted/)).toHaveAttribute('role', 'status');
  });

  it('adds a criterion', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole('link', { name: 'Reorder the backlog by priority' }));
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

    expect(screen.getByRole('heading', { level: 1, name: /Prioritise the backlog/ })).toBeInTheDocument();
    const saved = await repository.load();
    expect(saved.stories.find((s) => s.id === 'story-3')?.title).toBe('Prioritise the backlog');
  });

  it('discards an edit with Escape and ignores an empty title', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.dblClick(screen.getByRole('group', { name: /S-3:/ }));
    await user.click(await screen.findByRole('button', { name: /edit Title/ }));
    await user.type(screen.getByRole('textbox', { name: 'Title' }), ' changed{Escape}');
    expect(screen.getByRole('heading', { level: 1, name: /^Reorder the backlog by priority/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /edit Title/ }));
    await user.clear(screen.getByRole('textbox', { name: 'Title' }));
    await user.keyboard('{Enter}');
    expect(screen.getByRole('heading', { level: 1, name: /^Reorder the backlog by priority/ })).toBeInTheDocument();
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
    await user.click(screen.getByRole('link', { name: 'Create a story with title and description' }));
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
    await user.click(screen.getByRole('link', { name: 'Create a story with title and description' }));
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
    expect(window.location.hash).toBe('#/board');
    expect(await screen.findByRole('heading', { name: 'Sprint 1', level: 1 })).toBeInTheDocument();
    expect(screen.queryByText('Reorder the backlog by priority')).not.toBeInTheDocument();
    expect((await repository.load()).stories.some((s) => s.id === 'story-3')).toBe(false);
  });

  it('shows a message for an unknown story', async () => {
    window.location.hash = '#/story/unknown';
    render(<App repository={new LocalStorageRepository()} />);
    expect(await screen.findByText('This story does not exist.')).toBeInTheDocument();
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
    expect(within(rows[0]).getByText('Boards')).toBeInTheDocument();
    expect(within(rows[0]).getByText('2 stories')).toBeInTheDocument();
  });

  it('shows only the colour dot of an epic, the palette opens on click', async () => {
    const user = userEvent.setup();
    const repository = await openEpics();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: 'Colour of Boards: Blue. Change colour' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await user.click(within(screen.getByRole('group', { name: 'Colour of Boards' })).getByRole('radio', { name: 'Green' }));

    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Colour of Boards: Green. Change colour' })).toHaveFocus();
    expect((await repository.load()).epics.find((e) => e.id === 'epic-boards')?.colorKey).toBe('green');
  });

  it('closes the palette with Escape without a change', async () => {
    const user = userEvent.setup();
    await openEpics();
    await user.click(screen.getByRole('button', { name: /Colour of Backlog/ }));
    await user.keyboard('{Escape}');
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

  it('renames an epic in place', async () => {
    const user = userEvent.setup();
    const repository = await openEpics();
    const row = screen.getAllByRole('listitem')[0];
    await user.click(within(row).getByRole('button', { name: /edit Name/ }));
    const field = within(row).getByRole('textbox', { name: 'Name' });
    await user.clear(field);
    await user.type(field, 'Board{Enter}');
    expect((await repository.load()).epics.find((e) => e.id === 'epic-boards')?.name).toBe('Board');
  });

  it('does not delete an epic that still has stories, but deletes an empty one', async () => {
    const user = userEvent.setup();
    const repository = await openEpics();
    expect(screen.getByRole('button', { name: 'Delete epic Boards' })).toBeDisabled();
    expect(screen.getAllByText('Used by 2 stories. Move them to another epic first.').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'New epic' }));
    await user.type(screen.getByLabelText('Name'), 'Empty');
    await user.click(screen.getByRole('button', { name: 'Add epic' }));
    await user.click(screen.getByRole('button', { name: 'Delete epic Empty' }));
    expect(screen.queryByText('Empty')).not.toBeInTheDocument();
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
    expect(window.location.hash).toBe('#/story/story-4');
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

  it('edits a sprint from its label and hides it once it is over', async () => {
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

    expect(screen.queryByRole('button', { name: /Release prep/ })).not.toBeInTheDocument();
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

  it('creates a story directly in a cell with epic and sprint prefilled', async () => {
    const user = userEvent.setup();
    const repository = await openMap();
    await user.click(screen.getByRole('button', { name: 'New story in Local storage, Sprint 2' }));
    const dialog = screen.getByRole('dialog', { name: 'New story' });
    expect(within(dialog).getByLabelText('Epic')).toHaveDisplayValue('Local storage');
    expect(within(dialog).getByLabelText('Sprint')).toHaveDisplayValue(/^Sprint 2/);
    await user.type(within(dialog).getByLabelText('Title'), 'Back up the database');
    await user.click(within(dialog).getByRole('button', { name: 'Add story' }));

    expect(within(cell('Sprint 2', 'Local storage')).getByRole('group', { name: 'S-8: Back up the database' })).toBeInTheDocument();
    expect((await repository.load()).stories.find((story) => story.code === 'S-8')).toMatchObject({
      epicId: 'epic-storage',
      sprintId: 'sprint-2'
    });
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
    expect(parseHash('#/map')).toEqual({ name: 'map' });
    expect(parseHash('#/story/abc')).toEqual({ name: 'story', id: 'abc' });
    expect(parseHash('')).toEqual({ name: 'board' });
    expect(parseHash('#/nonsense')).toEqual({ name: 'board' });
  });
});
