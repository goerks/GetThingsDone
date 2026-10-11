export type Status = 'todo' | 'in_progress' | 'review' | 'done';

export const STATUSES: readonly Status[] = ['todo', 'in_progress', 'review', 'done'];

export const EPIC_COLOR_KEYS = ['blue', 'amber', 'teal', 'violet', 'rose', 'green', 'cyan', 'slate'] as const;

export type EpicColorKey = (typeof EPIC_COLOR_KEYS)[number];

export const POINT_VALUES: readonly number[] = [1, 2, 3, 5, 8, 13];

export interface Epic {
  id: string;
  name: string;
  colorKey: EpicColorKey;
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
  inSprint: boolean;
  /** Global priority, 0 is the most important. Board order is this order filtered by column. */
  rank: number;
  criteria: Criterion[];
}

export interface Snapshot {
  epics: Epic[];
  stories: Story[];
}
