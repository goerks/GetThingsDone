import type { Epic, FieldValue, Member, Release, Sprint, Story } from './types';

/*
 * Change log of the items (#23, ADR 0004). Every save of an item that changes a tracked field is one version of
 * that item. A version keeps the whole tracked state of the item after the save, as raw values (ids, no
 * translated text), so any two versions can be compared and the text follows the chosen language. What a version
 * changed is worked out by comparing it with the version before it. The mechanism knows no item type: an adapter
 * turns an item into a state, and a new item type (custom hierarchy levels, #29) only needs such an adapter.
 */

/** A reference to another item. The label is the name it had when the version was saved. */
export interface RefValue {
  id: string;
  label: string;
}

/** An entry of a list: an acceptance criterion, or a story in a sprint. `points` is shown but never compared. */
export interface ListEntry {
  id: string;
  text: string;
  done?: boolean;
  points?: number;
}

export type StateValue = string | number | boolean | string[] | RefValue | ListEntry[] | null;

/** The tracked values of an item by key: a built-in key such as `title`, or `field:<id>` for a custom field. */
export type ItemState = Record<string, StateValue>;

/** `created` is the first version of an item made while the history runs, `baseline` the first version of an item that is older than the history. */
export type VersionOrigin = 'created' | 'baseline' | 'changed';

export interface ChangeVersion {
  id: string;
  /** When it was saved, as an ISO timestamp (UTC). */
  at: string;
  /** `story`, `epic`, `sprint`, `release`, later the key of a custom item type. */
  itemType: string;
  itemId: string;
  /** 1 for the first version of the item, then counting up without gaps. */
  version: number;
  origin: VersionOrigin;
  /** The keys this version changed compared with the one before; empty for `created` and `baseline`. */
  keys: string[];
  state: ItemState;
}

/** Edits of one field within this time of the last save are merged into one version. */
export const COALESCE_MS = 60_000;

const CUSTOM_PREFIX = 'field:';
export const customKey = (fieldId: string): string => `${CUSTOM_PREFIX}${fieldId}`;
export const isCustomKey = (key: string): boolean => key.startsWith(CUSTOM_PREFIX);
export const fieldIdOf = (key: string): string => key.slice(CUSTOM_PREFIX.length);

/** The order in which fields are listed; custom fields follow, in the order of the field library. */
export const KEY_ORDER: readonly string[] = ['title', 'status', 'points', 'epic', 'sprint', 'release', 'assignee', 'description', 'criteria', 'color', 'start', 'end', 'state', 'stories'];

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
export const isRef = (value: StateValue | undefined): value is RefValue => isObject(value) && typeof value.id === 'string' && typeof value.label === 'string';
export const isList = (value: StateValue | undefined): value is ListEntry[] => Array.isArray(value) && value.some((entry) => isObject(entry));

/** A value in a form that is equal when two values mean the same: no order in lists, a reference is its id, empty is nothing. */
function canonical(value: StateValue | undefined): string {
  if (value === undefined || value === null || value === '') return 'null';
  if (isRef(value)) return `ref:${value.id}`;
  if (Array.isArray(value)) {
    if (value.length === 0) return 'null';
    if (isList(value)) {
      return JSON.stringify([...value].map((entry) => [entry.id, entry.text, entry.done ?? null]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
    }
    return JSON.stringify([...(value as string[])].sort());
  }
  return JSON.stringify(value);
}

export const sameValue = (a: StateValue | undefined, b: StateValue | undefined): boolean => canonical(a) === canonical(b);

/** The keys whose values differ, in the order of `KEY_ORDER` and then the order they first appear. */
export function changedKeys(before: ItemState, after: ItemState): string[] {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return sortKeys(keys.filter((key) => !sameValue(before[key], after[key])));
}

export function sortKeys(keys: readonly string[]): string[] {
  const rank = (key: string): number => {
    const index = KEY_ORDER.indexOf(key);
    return index === -1 ? KEY_ORDER.length : index;
  };
  return keys.map((key, index) => ({ key, index })).sort((a, b) => rank(a.key) - rank(b.key) || a.index - b.index).map((entry) => entry.key);
}

/** What changed in one field between two states. */
export type FieldChange =
  | { key: string; kind: 'value'; before: StateValue; after: StateValue }
  | { key: string; kind: 'list'; added: ListEntry[]; removed: ListEntry[]; ticked: ListEntry[]; unticked: ListEntry[]; edited: Array<{ before: ListEntry; after: ListEntry }> };

const asList = (value: StateValue | undefined): ListEntry[] => (isList(value) ? value : []);

function listChange(key: string, before: StateValue | undefined, after: StateValue | undefined): FieldChange {
  const old = new Map(asList(before).map((entry) => [entry.id, entry]));
  const next = asList(after);
  const change: Extract<FieldChange, { kind: 'list' }> = { key, kind: 'list', added: [], removed: [], ticked: [], unticked: [], edited: [] };
  for (const entry of next) {
    const was = old.get(entry.id);
    old.delete(entry.id);
    if (!was) change.added.push(entry);
    else {
      if (was.text !== entry.text) change.edited.push({ before: was, after: entry });
      if (!was.done && entry.done) change.ticked.push(entry);
      if (was.done && !entry.done) change.unticked.push(entry);
    }
  }
  change.removed.push(...old.values());
  return change;
}

const isListKey = (before: StateValue | undefined, after: StateValue | undefined): boolean => isList(before) || isList(after);

/** The changes between two states, field by field. */
export function diffStates(before: ItemState, after: ItemState): FieldChange[] {
  return changedKeys(before, after).map((key) =>
    isListKey(before[key], after[key]) ? listChange(key, before[key], after[key]) : { key, kind: 'value', before: before[key] ?? null, after: after[key] ?? null }
  );
}

/** One row of the comparison of two versions. */
export interface CompareRow {
  key: string;
  same: boolean;
  before: StateValue;
  after: StateValue;
  /** For lists: what was added, removed, ticked and edited. */
  list: Extract<FieldChange, { kind: 'list' }> | null;
}

/** Compares two states for the side by side view: every key of either state, changed or not. */
export function compareStates(before: ItemState, after: ItemState): CompareRow[] {
  const keys = sortKeys([...new Set([...Object.keys(before), ...Object.keys(after)])]);
  return keys.map((key) => {
    const same = sameValue(before[key], after[key]);
    const list = isListKey(before[key], after[key]) ? (listChange(key, before[key], after[key]) as Extract<FieldChange, { kind: 'list' }>) : null;
    return { key, same, before: before[key] ?? null, after: after[key] ?? null, list };
  });
}

/* ---------- States of the items ---------- */

/** Everything the states are made from. */
export interface World {
  /** Needed to name the assignee of a story; without it the label is the id. */
  members?: readonly Member[];
  stories: readonly Story[];
  epics: readonly Epic[];
  sprints: readonly Sprint[];
  releases: readonly Release[];
}

/** An item with its state, keyed in `statesOf` by type and id. */
export interface TrackedItem {
  itemType: string;
  itemId: string;
  state: ItemState;
}

const itemKey = (itemType: string, itemId: string): string => `${itemType}:${itemId}`;

function customStates(values: Record<string, FieldValue> | undefined): ItemState {
  const state: ItemState = {};
  for (const [fieldId, value] of Object.entries(values ?? {})) state[customKey(fieldId)] = Array.isArray(value) ? [...value] : value;
  return state;
}

const reference = (id: string | null, labels: ReadonlyMap<string, string>): RefValue | null => (id === null ? null : { id, label: labels.get(id) ?? id });

/** The states of all stories, epics, sprints and releases. A sprint knows the stories planned in it. */
export function statesOf(world: World): Map<string, TrackedItem> {
  const epicNames = new Map(world.epics.map((epic) => [epic.id, epic.name]));
  const sprintNames = new Map(world.sprints.map((sprint) => [sprint.id, sprint.name]));
  const releaseNames = new Map(world.releases.map((release) => [release.id, release.title]));
  const memberNames = new Map((world.members ?? []).map((member) => [member.id, member.name]));
  const states = new Map<string, TrackedItem>();
  const put = (itemType: string, itemId: string, state: ItemState): void => {
    states.set(itemKey(itemType, itemId), { itemType, itemId, state });
  };
  const inSprint = new Map<string, ListEntry[]>();
  for (const story of world.stories) {
    put('story', story.id, {
      title: story.title,
      description: story.description,
      status: story.status,
      points: story.points,
      epic: reference(story.epicId, epicNames),
      sprint: reference(story.sprintId, sprintNames),
      release: reference(story.releaseId, releaseNames),
      // Only an assigned story has the key, so the states of stories without assignee stay as they were before the team.
      ...(story.assigneeId ? { assignee: reference(story.assigneeId, memberNames) } : {}),
      criteria: story.criteria.map((criterion) => ({ id: criterion.id, text: criterion.text, done: criterion.done })),
      ...customStates(story.values)
    });
    if (story.sprintId) inSprint.set(story.sprintId, [...(inSprint.get(story.sprintId) ?? []), { id: story.id, text: story.code, points: story.points }]);
  }
  for (const epic of world.epics) put('epic', epic.id, { title: epic.name, color: epic.colorKey, ...customStates(epic.values) });
  for (const sprint of world.sprints) {
    put('sprint', sprint.id, {
      title: sprint.name,
      start: sprint.startDate,
      end: sprint.endDate,
      state: sprint.state,
      stories: inSprint.get(sprint.id) ?? [],
      ...customStates((sprint as { values?: Record<string, FieldValue> }).values)
    });
  }
  for (const release of world.releases) {
    put('release', release.id, {
      title: release.title,
      description: release.description,
      start: release.startDate,
      end: release.endDate,
      ...customStates((release as { values?: Record<string, FieldValue> }).values)
    });
  }
  return states;
}

/* ---------- Recording ---------- */

/** What a change does to the stored log: versions to insert or replace, and versions to delete. */
export interface LogWrites {
  upsert: ChangeVersion[];
  remove: string[];
}

export const NO_WRITES: LogWrites = { upsert: [], remove: [] };

/** The versions of one item, oldest first. */
export function versionsOf(log: readonly ChangeVersion[], itemType: string, itemId: string): ChangeVersion[] {
  return log.filter((entry) => entry.itemType === itemType && entry.itemId === itemId).sort((a, b) => a.version - b.version);
}

function byItem(log: readonly ChangeVersion[]): Map<string, ChangeVersion[]> {
  const groups = new Map<string, ChangeVersion[]>();
  for (const entry of log) {
    const key = itemKey(entry.itemType, entry.itemId);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  for (const list of groups.values()) list.sort((a, b) => a.version - b.version);
  return groups;
}

/**
 * The write that records a new state of an item, given its versions so far. Nothing is written when no tracked
 * field changed. Edits of the same fields within `COALESCE_MS` of the last save replace that version, and drop it
 * when they end up where the version before it was.
 */
function nextWrite(versions: readonly ChangeVersion[], item: TrackedItem, at: string, newId: () => string): LogWrites {
  const last = versions[versions.length - 1];
  if (!last) {
    return { upsert: [{ id: newId(), at, itemType: item.itemType, itemId: item.itemId, version: 1, origin: 'created', keys: [], state: item.state }], remove: [] };
  }
  const keys = changedKeys(last.state, item.state);
  if (keys.length === 0) return NO_WRITES;
  const quick = last.origin === 'changed' && Date.parse(at) - Date.parse(last.at) < COALESCE_MS && keys.every((key) => last.keys.includes(key));
  if (quick) {
    const before = versions[versions.length - 2];
    const net = before ? changedKeys(before.state, item.state) : keys;
    if (net.length === 0) return { upsert: [], remove: [last.id] };
    return { upsert: [{ ...last, at, state: item.state, keys: net }], remove: [] };
  }
  return { upsert: [{ id: newId(), at, itemType: item.itemType, itemId: item.itemId, version: last.version + 1, origin: 'changed', keys, state: item.state }], remove: [] };
}

/** Applies writes to a log. */
export function applyWrites(log: readonly ChangeVersion[], writes: LogWrites): ChangeVersion[] {
  if (writes.upsert.length === 0 && writes.remove.length === 0) return log as ChangeVersion[];
  const removed = new Set(writes.remove);
  const replaced = new Map(writes.upsert.map((entry) => [entry.id, entry]));
  const kept = log.filter((entry) => !removed.has(entry.id)).map((entry) => replaced.get(entry.id) ?? entry);
  const known = new Set(kept.map((entry) => entry.id));
  return [...kept, ...writes.upsert.filter((entry) => !known.has(entry.id))];
}

/**
 * Records what changed between two sets of item states: a new item starts its history, a changed one gets a new
 * version, a deleted one loses its history. This is the generic core; `recordWorld` makes the states for the
 * items of the app.
 */
export function recordStates(
  log: readonly ChangeVersion[],
  before: ReadonlyMap<string, TrackedItem>,
  after: ReadonlyMap<string, TrackedItem>,
  at: string,
  newId: () => string
): LogWrites {
  const groups = byItem(log);
  const writes: LogWrites = { upsert: [], remove: [] };
  for (const [key, item] of after) {
    const old = before.get(key);
    if (old && JSON.stringify(old.state) === JSON.stringify(item.state)) continue;
    const next = nextWrite(groups.get(key) ?? [], item, at, newId);
    writes.upsert.push(...next.upsert);
    writes.remove.push(...next.remove);
  }
  for (const [key] of before) {
    if (after.has(key)) continue;
    writes.remove.push(...(groups.get(key) ?? []).map((entry) => entry.id));
  }
  return writes;
}

/** Records what a change of the stories, epics, sprints or releases did. */
export function recordWorld(log: readonly ChangeVersion[], before: World, after: World, at: string, newId: () => string): LogWrites {
  return recordStates(log, statesOf(before), statesOf(after), at, newId);
}

/**
 * Gives every item that has no version yet its first version, with the state it has now. Used when the app starts
 * and after an import, so items that are older than the history can be compared later.
 */
export function baselineWrites(log: readonly ChangeVersion[], states: ReadonlyMap<string, TrackedItem>, at: string, newId: () => string): LogWrites {
  const groups = byItem(log);
  const upsert: ChangeVersion[] = [];
  for (const [key, item] of states) {
    if (groups.has(key)) continue;
    upsert.push({ id: newId(), at, itemType: item.itemType, itemId: item.itemId, version: 1, origin: 'baseline', keys: [], state: item.state });
  }
  return { upsert, remove: [] };
}

/** The versions of items that are gone, so they can be deleted (after an import for example). */
export function orphanRemovals(log: readonly ChangeVersion[], states: ReadonlyMap<string, TrackedItem>): string[] {
  return log.filter((entry) => !states.has(itemKey(entry.itemType, entry.itemId))).map((entry) => entry.id);
}
