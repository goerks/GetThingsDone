/** The id of a status value. The team configures the status values (#5); the defaults are todo, in_progress, review, done. */
export type Status = string;

/** Fixed categories of the status values, in board order. A story is done when its status is in "done". */
export type StatusCategory = 'not_started' | 'in_progress' | 'done';

/** One status value, which is also a column of the board. The order of the list is the board order. */
export interface StatusValue {
  id: string;
  /** Null shows the translated default label of a default status value. One label for every language. */
  label: string | null;
  category: StatusCategory;
}

export const EPIC_COLOR_KEYS = ['blue', 'amber', 'teal', 'violet', 'rose', 'green', 'cyan', 'slate'] as const;

export type EpicColorKey = (typeof EPIC_COLOR_KEYS)[number];

export const POINT_VALUES: readonly number[] = [1, 2, 3, 5, 8, 13];

export interface Epic {
  id: string;
  name: string;
  colorKey: EpicColorKey;
  /** Column order on the story map and order in lists, 0 first. */
  position: number;
  /** Values of custom fields by field id. */
  values: Record<string, FieldValue>;
}

/** Where a sprint is in its life (#17): planned, running (at most one) or completed. */
export type SprintState = 'planned' | 'running' | 'completed';

/** A story as it was in a sprint when the sprint was started. The code stays readable after the story is deleted. */
export interface SprintStartItem {
  storyId: string;
  code: string;
  points: number;
}

/** What a sprint achieved, stored when it is completed. Points of stories without points count as 0. */
export interface SprintResult {
  /** The day the sprint was completed, `YYYY-MM-DD`. */
  completedOn: string;
  plannedPoints: number;
  plannedStories: number;
  donePoints: number;
  doneStories: number;
  notDonePoints: number;
  notDoneStories: number;
  /** Stories that joined the sprint after its start, and their points. */
  addedStories: number;
  addedPoints: number;
  /** Stories that left the sprint after its start, with their points at the start. */
  removedStories: number;
  removedPoints: number;
  /** Net change of the points of the stories that stayed in the sprint. */
  changedPoints: number;
}

/**
 * A time box. Dates are local calendar days as `YYYY-MM-DD`; both days belong to the sprint.
 * A sprint runs when it is started, not by its dates (#17).
 */
export interface Sprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  state: SprintState;
  /** The stories in the sprint when it was started, or null while it is planned. */
  startItems: SprintStartItem[] | null;
  /** Set when the sprint is completed. */
  result: SprintResult | null;
}

/**
 * A release groups stories and gets its size from their points (#10). Dates are local calendar days as
 * `YYYY-MM-DD`; both are optional, and both days belong to the release.
 */
export interface Release {
  id: string;
  title: string;
  description: string;
  startDate: string | null;
  endDate: string | null;
}

/**
 * One entry of the history of a release (#10, phase 3). The history is append-only: entries are added, never
 * changed. `baseline` marks the stories a release had when its history started; `added` and `removed` are a story
 * joining or leaving the release (also by deleting it), `points` a change of its points, `done` and `reopened` a
 * change of its status into or out of done. `points` and `done` are the values of the story after the entry.
 */
export type ReleaseEventKind = 'baseline' | 'added' | 'removed' | 'points' | 'done' | 'reopened';

export interface ReleaseEvent {
  id: string;
  /** When it happened, as an ISO timestamp (UTC). */
  at: string;
  releaseId: string;
  storyId: string;
  /** The key of the story at that time, so the entry stays readable after the story is deleted. */
  code: string;
  kind: ReleaseEventKind;
  points: number;
  done: boolean;
}

export interface Criterion {
  id: string;
  text: string;
  done: boolean;
}

/** Kinds of items that can carry fields. Releases carry built-in fields only for now; sprints follow later. */
export type ItemType = 'epic' | 'story' | 'release';

export const ITEM_TYPES: readonly ItemType[] = ['story', 'epic', 'release'];

/** Data types a team can choose for its own fields. */
export type CustomDataType =
  | 'text'
  | 'long_text'
  | 'number'
  | 'date'
  | 'checkbox'
  | 'single_select'
  | 'multi_select'
  | 'url';

export const CUSTOM_DATA_TYPES: readonly CustomDataType[] = [
  'text',
  'long_text',
  'number',
  'date',
  'checkbox',
  'single_select',
  'multi_select',
  'url'
];

/** Data types that only system and built-in fields have. */
export type BuiltinDataType = 'key' | 'status' | 'epic' | 'release' | 'points' | 'checklist' | 'color';

export type FieldDataType = CustomDataType | BuiltinDataType;

/** System fields cannot be removed, built-in fields can be hidden, custom fields belong to the team. */
export type FieldKind = 'system' | 'builtin' | 'custom';

export type BuiltinKey =
  | 'key'
  | 'title'
  | 'status'
  | 'description'
  | 'epic'
  | 'release'
  | 'points'
  | 'criteria'
  | 'color'
  | 'start'
  | 'end';

export interface FieldOption {
  id: string;
  label: string;
  colorKey: EpicColorKey;
}

/** One field of the workspace's field library (see ADR 0003). */
export interface FieldDefinition {
  id: string;
  /** Set for system and built-in fields, null for custom fields. */
  builtinKey: BuiltinKey | null;
  kind: FieldKind;
  dataType: FieldDataType;
  /** Null shows the translated default label of a system or built-in field. */
  label: string | null;
  /** Ordered options of a single select field, empty otherwise. */
  options: FieldOption[];
  /** Value a new item starts with, or null. For a select field the id of an option. */
  defaultValue: FieldValue | null;
}

/** Puts a field on an item type. */
export interface FieldAssignment {
  itemType: ItemType;
  fieldId: string;
  position: number;
  required: boolean;
  hidden: boolean;
  onCard: boolean;
  inCreate: boolean;
}

/**
 * Text, a number, a date (`YYYY-MM-DD`), a link, `true` for a ticked checkbox, the id of a select option,
 * or the ids of the chosen options of a multi select. A missing entry means no value.
 */
export type FieldValue = string | number | boolean | string[];

export interface Story {
  id: string;
  /** Human readable key such as "S-4". */
  code: string;
  title: string;
  description: string;
  /** Null when the story belongs to no epic. */
  epicId: string | null;
  points: number;
  status: Status;
  /** The sprint the story is planned in, or null when it is not planned. */
  sprintId: string | null;
  /** The release the story belongs to (at most one), or null. */
  releaseId: string | null;
  /** Global priority, 0 is the most important. Board order is this order filtered by column. */
  rank: number;
  criteria: Criterion[];
  /** Values of custom fields by field id. */
  values: Record<string, FieldValue>;
}

/** What the rows of the story map are. */
/** Features a team can switch on and off (#10). */
export type FeatureKey = 'releases';
export type Features = Record<FeatureKey, boolean>;

export type MapRows = 'sprints' | 'releases';

/** Settings of the workspace, shared by the whole team. */
export interface Settings {
  mapRows: MapRows;
  /** Feature toggles; a feature that is off is hidden everywhere but its data is kept. */
  features: Features;
}

export interface Snapshot {
  epics: Epic[];
  sprints: Sprint[];
  releases: Release[];
  /** History of the releases, oldest first. */
  events: ReleaseEvent[];
  stories: Story[];
  /** Status values in board order (#5). */
  statuses: StatusValue[];
  fields: FieldDefinition[];
  assignments: FieldAssignment[];
  settings: Settings;
}

/** What the search reads: the items and the fields, not the releases' history or the settings. */
export type SearchSnapshot = Pick<Snapshot, 'epics' | 'sprints' | 'stories' | 'statuses' | 'fields' | 'assignments'>;
