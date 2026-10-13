import type { StatusCategory, StatusValue, Story } from './types';

/** The categories in board order. They are fixed; the team configures the status values inside them (#5). */
export const STATUS_CATEGORIES: readonly StatusCategory[] = ['not_started', 'in_progress', 'done'];

/** Categories that always keep at least one status value: new stories start in the first, "done" needs the last. */
export const REQUIRED_CATEGORIES: readonly StatusCategory[] = ['not_started', 'done'];

/** The status values every workspace starts with. Their labels are translated until the team renames them. */
export const DEFAULT_STATUSES: readonly StatusValue[] = [
  { id: 'todo', label: null, category: 'not_started' },
  { id: 'in_progress', label: null, category: 'in_progress' },
  { id: 'review', label: null, category: 'in_progress' },
  { id: 'done', label: null, category: 'done' }
];

/** Ids of the default status values, which have a translated label. */
export const DEFAULT_STATUS_IDS: readonly string[] = DEFAULT_STATUSES.map((status) => status.id);

/** Base colour of each category; the status values inside get lighter shades of it. */
export const CATEGORY_COLORS: Record<StatusCategory, string> = {
  not_started: 'var(--epic-slate)',
  in_progress: 'var(--epic-blue)',
  done: 'var(--epic-green)'
};

const categoryIndex = (category: StatusCategory): number => STATUS_CATEGORIES.indexOf(category);

const isCategory = (value: unknown): value is StatusCategory => STATUS_CATEGORIES.includes(value as StatusCategory);

/** Board order: by category, and inside a category in the given order. */
function sortByCategory(statuses: readonly StatusValue[]): StatusValue[] {
  return statuses
    .map((status, index) => ({ status, index }))
    .sort((a, b) => categoryIndex(a.status.category) - categoryIndex(b.status.category) || a.index - b.index)
    .map((entry) => entry.status);
}

/**
 * Status values from stored data: missing data gives the defaults, unknown categories and duplicates are dropped,
 * the order follows the categories, and a required category that is empty gets its default status back.
 */
export function normalizeStatuses(stored: ReadonlyArray<Partial<StatusValue>> | null | undefined): StatusValue[] {
  if (!stored || stored.length === 0) return DEFAULT_STATUSES.map((status) => ({ ...status }));
  const seen = new Set<string>();
  const statuses: StatusValue[] = [];
  for (const item of stored) {
    if (typeof item.id !== 'string' || !item.id || seen.has(item.id) || !isCategory(item.category)) continue;
    seen.add(item.id);
    const label = typeof item.label === 'string' && item.label.trim() ? item.label.trim() : null;
    statuses.push({ id: item.id, label: label ?? (DEFAULT_STATUS_IDS.includes(item.id) ? null : item.id), category: item.category });
  }
  for (const category of REQUIRED_CATEGORIES) {
    if (statuses.some((status) => status.category === category)) continue;
    const fallback = DEFAULT_STATUSES.find((status) => status.category === category && !seen.has(status.id));
    statuses.push(fallback ? { ...fallback } : { id: `${category}-${statuses.length}`, label: category, category });
  }
  return sortByCategory(statuses);
}

/** The status new stories get: the first one in board order, which is always in "not started". */
export function startStatus(statuses: readonly StatusValue[]): string {
  return statuses.find((status) => status.category === 'not_started')?.id ?? statuses[0]?.id ?? 'todo';
}

export function categoryOf(statuses: readonly StatusValue[], id: string): StatusCategory | null {
  return statuses.find((status) => status.id === id)?.category ?? null;
}

/** A check whether a story is done: its status is in the "done" category. An unknown status is not done. */
export type IsDone = (story: Pick<Story, 'status'>) => boolean;

export function isDoneIn(statuses: readonly StatusValue[]): IsDone {
  const done = new Set(statuses.filter((status) => status.category === 'done').map((status) => status.id));
  return (story) => done.has(story.status);
}

/** The status values of one category in board order. */
export function statusesIn(statuses: readonly StatusValue[], category: StatusCategory): StatusValue[] {
  return statuses.filter((status) => status.category === category);
}

/**
 * The colour of a status value: the base colour of its category for the first value, lighter shades for the
 * following ones. Colour never stands alone; the name is always shown next to it.
 */
export function statusColor(statuses: readonly StatusValue[], id: string): string {
  const status = statuses.find((item) => item.id === id);
  if (!status) return 'var(--muted)';
  const siblings = statusesIn(statuses, status.category);
  const index = siblings.findIndex((item) => item.id === id);
  const base = CATEGORY_COLORS[status.category];
  if (index <= 0) return base;
  const step = Math.min(28, 60 / (siblings.length - 1));
  return `color-mix(in oklab, ${base} ${Math.round(100 - index * step)}%, var(--surface))`;
}

/** Whether a status value is the last one of a required category: it can be neither removed nor moved out. */
export function isLastOfRequired(statuses: readonly StatusValue[], id: string): boolean {
  const category = categoryOf(statuses, id);
  return category !== null && REQUIRED_CATEGORIES.includes(category) && statusesIn(statuses, category).length === 1;
}

export function storiesWithStatus(stories: readonly Story[], id: string): Story[] {
  return stories.filter((story) => story.status === id);
}

/** Adds a status value at the end of a category. Null when the name is empty. */
export function addStatus(statuses: readonly StatusValue[], category: StatusCategory, label: string, id: string): StatusValue[] | null {
  const name = label.trim();
  if (!name) return null;
  return sortByCategory([...statuses, { id, label: name, category }]);
}

/**
 * Renames a status value; the name applies to every language. An empty name brings back the translated default
 * of a default status value and is refused for the others. Returns the same list when nothing changes.
 */
export function renameStatus(statuses: readonly StatusValue[], id: string, label: string): StatusValue[] | null {
  const status = statuses.find((item) => item.id === id);
  if (!status) return null;
  const name = label.trim();
  if (!name && !DEFAULT_STATUS_IDS.includes(id)) return null;
  const next = name || null;
  if (next === status.label) return statuses as StatusValue[];
  return statuses.map((item) => (item.id === id ? { ...item, label: next } : item));
}

/** One entry of a new order: the status value and the category it ends up in. */
export interface StatusPlace {
  id: string;
  category: StatusCategory;
}

/**
 * Applies a new order (with categories) to the status values. Null when it is not valid: other ids than before,
 * categories out of order, or a required category left empty.
 */
export function reorderStatuses(statuses: readonly StatusValue[], places: readonly StatusPlace[]): StatusValue[] | null {
  if (places.length !== statuses.length) return null;
  const byId = new Map(statuses.map((status) => [status.id, status]));
  if (new Set(places.map((place) => place.id)).size !== places.length || places.some((place) => !byId.has(place.id))) return null;
  for (let index = 1; index < places.length; index += 1) {
    if (categoryIndex(places[index].category) < categoryIndex(places[index - 1].category)) return null;
  }
  for (const category of REQUIRED_CATEGORIES) if (!places.some((place) => place.category === category)) return null;
  return places.map((place) => {
    const status = byId.get(place.id) as StatusValue;
    return status.category === place.category ? status : { ...status, category: place.category };
  });
}

/** Status values whose category differs between two lists. */
export function changedCategories(before: readonly StatusValue[], after: readonly StatusValue[]): StatusValue[] {
  const previous = new Map(before.map((status) => [status.id, status.category]));
  return after.filter((status) => previous.has(status.id) && previous.get(status.id) !== status.category);
}

/** Where the stories of a removed status value go by default: the status to its left, else the one to its right. */
export function defaultTarget(statuses: readonly StatusValue[], id: string): string | null {
  const index = statuses.findIndex((status) => status.id === id);
  if (index < 0) return null;
  return statuses[index - 1]?.id ?? statuses[index + 1]?.id ?? null;
}

/**
 * Removes a status value and gives its stories the target status. Null when the value is the last of a required
 * category, or when stories need a target and the target is missing or the removed value itself.
 */
export function removeStatus(
  statuses: readonly StatusValue[],
  stories: readonly Story[],
  id: string,
  targetId: string | null
): { statuses: StatusValue[]; stories: Story[] } | null {
  if (!statuses.some((status) => status.id === id) || isLastOfRequired(statuses, id)) return null;
  const affected = storiesWithStatus(stories, id).length > 0;
  if (affected && (!targetId || targetId === id || !statuses.some((status) => status.id === targetId))) return null;
  return {
    statuses: statuses.filter((status) => status.id !== id),
    stories: affected ? stories.map((story) => (story.status === id ? { ...story, status: targetId as string } : story)) : (stories as Story[])
  };
}

/** Stories whose status is unknown (for example after a failed write) get the start status, so none drops off the board. */
export function repairStatuses(stories: readonly Story[], statuses: readonly StatusValue[]): Story[] {
  const known = new Set(statuses.map((status) => status.id));
  const start = startStatus(statuses);
  if (stories.every((story) => known.has(story.status))) return stories as Story[];
  return stories.map((story) => (known.has(story.status) ? story : { ...story, status: start }));
}

/** The current order as places, to build a new order from. */
export function placesOf(statuses: readonly StatusValue[]): StatusPlace[] {
  return statuses.map((status) => ({ id: status.id, category: status.category }));
}

/**
 * Moves a status value one step up (-1) or down (1). At the edge of its category it crosses into the neighbouring
 * category instead: up from the first place goes to the end of the previous category, down from the last place to
 * the start of the next one. Null when there is no step to take. The result is not validated yet.
 */
export function stepStatus(statuses: readonly StatusValue[], id: string, direction: -1 | 1): StatusPlace[] | null {
  const places = placesOf(statuses);
  const index = places.findIndex((place) => place.id === id);
  if (index < 0) return null;
  const place = places[index];
  const neighbour = places[index + direction];
  if (neighbour && neighbour.category === place.category) {
    places[index] = neighbour;
    places[index + direction] = place;
    return places;
  }
  const category = STATUS_CATEGORIES[categoryIndex(place.category) + direction];
  if (!category) return null;
  places[index] = { ...place, category };
  return places;
}

/**
 * Moves a status value next to another one (taking over its category), or to the end of a category when `overId`
 * is null. The result is not validated yet.
 */
export function moveStatus(
  statuses: readonly StatusValue[],
  activeId: string,
  overId: string | null,
  category: StatusCategory,
  placement: 'before' | 'after'
): StatusPlace[] {
  const active = statuses.find((status) => status.id === activeId);
  if (!active || activeId === overId) return placesOf(statuses);
  const rest = placesOf(statuses).filter((place) => place.id !== activeId);
  const moved: StatusPlace = { id: activeId, category };
  let insertAt: number;
  const overIndex = overId === null ? -1 : rest.findIndex((place) => place.id === overId);
  if (overIndex >= 0) insertAt = placement === 'after' ? overIndex + 1 : overIndex;
  else {
    const lastInCategory = rest.map((place) => place.category).lastIndexOf(category);
    insertAt = lastInCategory >= 0 ? lastInCategory + 1 : rest.filter((place) => categoryIndex(place.category) < categoryIndex(category)).length;
  }
  return [...rest.slice(0, insertAt), moved, ...rest.slice(insertAt)];
}

/** Stories that change from open to done or back when the status values change from `before` to `after`. */
export function storiesChangingDone(stories: readonly Story[], before: readonly StatusValue[], after: readonly StatusValue[]): Story[] {
  const wasDone = isDoneIn(before);
  const isDone = isDoneIn(after);
  return stories.filter((story) => wasDone(story) !== isDone(story));
}
