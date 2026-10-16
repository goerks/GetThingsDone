import { categoryOf, STATUS_CATEGORIES } from './statuses';
import type {
  DefinitionCheck,
  DefinitionGroup,
  DefinitionItem,
  DefinitionKind,
  DefinitionList,
  DefinitionRule,
  Definitions,
  Status,
  StatusValue,
  Story
} from './types';

/** The Definition of Ready is asked when a story leaves "not started", the Definition of Done when it enters "done" (#26). */
export const DEFINITION_KINDS: readonly DefinitionKind[] = ['ready', 'done'];

/** The catalogue of automatic items, in the order of the "add" menu. */
export const DEFINITION_RULES: readonly DefinitionRule[] = [
  'hasDescription',
  'hasCriteria',
  'hasPoints',
  'hasEpic',
  'allCriteriaAccepted',
  'inSprint'
];

/** A list is off until the team switches it on (#26): an off list is not shown in stories, checked or marked. */
export const EMPTY_LIST: DefinitionList = { enforce: false, groups: [] };

export const EMPTY_DEFINITIONS: Definitions = { ready: EMPTY_LIST, done: EMPTY_LIST };

/** Whether an automatic item is met by a story. */
export function ruleMet(rule: DefinitionRule, story: Story): boolean {
  switch (rule) {
    case 'hasDescription':
      return story.description.trim().length > 0;
    case 'hasCriteria':
      return story.criteria.length > 0;
    case 'hasPoints':
      return story.points !== null;
    case 'hasEpic':
      return story.epicId !== null;
    case 'allCriteriaAccepted':
      return story.criteria.length > 0 && story.criteria.every((criterion) => criterion.done);
    case 'inSprint':
      return story.sprintId !== null;
  }
}

export type ItemState = 'open' | 'checked' | 'na';

/** The state of one item for a story. "Not relevant" stays when the item stops allowing it. */
export function itemState(item: DefinitionItem, story: Story): ItemState {
  if (story.checks[item.id] === 'na') return 'na';
  if (item.rule !== null) return ruleMet(item.rule, story) ? 'checked' : 'open';
  return story.checks[item.id] === 'checked' ? 'checked' : 'open';
}

export interface ItemResult {
  item: DefinitionItem;
  state: ItemState;
}

export interface GroupResult {
  group: DefinitionGroup;
  items: ItemResult[];
  checked: number;
  na: number;
}

export interface ListResult {
  groups: GroupResult[];
  total: number;
  checked: number;
  na: number;
  open: number;
  /** Nothing is open: every item is checked or not relevant. */
  met: boolean;
}

/** Evaluates a list for a story. With `only`, just the items with these ids count (the snapshot of a done story). */
export function evaluate(list: DefinitionList, story: Story, only?: ReadonlySet<string>): ListResult {
  const groups: GroupResult[] = [];
  for (const group of list.groups) {
    const items = group.items
      .filter((item) => !only || only.has(item.id))
      .map((item) => ({ item, state: itemState(item, story) }));
    if (items.length === 0) continue;
    groups.push({
      group,
      items,
      checked: items.filter((entry) => entry.state === 'checked').length,
      na: items.filter((entry) => entry.state === 'na').length
    });
  }
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  const checked = groups.reduce((sum, group) => sum + group.checked, 0);
  const na = groups.reduce((sum, group) => sum + group.na, 0);
  const open = total - checked - na;
  return { groups, total, checked, na, open, met: open === 0 };
}

/** All items of a list in order. */
export function itemsOf(list: DefinitionList): DefinitionItem[] {
  return list.groups.flatMap((group) => group.items);
}

/** A list that is in use: switched on and with at least one item. Only such a list shows in stories, asks and marks. */
export function inUse(list: DefinitionList): boolean {
  return list.enforce && itemsOf(list).length > 0;
}

/** The lists a change of status crosses: Ready when leaving "not started", Done when entering "done". Backwards nothing. */
export function gatesCrossed(statuses: readonly StatusValue[], from: Status, to: Status): DefinitionKind[] {
  const a = categoryOf(statuses, from);
  const b = categoryOf(statuses, to);
  if (!a || !b) return [];
  const order = (category: NonNullable<typeof a>): number => STATUS_CATEGORIES.indexOf(category);
  if (order(b) <= order(a)) return [];
  const gates: DefinitionKind[] = [];
  if (a === 'not_started') gates.push('ready');
  if (b === 'done') gates.push('done');
  return gates;
}

/** The lists a change of status has to ask for: crossed, in use and not met by the story. */
export function gatesToAsk(definitions: Definitions, statuses: readonly StatusValue[], story: Story, to: Status): DefinitionKind[] {
  return gatesCrossed(statuses, story.status, to).filter((kind) => inUse(definitions[kind]) && !evaluate(definitions[kind], story).met);
}

/** Sets an item of a story to "checked" or "not relevant"; null makes it open again. */
export function setCheck(stories: Story[], storyId: string, itemId: string, state: DefinitionCheck | null): Story[] {
  return stories.map((story) => {
    if (story.id !== storyId) return story;
    const checks = { ...story.checks };
    if (state === null) delete checks[itemId];
    else checks[itemId] = state;
    return { ...story, checks };
  });
}

/** Drops the states of items that no longer exist. Returns the same array when nothing changes. */
export function pruneChecks(stories: Story[], definitions: Definitions): Story[] {
  const known = new Set(DEFINITION_KINDS.flatMap((kind) => itemsOf(definitions[kind]).map((item) => item.id)));
  let changed = false;
  const result = stories.map((story) => {
    const stale = Object.keys(story.checks).filter((id) => !known.has(id));
    if (stale.length === 0) return story;
    changed = true;
    const checks = { ...story.checks };
    for (const id of stale) delete checks[id];
    return { ...story, checks };
  });
  return changed ? result : stories;
}

/**
 * Remembers the Done list a story is held to: when it enters "done" the items that apply now (none while the list is
 * off or empty), when it leaves "done" nothing.
 */
export function withDoneSnapshots(
  before: readonly Story[],
  after: Story[],
  wasDone: (story: Story) => boolean,
  isDone: (story: Story) => boolean,
  definitions: Definitions
): Story[] {
  const previous = new Map(before.map((story) => [story.id, story]));
  const current = inUse(definitions.done) ? itemsOf(definitions.done).map((item) => item.id) : [];
  let changed = false;
  const result = after.map((story) => {
    const old = previous.get(story.id);
    if (!old) return story;
    const done = isDone(story);
    if (done && !wasDone(old)) {
      changed = true;
      return { ...story, doneItems: current };
    }
    if (!done && wasDone(old) && story.doneItems !== null) {
      changed = true;
      return { ...story, doneItems: null };
    }
    return story;
  });
  return changed ? result : after;
}

/** What a story still lacks of the Ready list, or null when the story is not asked (done, list off or empty, met). */
export function notReady(definitions: Definitions, story: Story, done: boolean): ListResult | null {
  if (done || !inUse(definitions.ready)) return null;
  const result = evaluate(definitions.ready, story);
  return result.met ? null : result;
}

/** What a done story lacks of the Done list that applied when it became done, or null when nothing. */
export function notDone(definitions: Definitions, story: Story, done: boolean): ListResult | null {
  if (!done || story.doneItems === null || story.doneItems.length === 0) return null;
  const result = evaluate(definitions.done, story, new Set(story.doneItems));
  return result.met || result.total === 0 ? null : result;
}

// ----- editing the lists -----

const GENERAL: DefinitionGroup = { id: '', name: '', items: [] };

function mapList(list: DefinitionList, change: (groups: DefinitionGroup[]) => DefinitionGroup[]): DefinitionList {
  return { ...list, groups: change(list.groups) };
}

export function setEnforce(list: DefinitionList, enforce: boolean): DefinitionList {
  return { ...list, enforce };
}

export function addGroup(list: DefinitionList, id: string, name: string): DefinitionList {
  return mapList(list, (groups) => [...groups, { id, name: name.trim(), items: [] }]);
}

export function renameGroup(list: DefinitionList, groupId: string, name: string): DefinitionList {
  return mapList(list, (groups) => groups.map((group) => (group.id === groupId ? { ...group, name: name.trim() } : group)));
}

export function removeGroup(list: DefinitionList, groupId: string): DefinitionList {
  return mapList(list, (groups) => groups.filter((group) => group.id !== groupId));
}

/** Adds an item at the end of a group. Without a group (or with an unknown one) the first group takes it; a list without groups gets a general group. */
export function addItem(list: DefinitionList, groupId: string | null, item: DefinitionItem, newGroupId: string): DefinitionList {
  const clean = { ...item, text: item.rule === null ? item.text.trim() : '' };
  if (item.rule === null && !clean.text) return list;
  if (list.groups.length === 0) return { ...list, groups: [{ ...GENERAL, id: newGroupId, items: [clean] }] };
  const target = list.groups.some((group) => group.id === groupId) ? groupId : list.groups[0].id;
  return mapList(list, (groups) => groups.map((group) => (group.id === target ? { ...group, items: [...group.items, clean] } : group)));
}

export interface ItemPatch {
  text?: string;
  mayBeIrrelevant?: boolean;
}

/** Changes the text (manual items only; an empty text is ignored) or the "may be irrelevant" flag of an item. */
export function updateItem(list: DefinitionList, itemId: string, patch: ItemPatch): DefinitionList {
  return mapList(list, (groups) =>
    groups.map((group) => ({
      ...group,
      items: group.items.map((item) => {
        if (item.id !== itemId) return item;
        const next = { ...item };
        if (patch.text !== undefined && item.rule === null && patch.text.trim()) next.text = patch.text.trim();
        if (patch.mayBeIrrelevant !== undefined) next.mayBeIrrelevant = patch.mayBeIrrelevant;
        return next;
      })
    }))
  );
}

export function removeItem(list: DefinitionList, itemId: string): DefinitionList {
  return mapList(list, (groups) => groups.map((group) => ({ ...group, items: group.items.filter((item) => item.id !== itemId) })));
}

type Row = { type: 'group'; group: DefinitionGroup } | { type: 'item'; item: DefinitionItem };

const rowId = (row: Row): string => (row.type === 'group' ? row.group.id : row.item.id);

function flatten(list: DefinitionList): Row[] {
  return list.groups.flatMap((group): Row[] => [{ type: 'group', group }, ...group.items.map((item): Row => ({ type: 'item', item }))]);
}

function rebuild(list: DefinitionList, rows: Row[]): DefinitionList {
  const groups: DefinitionGroup[] = [];
  for (const row of rows) {
    if (row.type === 'group') groups.push({ ...row.group, items: [] });
    else if (groups.length > 0) groups[groups.length - 1].items.push(row.item);
  }
  // Items in front of the first group (moved to the top) join the first group.
  const leading: DefinitionItem[] = [];
  for (const row of rows) {
    if (row.type === 'group') break;
    leading.push(row.item);
  }
  if (leading.length > 0 && groups.length > 0) groups[0].items.unshift(...leading);
  return { ...list, groups };
}

/** Moves an item to the place of another row (drag and drop). Items travel across groups; a group row moves its group. */
export function moveRow(list: DefinitionList, activeId: string, overId: string): DefinitionList {
  if (activeId === overId) return list;
  const rows = flatten(list);
  const active = rows.find((row) => rowId(row) === activeId);
  const over = rows.find((row) => rowId(row) === overId);
  if (!active || !over) return list;
  if (active.type === 'group') {
    const groups = [...list.groups];
    const from = groups.findIndex((group) => group.id === activeId);
    const target = over.type === 'group' ? over.group.id : (list.groups.find((group) => group.items.some((item) => item.id === overId))?.id ?? '');
    const to = groups.findIndex((group) => group.id === target);
    if (from < 0 || to < 0 || from === to) return list;
    const [moved] = groups.splice(from, 1);
    groups.splice(to, 0, moved);
    return { ...list, groups };
  }
  const from = rows.indexOf(active);
  const next = [...rows];
  next.splice(from, 1);
  // Dropped on a group header, the item becomes the first of that group; dropped on another item, it takes its place.
  const to = over.type === 'group' ? next.indexOf(over) + 1 : rows.indexOf(over);
  next.splice(to, 0, active);
  return rebuild(list, next);
}

/** Moves an item or group one place up or down (keyboard). */
export function stepRow(list: DefinitionList, id: string, direction: -1 | 1): DefinitionList {
  const rows = flatten(list);
  const index = rows.findIndex((row) => rowId(row) === id);
  if (index < 0) return list;
  const row = rows[index];
  if (row.type === 'group') {
    const at = list.groups.findIndex((group) => group.id === id);
    const to = at + direction;
    if (to < 0 || to >= list.groups.length) return list;
    const groups = [...list.groups];
    [groups[at], groups[to]] = [groups[to], groups[at]];
    return { ...list, groups };
  }
  const to = index + direction;
  if (to < 0 || to >= rows.length) return list;
  const next = [...rows];
  [next[index], next[to]] = [next[to], next[index]];
  // An item stepping up over the first group header would lose its group; keep it as the first item.
  if (next[0].type === 'item') return list;
  return rebuild(list, next);
}

// ----- example lists -----

/**
 * The example lists the editor offers for an empty list, and the demo data uses (#26). The texts are data of the team, not
 * interface texts, so they are not translated.
 */
const EXAMPLES: Definitions = {
  ready: {
    enforce: true,
    groups: [
      {
        id: 'group-ready-functional',
        name: 'Functional',
        items: [
          { id: 'def-ready-description', text: '', rule: 'hasDescription', mayBeIrrelevant: false },
          { id: 'def-ready-criteria', text: '', rule: 'hasCriteria', mayBeIrrelevant: false }
        ]
      },
      {
        id: 'group-ready-technical',
        name: 'Technical',
        items: [{ id: 'def-ready-dependencies', text: 'Dependencies are clarified', rule: null, mayBeIrrelevant: true }]
      },
      {
        id: 'group-ready-design',
        name: 'Design',
        items: [
          { id: 'def-ready-design', text: 'Design is available', rule: null, mayBeIrrelevant: true },
          { id: 'def-ready-texts', text: 'Texts are agreed', rule: null, mayBeIrrelevant: true }
        ]
      }
    ]
  },
  done: {
    enforce: true,
    groups: [
      {
        id: 'group-done-quality',
        name: 'Quality',
        items: [
          { id: 'def-done-accepted', text: '', rule: 'allCriteriaAccepted', mayBeIrrelevant: false },
          { id: 'def-done-review', text: 'Code is reviewed', rule: null, mayBeIrrelevant: false }
        ]
      },
      {
        id: 'group-done-docs',
        name: 'Documentation',
        items: [{ id: 'def-done-docs', text: 'Documentation is updated', rule: null, mayBeIrrelevant: true }]
      }
    ]
  }
};

/** The example list of a kind, switched on, with fresh ids so it can be added to data that has one already. */
export function exampleList(kind: DefinitionKind, newId: () => string): DefinitionList {
  const source = EXAMPLES[kind];
  return { enforce: true, groups: source.groups.map((group) => ({ ...group, id: newId(), items: group.items.map((item) => ({ ...item, id: newId() })) })) };
}

/** The demo lists: the example lists with their fixed ids, switched off like every list. */
export const DEMO_DEFINITIONS: Definitions = {
  ready: { ...EXAMPLES.ready, enforce: false },
  done: { ...EXAMPLES.done, enforce: false }
};

// ----- stored data -----

const isRule = (value: unknown): value is DefinitionRule => DEFINITION_RULES.includes(value as DefinitionRule);

function normalizeList(stored: unknown): DefinitionList {
  const raw = (stored ?? {}) as { enforce?: unknown; groups?: unknown };
  const groups: DefinitionGroup[] = [];
  if (Array.isArray(raw.groups)) {
    for (const group of raw.groups as Array<Partial<DefinitionGroup>>) {
      if (typeof group?.id !== 'string') continue;
      const items: DefinitionItem[] = [];
      for (const item of (Array.isArray(group.items) ? group.items : []) as Array<Partial<DefinitionItem>>) {
        if (typeof item?.id !== 'string') continue;
        const rule = isRule(item.rule) ? item.rule : null;
        const text = typeof item.text === 'string' ? item.text : '';
        if (rule === null && !text.trim()) continue;
        items.push({ id: item.id, text: rule === null ? text : '', rule, mayBeIrrelevant: item.mayBeIrrelevant === true });
      }
      groups.push({ id: group.id, name: typeof group.name === 'string' ? group.name : '', items });
    }
  }
  return { enforce: raw.enforce === true || raw.enforce === 'true' || raw.enforce === 1, groups };
}

/** The definitions from stored data; missing or unknown parts become empty lists that are switched on. */
export function normalizeDefinitions(stored: unknown): Definitions {
  const raw = (stored ?? {}) as Partial<Record<DefinitionKind, unknown>>;
  return { ready: normalizeList(raw.ready), done: normalizeList(raw.done) };
}
