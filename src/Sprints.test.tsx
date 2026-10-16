import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { LocalStorageRepository } from './data/localStorageRepository';
import { seedSnapshot } from './data/seed';
import { addDays, todayIso } from './domain/sprints';
import i18n, { initI18n } from './i18n';
import type { Snapshot, Sprint, Story } from './domain/types';

beforeAll(() => {
  initI18n('en');
});

const today = todayIso();
const day = (offset: number): string => addDays(today, offset);

/**
 * The demo data: Sprint 1 runs (6 stories, 23 points, S-5 with 3 points is done), Sprint 2 is planned and empty,
 * S-7 is not planned. The tests change this snapshot to the situation they need.
 */
function demo(change: (snapshot: Snapshot) => Snapshot = (snapshot) => snapshot): Snapshot {
  return change(seedSnapshot(today));
}

const setSprint = (snapshot: Snapshot, id: string, change: Partial<Sprint>): Snapshot => ({
  ...snapshot,
  sprints: snapshot.sprints.map((sprint) => (sprint.id === id ? { ...sprint, ...change } : sprint))
});

const setStories = (snapshot: Snapshot, change: (story: Story) => Story): Snapshot => ({ ...snapshot, stories: snapshot.stories.map(change) });

/** Moves S-1 and S-2 to Sprint 2, so it holds 2 stories with 5 points. */
const withStoriesInSprint2 = (snapshot: Snapshot): Snapshot =>
  setStories(snapshot, (story) => (story.id === 'story-1' || story.id === 'story-2' ? { ...story, sprintId: 'sprint-2' } : story));

async function open(snapshot: Snapshot, hash = ''): Promise<LocalStorageRepository> {
  window.location.hash = hash;
  const repository = new LocalStorageRepository();
  await repository.replaceAll(snapshot);
  render(<App repository={repository} />);
  await screen.findByRole('heading', { level: 1 });
  return repository;
}

const dialog = (name: RegExp | string): Promise<HTMLElement> => screen.findByRole('dialog', { name });

/** Sprint 1 is completed (not started) and Sprint 2 is planned: the board shows Sprint 2 with "Start sprint". */
const noneRuns = (snapshot: Snapshot): Snapshot => setSprint(snapshot, 'sprint-1', { state: 'completed' });

describe('states of a sprint', () => {
  it('AC1.1 shows a new sprint as planned in the backlog', async () => {
    // Given the demo data and a new sprint "Sprint 3" created on the story map
    const user = userEvent.setup();
    await open(demo(), '#/map');
    await user.click((await screen.findAllByRole('button', { name: '+ Sprint' }))[0]);
    const adding = await dialog('New sprint');
    await user.click(within(adding).getByRole('button', { name: 'Add sprint' }));
    // When I open the backlog
    await user.click(screen.getByRole('link', { name: 'Backlog' }));
    // Then Sprint 3 is marked as planned and Sprint 1 as running
    const section = await screen.findByRole('region', { name: 'Sprint 3' });
    expect(within(section).getByText('planned')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Sprint 1' })).getByText('running')).toBeInTheDocument();
  });

  it('AC1.2 shows no "Start sprint" while a sprint runs', async () => {
    // Given Sprint 1 runs and Sprint 2 is planned
    await open(demo());
    // When I look at the board
    // Then it offers to complete Sprint 1 and offers no start
    expect(await screen.findByRole('button', { name: 'Complete sprint' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start sprint' })).not.toBeInTheDocument();
  });

  it('AC9.4 marks the sprints as running and planned in the backlog and on the story map', async () => {
    // Given Sprint 1 runs, Sprint 2 is planned
    const user = userEvent.setup();
    await open(demo(), '#/backlog');
    expect(within(await screen.findByRole('region', { name: 'Sprint 1' })).getByText('running')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Sprint 2' })).getByText('planned')).toBeInTheDocument();
    // When I open the story map
    await user.click(screen.getByRole('link', { name: 'Story Map' }));
    // Then the labels say the same
    expect(await screen.findByRole('button', { name: /^Sprint 1, .+, running$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Sprint 2, .+, planned$/ })).toBeInTheDocument();
  });
});

describe('board', () => {
  it('AC4.1 shows the next planned sprint with a hint when no sprint runs', async () => {
    // Given no sprint runs and Sprint 2 holds two stories
    await open(demo((snapshot) => noneRuns(withStoriesInSprint2(snapshot))));
    // When I open the board
    // Then it shows Sprint 2 as planned with a hint and "Start sprint", and its stories
    expect(await screen.findByRole('heading', { name: 'Sprint 2', level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText('planned').length).toBeGreaterThan(0);
    expect(screen.getByText('Sprint 2 is planned and not running yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start sprint' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'S-1: Create a story with title and description' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Complete sprint' })).not.toBeInTheDocument();
  });

  it('AC4.2 asks to create the first sprint on the story map when there is no sprint at all', async () => {
    await open(demo((snapshot) => ({ ...snapshot, sprints: [], stories: snapshot.stories.map((story) => ({ ...story, sprintId: null })) })));
    expect(await screen.findByRole('heading', { name: 'No sprint yet', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create one on the story map' })).toHaveAttribute('href', '#/map');
  });

  it('AC4.3 shows that all sprints are completed, with the way to the story map', async () => {
    await open(demo((snapshot) => ({ ...snapshot, sprints: snapshot.sprints.map((sprint) => ({ ...sprint, state: 'completed' as const })) })));
    expect(await screen.findByRole('heading', { name: 'No sprint planned', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('All sprints are completed.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'To the story map' })).toHaveAttribute('href', '#/map');
  });

  it('AC4.4 names the points at the start next to the points now', async () => {
    // Given Sprint 1 was started with 23 points and S-8 with 3 points joined later
    await open(
      demo((snapshot) => ({
        ...snapshot,
        stories: [...snapshot.stories, { ...snapshot.stories[0], id: 'story-8', code: 'S-8', title: 'Added later', points: 3, sprintId: 'sprint-1', rank: 9 }]
      }))
    );
    // When I open the board
    // Then the head says "26 points (23 at the start)"
    expect(await screen.findByText(/7 stories · 26 points \(23 at the start\)/)).toBeInTheDocument();
  });

  it('AC4.4 shows no points at the start when nothing changed', async () => {
    await open(demo());
    expect(await screen.findByText(/6 stories · 23 points$/)).toBeInTheDocument();
  });
});

describe('a sprint that has ended', () => {
  const ended = (snapshot: Snapshot): Snapshot => setSprint(snapshot, 'sprint-1', { startDate: day(-14), endDate: day(-1) });

  it('AC5.1 stays on the board with a hint and a button that opens the completion', async () => {
    // Given Sprint 1 runs, its end date was yesterday
    const user = userEvent.setup();
    await open(demo(ended));
    // When I open the board and press the button in the hint
    expect(await screen.findByText(/^Sprint 1 has been over since /)).toBeInTheDocument();
    expect(screen.getByText('ended')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /dismiss|close/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Complete sprint' }));
    // Then the completion dialog opens
    expect(await dialog('Complete Sprint 1')).toBeInTheDocument();
  });

  it('AC5.2 still runs on its end date, without a hint', async () => {
    await open(demo((snapshot) => setSprint(snapshot, 'sprint-1', { startDate: day(-13), endDate: day(0) })));
    expect(await screen.findByText('running')).toBeInTheDocument();
    expect(screen.queryByText(/has been over since/)).not.toBeInTheDocument();
  });
});

describe('starting a sprint', () => {
  it('AC2.1 starts the planned sprint and keeps its stories and points as the planned scope', async () => {
    // Given no sprint runs and Sprint 2 (planned for today) has 2 stories with 5 points
    const user = userEvent.setup();
    const repository = await open(demo((snapshot) => setSprint(noneRuns(withStoriesInSprint2(snapshot)), 'sprint-2', { startDate: day(0), endDate: day(13) })));
    // When I press "Start sprint" on the board
    await user.click(await screen.findByRole('button', { name: 'Start sprint' }));
    const starting = await dialog('Start sprint');
    // Then the dialog names the sprint, 2 stories and 5 points, and asks nothing about the date
    expect(within(starting).getByLabelText('Sprint')).toHaveDisplayValue(/^Sprint 2/);
    expect(within(starting).getByText('Stories').nextSibling).toHaveTextContent('2');
    expect(within(starting).getByText('Planned points').nextSibling).toHaveTextContent('5');
    expect(within(starting).queryByRole('group', { name: 'Start date' })).not.toBeInTheDocument();
    await user.click(within(starting).getByRole('button', { name: 'Start sprint' }));
    // And the board shows Sprint 2 as running, also after loading again
    expect(await screen.findByText('running')).toBeInTheDocument();
    const saved = (await repository.load()).sprints.find((sprint) => sprint.id === 'sprint-2');
    expect(saved).toMatchObject({ state: 'running', startItems: [{ code: 'S-1', points: 3 }, { code: 'S-2', points: 2 }] });
  });

  it('AC2.2 starts another planned sprint chosen in the dialog and leaves the first one planned', async () => {
    // Given no sprint runs and Sprint 2 and Sprint 3 are planned
    const user = userEvent.setup();
    const repository = await open(
      demo((snapshot) => ({
        ...noneRuns(snapshot),
        sprints: [...noneRuns(snapshot).sprints, { id: 'sprint-3', name: 'Sprint 3', startDate: day(21), endDate: day(34), state: 'planned', startItems: null, result: null }]
      }))
    );
    // When I choose Sprint 3 in the dialog and start it
    await user.click(await screen.findByRole('button', { name: 'Start sprint' }));
    const starting = await dialog('Start sprint');
    await user.selectOptions(within(starting).getByLabelText('Sprint'), within(starting).getByRole('option', { name: /^Sprint 3/ }));
    await user.click(within(starting).getByRole('button', { name: 'Start sprint' }));
    // Then Sprint 3 runs and Sprint 2 stays planned
    await screen.findByRole('heading', { name: 'Sprint 3', level: 1 });
    const states = Object.fromEntries((await repository.load()).sprints.map((sprint) => [sprint.id, sprint.state]));
    expect(states).toMatchObject({ 'sprint-2': 'planned', 'sprint-3': 'running' });
  });

  it('AC2.3 starts a sprint without stories', async () => {
    const user = userEvent.setup();
    await open(demo((snapshot) => setSprint(noneRuns(snapshot), 'sprint-2', { startDate: day(0), endDate: day(13) })));
    await user.click(await screen.findByRole('button', { name: 'Start sprint' }));
    const starting = await dialog('Start sprint');
    expect(within(starting).getByText('Stories').nextSibling).toHaveTextContent('0');
    expect(within(starting).getByText('Planned points').nextSibling).toHaveTextContent('0');
    await user.click(within(starting).getByRole('button', { name: 'Start sprint' }));
    expect(await screen.findByText('running')).toBeInTheDocument();
  });

  it('AC2.4 names the stories without points in the dialog', async () => {
    const user = userEvent.setup();
    await open(
      demo((snapshot) =>
        setStories(noneRuns(withStoriesInSprint2(snapshot)), (story) => (story.id === 'story-2' ? { ...story, points: null } : story))
      )
    );
    await user.click(await screen.findByRole('button', { name: 'Start sprint' }));
    expect(within(await dialog('Start sprint')).getByText('1 story without estimate (S-2) counts as no points.')).toBeInTheDocument();
  });

  it('AC3.2 asks for the start date when starting later and moves the sprint to today by default', async () => {
    // Given Sprint 2 was planned for the day after tomorrow, 14 days long
    const user = userEvent.setup();
    const repository = await open(demo((snapshot) => setSprint(noneRuns(snapshot), 'sprint-2', { startDate: day(-2), endDate: day(11) })));
    await user.click(await screen.findByRole('button', { name: 'Start sprint' }));
    const starting = await dialog('Start sprint');
    // Then the dialog asks and preselects "Start today"
    const group = within(starting).getByRole('group', { name: 'Start date' });
    expect(within(group).getByRole('radio', { name: /^Start today:/ })).toBeChecked();
    // When I start with the preselected choice
    await user.click(within(starting).getByRole('button', { name: 'Start sprint' }));
    // Then the sprint runs from today and keeps its 14 days
    await screen.findByText('running');
    const saved = (await repository.load()).sprints.find((sprint) => sprint.id === 'sprint-2');
    expect([saved?.startDate, saved?.endDate]).toEqual([day(0), day(13)]);
  });

  it('AC3.3 keeps the planned dates when I choose so', async () => {
    const user = userEvent.setup();
    const repository = await open(demo((snapshot) => setSprint(noneRuns(snapshot), 'sprint-2', { startDate: day(-2), endDate: day(11) })));
    await user.click(await screen.findByRole('button', { name: 'Start sprint' }));
    const starting = await dialog('Start sprint');
    await user.click(within(starting).getByRole('radio', { name: /^Keep the planned dates:/ }));
    await user.click(within(starting).getByRole('button', { name: 'Start sprint' }));
    await screen.findByText('running');
    const saved = (await repository.load()).sprints.find((sprint) => sprint.id === 'sprint-2');
    expect([saved?.startDate, saved?.endDate]).toEqual([day(-2), day(11)]);
  });

  it('AC3.1 asks nothing when today is the planned start day', async () => {
    const user = userEvent.setup();
    await open(demo((snapshot) => setSprint(noneRuns(snapshot), 'sprint-2', { startDate: day(0), endDate: day(13) })));
    await user.click(await screen.findByRole('button', { name: 'Start sprint' }));
    expect(within(await dialog('Start sprint')).queryByRole('group', { name: 'Start date' })).not.toBeInTheDocument();
  });

  it('AC12.2 leaves the sprint planned when I cancel the start', async () => {
    const user = userEvent.setup();
    const repository = await open(demo((snapshot) => setSprint(noneRuns(snapshot), 'sprint-2', { startDate: day(-2), endDate: day(11) })));
    await user.click(await screen.findByRole('button', { name: 'Start sprint' }));
    const starting = await dialog('Start sprint');
    await user.click(within(starting).getByRole('radio', { name: /^Start today:/ }));
    await user.click(within(starting).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const saved = (await repository.load()).sprints.find((sprint) => sprint.id === 'sprint-2');
    expect(saved).toMatchObject({ state: 'planned', startDate: day(-2), endDate: day(11) });
  });
});

describe('completing a sprint', () => {
  /** Sprint 1 started with 23 points; S-8 (3 points, done) joined later. S-3 and S-6 are not done. */
  const withAdded = (snapshot: Snapshot): Snapshot => ({
    ...snapshot,
    stories: [
      ...snapshot.stories.map((story) => (story.id === 'story-1' || story.id === 'story-2' || story.id === 'story-4' ? { ...story, status: 'done' } : story)),
      { ...snapshot.stories[0], id: 'story-8', code: 'S-8', title: 'Added later', points: 3, sprintId: 'sprint-1', status: 'done', rank: 9, criteria: [], values: {} }
    ]
  });
  const openCompletion = async (snapshot: Snapshot): Promise<{ user: ReturnType<typeof userEvent.setup>; repository: LocalStorageRepository; completing: HTMLElement }> => {
    const user = userEvent.setup();
    const repository = await open(snapshot);
    await user.click(await screen.findByRole('button', { name: 'Complete sprint' }));
    return { user, repository, completing: await dialog('Complete Sprint 1') };
  };

  it('AC6.1 summarises planned, done and not done, and what joined during the sprint', async () => {
    // Given Sprint 1 started with 6 stories and 23 points, S-8 (3 points) joined; 5 stories (16 points) are done
    const { completing } = await openCompletion(demo(withAdded));
    // When I open "Complete sprint"
    // Then the figures, the change line and the lists are there
    const figure = (label: string): HTMLElement | null => within(completing).getByText(label, { selector: '.sprint-figure__label' }).parentElement;
    expect(figure('Planned at the start')).toHaveTextContent('23 points · 6 stories');
    expect(figure('Done')).toHaveTextContent('16 points · 5 stories');
    expect(figure('Not done')).toHaveTextContent('10 points · 2 stories');
    expect(within(completing).getByText(/During the sprint: \+1 story, \+3 points added \(S-8\), nothing removed\./)).toBeInTheDocument();
    expect(within(completing).getByText('16 of 26 points done · 70 % of the 23 planned at the start')).toBeInTheDocument();
    const notDone = within(completing).getByText('Stories not done').closest('details');
    expect(notDone).toHaveAttribute('open');
    expect(within(notDone as HTMLElement).getByText('S-3')).toBeInTheDocument();
    expect(within(completing).getByText('Done stories').closest('details')).not.toHaveAttribute('open');
  });

  it('AC6.2 names a story that was removed from the sprint', async () => {
    // Given S-6 was taken out of the sprint after the start
    const { completing } = await openCompletion(demo((snapshot) => setStories(snapshot, (story) => (story.id === 'story-6' ? { ...story, sprintId: null } : story))));
    expect(within(completing).getByText(/1 story, −5 points removed \(S-6\), nothing added\./)).toBeInTheDocument();
  });

  it('AC6.3 names a not done story without points', async () => {
    const { completing } = await openCompletion(demo((snapshot) => setStories(snapshot, (story) => (story.id === 'story-3' ? { ...story, points: null } : story))));
    expect(within(completing).getByText('1 story without estimate (S-3) counts as no points.')).toBeInTheDocument();
  });

  it('AC6.4 says more was done than planned', async () => {
    // Given every story is done and S-8 joined
    const { completing } = await openCompletion(demo((snapshot) => setStories(withAdded(snapshot), (story) => ({ ...story, status: 'done' }))));
    expect(within(completing).getByText('26 of 26 points done · 113 % of the 23 planned at the start')).toBeInTheDocument();
  });

  it('AC7.1 moves the unfinished stories into the next sprint, to its top', async () => {
    // Given Sprint 2 is planned and holds S-7 (not planned before) with 8 points
    const { user, repository, completing } = await openCompletion(
      demo((snapshot) => setStories(snapshot, (story) => (story.id === 'story-7' ? { ...story, sprintId: 'sprint-2', rank: 7 } : story)))
    );
    // Then "next sprint" is preselected and says what Sprint 2 holds
    const next = within(completing).getByRole('radio', { name: /^To the next sprint: Sprint 2/ });
    expect(next).toBeChecked();
    expect(within(completing).getByText(/already has 1 story, 8 points/)).toBeInTheDocument();
    // When I complete
    await user.click(within(completing).getByRole('button', { name: 'Complete sprint' }));
    // Then the unfinished stories are in Sprint 2 and the done one stays in Sprint 1
    await screen.findByRole('heading', { name: 'Sprint 2', level: 1 });
    const saved = await repository.load();
    const sprintOf = (code: string): string | null => saved.stories.find((story) => story.code === code)?.sprintId ?? null;
    expect(['S-1', 'S-2', 'S-3', 'S-4', 'S-6', 'S-7'].map(sprintOf)).toEqual(['sprint-2', 'sprint-2', 'sprint-2', 'sprint-2', 'sprint-2', 'sprint-2']);
    expect(sprintOf('S-5')).toBe('sprint-1');
    expect(saved.sprints.find((sprint) => sprint.id === 'sprint-1')?.state).toBe('completed');
    expect(saved.stories.filter((story) => story.sprintId === 'sprint-2').sort((a, b) => a.rank - b.rank)[5].code).toBe('S-7');
  });

  it('AC7.2 creates a new sprint for the unfinished stories', async () => {
    const { user, repository, completing } = await openCompletion(demo());
    await user.click(within(completing).getByRole('radio', { name: /^To a new sprint/ }));
    expect(within(completing).getByText(/^Sprint 3 · .* \(you can change it later\)$/)).toBeInTheDocument();
    await user.click(within(completing).getByRole('button', { name: 'Complete sprint' }));
    await screen.findByRole('heading', { level: 1 });
    const saved = await repository.load();
    const created = saved.sprints.find((sprint) => sprint.name === 'Sprint 3');
    expect(created).toMatchObject({ state: 'planned', startDate: day(21), endDate: day(34) });
    expect(saved.stories.find((story) => story.code === 'S-3')?.sprintId).toBe(created?.id);
  });

  it('AC7.3 sends the unfinished stories back to the backlog', async () => {
    const { user, repository, completing } = await openCompletion(demo());
    await user.click(within(completing).getByRole('radio', { name: /^Back to the backlog/ }));
    await user.click(within(completing).getByRole('button', { name: 'Complete sprint' }));
    await screen.findByRole('heading', { level: 1 });
    const saved = await repository.load();
    expect(['S-1', 'S-2', 'S-3', 'S-4', 'S-6'].map((code) => saved.stories.find((story) => story.code === code)?.sprintId)).toEqual([null, null, null, null, null]);
  });

  it('AC7.4 offers no next sprint when none is planned and preselects a new one', async () => {
    const { completing } = await openCompletion(demo((snapshot) => ({ ...snapshot, sprints: snapshot.sprints.filter((sprint) => sprint.id === 'sprint-1') })));
    expect(within(completing).queryByRole('radio', { name: /^To the next sprint/ })).not.toBeInTheDocument();
    expect(within(completing).getByRole('radio', { name: /^To a new sprint/ })).toBeChecked();
  });

  it('AC7.5 asks nothing about stories when all are done', async () => {
    const { completing } = await openCompletion(demo((snapshot) => setStories(snapshot, (story) => (story.sprintId === 'sprint-1' ? { ...story, status: 'done' } : story))));
    expect(within(completing).getByText('All stories are done.')).toBeInTheDocument();
    expect(within(completing).queryByRole('group', { name: /Where do/ })).not.toBeInTheDocument();
  });

  it('AC8.1 asks nothing about the end date on the end day', async () => {
    const { completing } = await openCompletion(demo((snapshot) => setSprint(snapshot, 'sprint-1', { startDate: day(-13), endDate: day(0) })));
    expect(within(completing).queryByRole('group', { name: 'End date' })).not.toBeInTheDocument();
  });

  it('AC8.2 sets the end date to today when I complete early, by default', async () => {
    // Given the planned end is in four days
    const { user, repository, completing } = await openCompletion(demo((snapshot) => setSprint(snapshot, 'sprint-1', { startDate: day(-9), endDate: day(4) })));
    expect(within(completing).getByRole('radio', { name: /^Set the end date to today:/ })).toBeChecked();
    await user.click(within(completing).getByRole('button', { name: 'Complete sprint' }));
    await screen.findByRole('heading', { level: 1 });
    expect((await repository.load()).sprints.find((sprint) => sprint.id === 'sprint-1')?.endDate).toBe(day(0));
  });

  it('AC8.3 keeps the planned end date when I choose so', async () => {
    const { user, repository, completing } = await openCompletion(demo((snapshot) => setSprint(snapshot, 'sprint-1', { startDate: day(-9), endDate: day(4) })));
    await user.click(within(completing).getByRole('radio', { name: /^Keep the planned end date:/ }));
    await user.click(within(completing).getByRole('button', { name: 'Complete sprint' }));
    await screen.findByRole('heading', { level: 1 });
    expect((await repository.load()).sprints.find((sprint) => sprint.id === 'sprint-1')?.endDate).toBe(day(4));
  });

  it('AC8.4 sets the end date to today when I complete late', async () => {
    const { user, repository, completing } = await openCompletion(demo((snapshot) => setSprint(snapshot, 'sprint-1', { startDate: day(-16), endDate: day(-3) })));
    await user.click(within(completing).getByRole('button', { name: 'Complete sprint' }));
    await screen.findByRole('heading', { level: 1 });
    expect((await repository.load()).sprints.find((sprint) => sprint.id === 'sprint-1')?.endDate).toBe(day(0));
  });

  it('AC9.1 removes the completed sprint from the board, the backlog and the story map, also after loading again', async () => {
    // Given Sprint 1 and Sprint 2
    const { user, completing } = await openCompletion(demo());
    // When I complete Sprint 1 with its unfinished stories going to Sprint 2
    await user.click(within(completing).getByRole('button', { name: 'Complete sprint' }));
    await screen.findByRole('heading', { name: 'Sprint 2', level: 1 });
    // Then Sprint 1 is nowhere to be seen
    await user.click(screen.getByRole('link', { name: 'Backlog' }));
    expect(await screen.findByRole('region', { name: 'Sprint 2' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Sprint 1' })).not.toBeInTheDocument();
    expect(screen.queryByText('Switch the UI language (DE, EN, FR, IT)')).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Story Map' }));
    await screen.findByRole('heading', { name: 'Story Map', level: 1 });
    expect(screen.queryByRole('button', { name: /^Sprint 1,/ })).not.toBeInTheDocument();
  });

  it('AC10.1 says what happened after completing', async () => {
    const { user, completing } = await openCompletion(demo());
    await user.click(within(completing).getByRole('button', { name: 'Complete sprint' }));
    const message = await screen.findByText('Sprint 1 completed: 3 points done (planned at the start: 23). 5 stories (20 points) are now in Sprint 2.');
    expect(message.closest('[role="status"]')).not.toBeNull();
  });

  it('AC10.1 closes the message with its button', async () => {
    const { user, completing } = await openCompletion(demo());
    await user.click(within(completing).getByRole('button', { name: 'Complete sprint' }));
    await user.click(await screen.findByRole('button', { name: 'Close message' }));
    expect(screen.queryByText(/^Sprint 1 completed:/)).not.toBeInTheDocument();
  });

  it('AC10.2 opens the start dialog of the next sprint when "Then start" is ticked', async () => {
    // Given the completion with the box "Then start Sprint 2" ticked
    const { user, repository, completing } = await openCompletion(demo());
    await user.click(within(completing).getByRole('checkbox', { name: /^Then start Sprint 2/ }));
    await user.click(within(completing).getByRole('button', { name: 'Complete sprint' }));
    // When the start dialog opens, it holds the moved stories (5 stories, 20 points)
    const starting = await dialog('Start sprint');
    expect(within(starting).getByText('Stories').nextSibling).toHaveTextContent('5');
    expect(within(starting).getByText('Planned points').nextSibling).toHaveTextContent('20');
    await user.click(within(starting).getByRole('button', { name: 'Start sprint' }));
    // Then Sprint 2 runs
    expect(await screen.findByRole('heading', { name: 'Sprint 2', level: 1 })).toBeInTheDocument();
    await screen.findByText('running');
    expect((await repository.load()).sprints.find((sprint) => sprint.id === 'sprint-2')?.state).toBe('running');
  });

  it('AC10.3 offers to start the new sprint that the completion creates', async () => {
    const { user, completing } = await openCompletion(demo((snapshot) => ({ ...snapshot, sprints: snapshot.sprints.filter((sprint) => sprint.id === 'sprint-1') })));
    await user.click(within(completing).getByRole('checkbox', { name: /^Then start Sprint 2/ }));
    await user.click(within(completing).getByRole('button', { name: 'Complete sprint' }));
    expect(await dialog('Start sprint')).toBeInTheDocument();
  });

  it('AC10.4 keeps the next sprint planned when I cancel the start dialog', async () => {
    const { user, repository, completing } = await openCompletion(demo());
    await user.click(within(completing).getByRole('checkbox', { name: /^Then start Sprint 2/ }));
    await user.click(within(completing).getByRole('button', { name: 'Complete sprint' }));
    await user.click(within(await dialog('Start sprint')).getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('button', { name: 'Start sprint' })).toBeInTheDocument();
    const saved = await repository.load();
    expect(saved.sprints.find((sprint) => sprint.id === 'sprint-1')?.state).toBe('completed');
    expect(saved.sprints.find((sprint) => sprint.id === 'sprint-2')?.state).toBe('planned');
  });

  it('AC12.1 leaves everything unchanged when I cancel the completion, with the button and with Escape', async () => {
    // Given a completion dialog in which I changed the choices
    const user = userEvent.setup();
    const repository = await open(demo());
    const before = await repository.load();
    for (const close of ['button', 'escape']) {
      await user.click(await screen.findByRole('button', { name: 'Complete sprint' }));
      const completing = await dialog('Complete Sprint 1');
      await user.click(within(completing).getByRole('radio', { name: /^Back to the backlog/ }));
      // When I cancel
      if (close === 'button') await user.click(within(completing).getByRole('button', { name: 'Cancel' }));
      else await user.keyboard('{Escape}');
      // Then Sprint 1 still runs and nothing was saved
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(await repository.load()).toEqual(before);
    }
  });

  it('AC12.3 completes a sprint with the keyboard only', async () => {
    // Given the board with the focus on the button
    const user = userEvent.setup();
    const repository = await open(demo());
    (await screen.findByRole('button', { name: 'Complete sprint' })).focus();
    // When I open the dialog with Enter, choose "Back to the backlog" with the arrow keys and confirm with Enter
    await user.keyboard('{Enter}');
    const completing = await dialog('Complete Sprint 1');
    within(completing).getByRole('radio', { name: /^To the next sprint/ }).focus();
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(within(completing).getByRole('radio', { name: /^Back to the backlog/ })).toBeChecked();
    within(completing).getByRole('button', { name: 'Complete sprint' }).focus();
    await user.keyboard('{Enter}');
    // Then the sprint is completed
    await screen.findByRole('heading', { level: 1 });
    expect((await repository.load()).sprints.find((sprint) => sprint.id === 'sprint-1')?.state).toBe('completed');
  });
});

describe('languages and help', () => {
  it.each([
    ['de', 'Sprint abschliessen', 'Sprint starten'],
    ['en', 'Complete sprint', 'Start sprint'],
    ['fr', 'Clôturer le sprint', 'Démarrer le sprint'],
    ['it', 'Concludi lo sprint', 'Avvia lo sprint']
  ])('AC12.4 shows starting and completing in %s', async (language, complete, start) => {
    // Given the app in another language
    const user = userEvent.setup();
    await i18n.changeLanguage(language);
    await open(demo());
    // When I open the completion
    await user.click(await screen.findByRole('button', { name: complete }));
    // Then its button is translated, and so is the start button of a planned sprint
    const completing = await screen.findByRole('dialog');
    expect(within(completing).getByRole('button', { name: complete })).toBeInTheDocument();
    await user.click(within(completing).getByRole('button', { name: complete }));
    expect(await screen.findByRole('button', { name: start })).toBeInTheDocument();
    await i18n.changeLanguage('en');
  });

  it('AC12.5 explains starting and completing a sprint in the help, with a link to the board', async () => {
    // Given the help is open
    const user = userEvent.setup();
    await open(demo(), '#/backlog');
    await user.click(screen.getByRole('button', { name: 'Help' }));
    // When I search for "start sprint"
    await user.type(screen.getByRole('searchbox', { name: 'Search help' }), 'start sprint');
    // Then the topic is the first hit
    const panel = screen.getByRole('complementary');
    const [first] = within(panel).getAllByRole('button').filter((button) => button.hasAttribute('data-help-item'));
    expect(first).toHaveTextContent('Start and complete a sprint');
    // And opening it shows the explanation and a link to the board
    await user.click(first);
    expect(within(panel).getByText(/Press “Start sprint”/)).toBeInTheDocument();
    expect(within(panel).getAllByRole('link', { name: /Board/ })[0]).toHaveAttribute('href', '#/board');
  });
});
