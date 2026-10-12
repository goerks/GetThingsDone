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
  /** Values of custom fields by field id. */
  values: Record<string, FieldValue>;
}

/** A time box. Dates are local calendar days as `YYYY-MM-DD`; both days belong to the sprint. */
export interface Sprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
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

export interface Snapshot {
  epics: Epic[];
  sprints: Sprint[];
  releases: Release[];
  stories: Story[];
  fields: FieldDefinition[];
  assignments: FieldAssignment[];
}

/** What the search reads: the items and the fields, not the releases' history or the settings. */
export type SearchSnapshot = Pick<Snapshot, 'epics' | 'sprints' | 'stories' | 'fields' | 'assignments'>;
