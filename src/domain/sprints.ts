import type { Sprint } from './types';

const DAY = 24 * 60 * 60 * 1000;
/** Length of a new sprint in days, including start and end day. */
export const SPRINT_LENGTH_DAYS = 14;

/** Today as a local calendar day `YYYY-MM-DD`. */
export function todayIso(now: Date = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

/** Adds days to a calendar day. Works in UTC, so daylight saving time does not shift the date. */
export function addDays(day: string, days: number): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date) + days * DAY).toISOString().slice(0, 10);
}

export function isValidDay(day: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && addDays(day, 0) === day;
}

/** Sprints in time order: by start date, then by name. */
export function sortSprints(sprints: readonly Sprint[]): Sprint[] {
  return [...sprints].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name));
}

export const isPast = (sprint: Sprint, today: string): boolean => sprint.endDate < today;
export const isRunning = (sprint: Sprint, today: string): boolean => sprint.startDate <= today && today <= sprint.endDate;

/**
 * The sprint the board shows: the one whose dates include today; if none runs, the next upcoming one;
 * if there is no upcoming one either, the last one. Null when there are no sprints.
 */
export function runningSprint(sprints: readonly Sprint[], today: string): Sprint | null {
  const sorted = sortSprints(sprints);
  return (
    sorted.find((sprint) => isRunning(sprint, today)) ??
    sorted.find((sprint) => sprint.startDate > today) ??
    sorted[sorted.length - 1] ??
    null
  );
}

/** Sprints shown on the story map: the running and the future ones, in time order. */
export function mapSprints(sprints: readonly Sprint[], today: string): Sprint[] {
  return sortSprints(sprints).filter((sprint) => !isPast(sprint, today));
}

export interface SprintInput {
  name: string;
  startDate: string;
  endDate: string;
}

/** Prefilled values for a new sprint: "Sprint n", starting after the last sprint (or today), two weeks long. */
export function newSprintDefaults(sprints: readonly Sprint[], today: string, nameFor: (number: number) => string): SprintInput {
  const highest = sprints.reduce((max, sprint) => {
    const match = /(\d+)\s*$/.exec(sprint.name);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const lastEnd = sprints.reduce<string | null>((max, sprint) => (max === null || sprint.endDate > max ? sprint.endDate : max), null);
  const afterLast = lastEnd ? addDays(lastEnd, 1) : today;
  const startDate = afterLast < today ? today : afterLast;
  return {
    name: nameFor(Math.max(highest, sprints.length) + 1),
    startDate,
    endDate: addDays(startDate, SPRINT_LENGTH_DAYS - 1)
  };
}

export type SprintProblem = 'name' | 'dates';

/** Checks a sprint before it is saved. */
export function validateSprint(input: SprintInput): SprintProblem | null {
  if (!input.name.trim()) return 'name';
  if (!isValidDay(input.startDate) || !isValidDay(input.endDate) || input.endDate < input.startDate) return 'dates';
  return null;
}

export function createSprint(sprints: Sprint[], input: SprintInput, id: string): { sprints: Sprint[]; sprint: Sprint } | null {
  if (validateSprint(input)) return null;
  const sprint: Sprint = { id, name: input.name.trim(), startDate: input.startDate, endDate: input.endDate };
  return { sprints: [...sprints, sprint], sprint };
}

export function updateSprint(sprints: Sprint[], id: string, input: SprintInput): Sprint[] {
  if (validateSprint(input)) return sprints;
  return sprints.map((sprint) =>
    sprint.id === id ? { ...sprint, name: input.name.trim(), startDate: input.startDate, endDate: input.endDate } : sprint
  );
}

/** Sprints that have not started yet; only these can be reordered. */
export const isUpcoming = (sprint: Sprint, today: string): boolean => sprint.startDate > today;

/** Number of days between two calendar days. */
function daysBetween(from: string, to: string): number {
  const toTime = (day: string): number => {
    const [year, month, date] = day.split('-').map(Number);
    return Date.UTC(year, month - 1, date);
  };
  return Math.round((toTime(to) - toTime(from)) / DAY);
}

/**
 * Moves an upcoming sprint before or after another upcoming sprint and recalculates the dates of all upcoming
 * sprints: each keeps its length, and they follow each other without gaps from the end of the last sprint that
 * has started (or from the first upcoming start when none has started). Running and past sprints never move.
 * Returns the same list when the move is not allowed or changes nothing.
 */
export function moveSprint(
  sprints: Sprint[],
  today: string,
  activeId: string,
  overId: string,
  placement: 'before' | 'after'
): Sprint[] {
  if (activeId === overId) return sprints;
  const upcoming = sortSprints(sprints).filter((sprint) => isUpcoming(sprint, today));
  const active = upcoming.find((sprint) => sprint.id === activeId);
  if (!active || !upcoming.some((sprint) => sprint.id === overId)) return sprints;

  const order = upcoming.filter((sprint) => sprint.id !== activeId);
  const targetIndex = order.findIndex((sprint) => sprint.id === overId);
  order.splice(placement === 'after' ? targetIndex + 1 : targetIndex, 0, active);

  const started = sprints.filter((sprint) => !isUpcoming(sprint, today));
  const lastStartedEnd = started.reduce<string | null>((max, s) => (max === null || s.endDate > max ? s.endDate : max), null);
  let start = lastStartedEnd ? addDays(lastStartedEnd, 1) : upcoming[0].startDate;
  if (start <= today) start = addDays(today, 1);

  const moved = new Map<string, Sprint>();
  for (const sprint of order) {
    const length = daysBetween(sprint.startDate, sprint.endDate);
    const next = { ...sprint, startDate: start, endDate: addDays(start, length) };
    moved.set(sprint.id, next);
    start = addDays(next.endDate, 1);
  }
  const unchanged = order.every((sprint, index) => sprint.id === upcoming[index].id) &&
    upcoming.every((sprint) => {
      const next = moved.get(sprint.id);
      return next?.startDate === sprint.startDate && next.endDate === sprint.endDate;
    });
  if (unchanged) return sprints;
  return sprints.map((sprint) => moved.get(sprint.id) ?? sprint);
}
