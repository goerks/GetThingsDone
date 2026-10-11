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
