import { moveStoriesToSprint, sortByRank } from './board';
import { addDays, daysBetween, newSprintDefaults, plannedSprints, runningSprint, sortSprints } from './sprints';
import type { IsDone } from './statuses';
import type { Sprint, SprintResult, SprintStartItem, Story } from './types';

/**
 * Starting and completing a sprint (#17). A sprint is planned, running (at most one) or completed. When it starts,
 * the stories in it are kept as the planned scope; when it is completed, the scope at the start is compared with
 * what happened, and the unfinished stories move on.
 */

const pointsOf = (stories: readonly { points: number | null }[]): number => stories.reduce((sum, story) => sum + (story.points ?? 0), 0);

/** The stories in a sprint, by rank. */
export const storiesOf = (stories: readonly Story[], sprintId: string): Story[] => sortByRank(stories).filter((story) => story.sprintId === sprintId);

/** The stories in a sprint as they are now: what a start keeps as the planned scope. */
export function startItemsOf(stories: readonly Story[], sprintId: string): SprintStartItem[] {
  return storiesOf(stories, sprintId).map((story) => ({ storyId: story.id, code: story.code, points: story.points }));
}

/** What a sprint holds before it starts: its stories, points and the stories without points. */
export interface SprintContents {
  stories: Story[];
  points: number;
  withoutPoints: Story[];
}

export function contentsOf(stories: readonly Story[], sprintId: string): SprintContents {
  const inSprint = storiesOf(stories, sprintId);
  return { stories: inSprint, points: pointsOf(inSprint), withoutPoints: inSprint.filter((story) => story.points === null) };
}

/** Whether the planned start differs from today, so starting has to ask which dates the sprint gets. */
export const startNeedsDates = (sprint: Sprint, today: string): boolean => sprint.startDate !== today;

/** Whether the end date differs from today (and today is not before the start), so completing has to ask. */
export const completeNeedsDate = (sprint: Sprint, today: string): boolean => sprint.endDate !== today && today >= sprint.startDate;

/**
 * Starts a planned sprint, when none is running. "today" moves the start to today and the end along, so the
 * length stays; "keep" leaves the dates. The stories in the sprint are kept as the planned scope.
 * Returns null when the sprint cannot be started.
 */
export function startSprint(sprints: Sprint[], stories: readonly Story[], sprintId: string, dates: 'today' | 'keep', today: string): Sprint[] | null {
  const sprint = sprints.find((item) => item.id === sprintId);
  if (!sprint || sprint.state !== 'planned' || runningSprint(sprints)) return null;
  const moveToToday = dates === 'today' && startNeedsDates(sprint, today);
  const length = daysBetween(sprint.startDate, sprint.endDate);
  const started: Sprint = {
    ...sprint,
    startDate: moveToToday ? today : sprint.startDate,
    endDate: moveToToday ? addDays(today, length) : sprint.endDate,
    state: 'running',
    startItems: startItemsOf(stories, sprintId)
  };
  return sprints.map((item) => (item.id === sprintId ? started : item));
}

/** The figures of a sprint when it is completed: planned at the start, done, not done and what changed in between. */
export interface SprintSummary {
  plannedPoints: number;
  plannedStories: number;
  done: Story[];
  notDone: Story[];
  donePoints: number;
  notDonePoints: number;
  /** Stories that joined the sprint after its start. */
  added: Story[];
  addedPoints: number;
  /** Stories that left the sprint after its start (or were deleted), as they were at the start. */
  removed: SprintStartItem[];
  removedPoints: number;
  /** Net change of the points of the stories that stayed. */
  changedPoints: number;
  /** Stories in the sprint that are not estimated; they count as 0 points. */
  withoutPoints: Story[];
}

export function summarizeSprint(sprint: Sprint, stories: readonly Story[], isDone: IsDone): SprintSummary {
  const items = sprint.startItems ?? [];
  const current = storiesOf(stories, sprint.id);
  const atStart = new Map(items.map((item) => [item.storyId, item]));
  const done = current.filter((story) => isDone(story));
  const notDone = current.filter((story) => !isDone(story));
  const added = current.filter((story) => !atStart.has(story.id));
  const removed = items.filter((item) => !current.some((story) => story.id === item.storyId));
  const changedPoints = current.reduce((sum, story) => {
    const item = atStart.get(story.id);
    return item ? sum + ((story.points ?? 0) - (item.points ?? 0)) : sum;
  }, 0);
  return {
    plannedPoints: pointsOf(items),
    plannedStories: items.length,
    done,
    notDone,
    donePoints: pointsOf(done),
    notDonePoints: pointsOf(notDone),
    added,
    addedPoints: pointsOf(added),
    removed,
    removedPoints: pointsOf(removed),
    changedPoints,
    withoutPoints: current.filter((story) => story.points === null)
  };
}

const resultOf = (summary: SprintSummary, completedOn: string): SprintResult => ({
  completedOn,
  plannedPoints: summary.plannedPoints,
  plannedStories: summary.plannedStories,
  donePoints: summary.donePoints,
  doneStories: summary.done.length,
  notDonePoints: summary.notDonePoints,
  notDoneStories: summary.notDone.length,
  addedStories: summary.added.length,
  addedPoints: summary.addedPoints,
  removedStories: summary.removed.length,
  removedPoints: summary.removedPoints,
  changedPoints: summary.changedPoints
});

/** Where the unfinished stories go: the next planned sprint, a new sprint or back to the backlog. */
export type UnfinishedTarget = 'next' | 'new' | 'backlog';

export interface CompleteInput {
  target: UnfinishedTarget;
  /** "today" sets the end date to today when it differs; "keep" leaves it. */
  endDate: 'today' | 'keep';
  today: string;
  /** Id of the sprint that is created for the target "new". */
  newId: string;
  nameFor: (number: number) => string;
}

export interface Completion {
  sprints: Sprint[];
  stories: Story[];
  /** The completed sprint. */
  completed: Sprint;
  /** The sprint the unfinished stories went to (also when it was just created), or null for the backlog. */
  targetSprint: Sprint | null;
  /** True when `targetSprint` was created by this completion. */
  created: boolean;
  summary: SprintSummary;
}

/**
 * Completes the running sprint: stores its result, keeps its done stories in it and moves the unfinished stories to
 * the chosen target, to the top of its section. Returns null when the sprint does not run or the target does not
 * exist (no planned sprint for "next").
 */
export function completeSprint(sprints: Sprint[], stories: Story[], sprintId: string, isDone: IsDone, input: CompleteInput): Completion | null {
  const sprint = sprints.find((item) => item.id === sprintId);
  if (!sprint || sprint.state !== 'running') return null;
  const summary = summarizeSprint(sprint, stories, isDone);
  const endDate = input.endDate === 'today' && completeNeedsDate(sprint, input.today) ? input.today : sprint.endDate;
  const completed: Sprint = { ...sprint, endDate, state: 'completed', result: resultOf(summary, input.today) };
  let list = sprints.map((item) => (item.id === sprintId ? completed : item));

  let targetSprint: Sprint | null = null;
  let created = false;
  if (summary.notDone.length > 0 && input.target === 'next') {
    targetSprint = plannedSprints(list)[0] ?? null;
    if (!targetSprint) return null;
  }
  if (summary.notDone.length > 0 && input.target === 'new') {
    const defaults = newSprintDefaults(list, input.today, input.nameFor);
    targetSprint = { id: input.newId, ...defaults, state: 'planned', startItems: null, result: null };
    list = [...list, targetSprint];
    created = true;
  }
  const moved = summary.notDone.length > 0 ? moveStoriesToSprint(stories, list, summary.notDone.map((story) => story.id), targetSprint?.id ?? null) : stories;
  return { sprints: list, stories: moved, completed, targetSprint, created, summary };
}

/** A sprint as an earlier version stored it: without a state. */
export type StoredSprint = Omit<Sprint, 'state' | 'startItems' | 'result'> & Partial<Pick<Sprint, 'state' | 'startItems' | 'result'>>;

/**
 * Gives the sprints of an earlier version their state by their dates (#17): the sprint that includes today runs, earlier
 * sprints are completed with their result, later ones are planned. The unfinished stories of a sprint that is completed
 * this way go back to the backlog, so they do not vanish in a completed sprint. Sprints that have a state are kept.
 */
export function settleSprints(sprints: readonly StoredSprint[], stories: Story[], isDone: IsDone, today: string): { sprints: Sprint[]; stories: Story[] } {
  if (sprints.every((sprint) => sprint.state !== undefined)) {
    return { sprints: sprints.map((sprint) => ({ ...sprint, state: sprint.state!, startItems: sprint.startItems ?? null, result: sprint.result ?? null })), stories };
  }
  const todays = sortSprints(sprints.filter((sprint) => sprint.state === undefined && sprint.startDate <= today && today <= sprint.endDate))[0];
  const alreadyRunning = sprints.some((sprint) => sprint.state === 'running');
  const toBacklog: string[] = [];
  const settled = sprints.map((stored): Sprint => {
    const base = { ...stored, startItems: stored.startItems ?? null, result: stored.result ?? null };
    if (stored.state !== undefined) return { ...base, state: stored.state };
    if (stored.endDate < today) {
      const sprint: Sprint = { ...base, state: 'completed', startItems: startItemsOf(stories, stored.id) };
      const summary = summarizeSprint(sprint, stories, isDone);
      toBacklog.push(...summary.notDone.map((story) => story.id));
      return { ...sprint, result: resultOf(summary, stored.endDate) };
    }
    if (stored === todays && !alreadyRunning) return { ...base, state: 'running', startItems: startItemsOf(stories, stored.id) };
    return { ...base, state: 'planned' };
  });
  return { sprints: settled, stories: toBacklog.length > 0 ? moveStoriesToSprint(stories, settled, toBacklog, null) : stories };
}
