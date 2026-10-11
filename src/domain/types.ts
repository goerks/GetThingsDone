export type Status = 'todo' | 'in_progress' | 'review' | 'done';

export const STATUSES: readonly Status[] = ['todo', 'in_progress', 'review', 'done'];

export const EPIC_COLOR_KEYS = ['blue', 'amber', 'teal', 'violet', 'rose', 'green', 'cyan', 'slate'] as const;

export type EpicColorKey = (typeof EPIC_COLOR_KEYS)[number];

export const POINT_VALUES: readonly number[] = [1, 2, 3, 5, 8, 13];

export interface Epic {
  id: string;
  name: string;
  colorKey: EpicColorKey;
  /** Column order on the story map and order in lists, 0 first. */
  position: number;
}

/** A time box. Dates are local calendar days as `YYYY-MM-DD`; both days belong to the sprint. */
export interface Sprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface Criterion {
  id: string;
  text: string;
  done: boolean;
}

export interface Story {
  id: string;
  /** Human readable key such as "S-4". */
  code: string;
  title: string;
  description: string;
  epicId: string;
  points: number;
  status: Status;
  /** The sprint the story is planned in, or null when it is not planned. */
  sprintId: string | null;
  /** Global priority, 0 is the most important. Board order is this order filtered by column. */
  rank: number;
  criteria: Criterion[];
}

export interface Snapshot {
  epics: Epic[];
  sprints: Sprint[];
  stories: Story[];
}
