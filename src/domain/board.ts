import { sortSprints } from './sprints';
import type { Criterion, FieldValue, Sprint, Story, Status } from './types';

/** Where a dragged item goes relative to the item it is over. Without a value the move direction decides. */
export type Placement = 'before' | 'after';

export const COLUMN_PREFIX = 'col:';

export const columnId = (status: Status): string => `${COLUMN_PREFIX}${status}`;

export function parseColumnId(id: string): Status | null {
  return id.startsWith(COLUMN_PREFIX) ? (id.slice(COLUMN_PREFIX.length) as Status) : null;
}

export function sortByRank(stories: readonly Story[]): Story[] {
  return [...stories].sort((a, b) => a.rank - b.rank);
}

function reindex(list: Story[]): Story[] {
  return list.map((story, index) => (story.rank === index ? story : { ...story, rank: index }));
}

/** Position of a sprint in time order; stories without a sprint come last. */
function sprintOrder(sprints: readonly Sprint[]): (sprintId: string | null) => number {
  const index = new Map(sortSprints(sprints).map((sprint, position) => [sprint.id, position]));
  return (sprintId) => (sprintId === null ? Number.MAX_SAFE_INTEGER : (index.get(sprintId) ?? Number.MAX_SAFE_INTEGER - 1));
}

/** Stories of one sprint (or the unplanned ones for null) by rank. */
export function sprintStories(stories: readonly Story[], sprintId: string | null): Story[] {
  return sortByRank(stories).filter((story) => story.sprintId === sprintId);
}

export function storiesInColumn(stories: readonly Story[], sprintId: string | null, status: Status): Story[] {
  return sprintStories(stories, sprintId).filter((story) => story.status === status);
}

/**
 * Moves a story on the board as the result of a drag and drop.
 * `overId` is either another story id (drop next to it) or a column id (drop at the end of that column).
 * `placement` says on which side of the target story it lands; without it, a story moving down inside its
 * column goes after the target and every other move goes before it.
 * The result keeps the global rank order consistent, so the board order is the backlog priority.
 */
export function dropStory(stories: Story[], activeId: string, overId: string, placement?: Placement): Story[] {
  if (activeId === overId) return stories;
  const list = sortByRank(stories);
  const from = list.findIndex((story) => story.id === activeId);
  if (from < 0) return stories;
  const active = list[from];
  const without = list.filter((story) => story.id !== activeId);

  let targetStatus: Status;
  let insertAt: number;

  const columnStatus = parseColumnId(overId);
  if (columnStatus) {
    targetStatus = columnStatus;
    let last = -1;
    without.forEach((story, index) => {
      if (story.sprintId === active.sprintId && story.status === columnStatus) last = index;
    });
    insertAt = last >= 0 ? last + 1 : without.length;
  } else {
    const to = list.findIndex((story) => story.id === overId);
    if (to < 0) return stories;
    const target = list[to];
    targetStatus = target.status;
    const targetIndex = without.findIndex((story) => story.id === overId);
    const after = placement ? placement === 'after' : target.status === active.status && from < to;
    insertAt = after ? targetIndex + 1 : targetIndex;
  }

  const moved: Story = { ...active, status: targetStatus };
  return reindex([...without.slice(0, insertAt), moved, ...without.slice(insertAt)]);
}

/** Stories whose status, rank, sprint or epic differs between two lists (what has to be saved). */
export function changedPositions(before: readonly Story[], after: readonly Story[]): Story[] {
  const previous = new Map(before.map((story) => [story.id, story]));
  return after.filter((story) => {
    const old = previous.get(story.id);
    return (
      !old ||
      old.status !== story.status ||
      old.rank !== story.rank ||
      old.sprintId !== story.sprintId ||
      old.epicId !== story.epicId
    );
  });
}

/* ---------- Backlog ---------- */

export const SECTION_PREFIX = 'section:';
const NOT_PLANNED = '-';

/** Drop target id of a backlog section: a sprint, or "not planned" for null. */
export const sectionId = (sprintId: string | null): string => `${SECTION_PREFIX}${sprintId ?? NOT_PLANNED}`;

/** The sprint of a section id (null for "not planned"), or undefined when the id is no section. */
export function parseSectionId(id: string): string | null | undefined {
  if (!id.startsWith(SECTION_PREFIX)) return undefined;
  const value = id.slice(SECTION_PREFIX.length);
  return value === NOT_PLANNED ? null : value;
}

/** The backlog as shown: one section per sprint in time order, then the unplanned stories, each by rank. */
export function backlogOrder(stories: readonly Story[], sprints: readonly Sprint[]): Story[] {
  const order = sprintOrder(sprints);
  return [...stories].sort((a, b) => order(a.sprintId) - order(b.sprintId) || a.rank - b.rank);
}

/**
 * Inserts a moved story into the backlog order and stores that order as ranks.
 * Without an explicit index, the story goes to the end of `group`, or of its sprint, or in front of the
 * first later sprint, so the list stays grouped by sprint.
 */
function insertMoved(
  without: Story[],
  moved: Story,
  sprints: readonly Sprint[],
  group: (story: Story) => boolean
): Story[] {
  const order = sprintOrder(sprints);
  const lastIndex = (match: (story: Story) => boolean): number => {
    let last = -1;
    without.forEach((story, index) => {
      if (match(story)) last = index;
    });
    return last;
  };
  let insertAt = lastIndex(group);
  if (insertAt < 0) insertAt = lastIndex((story) => story.sprintId === moved.sprintId);
  if (insertAt >= 0) insertAt += 1;
  else {
    const later = without.findIndex((story) => order(story.sprintId) > order(moved.sprintId));
    insertAt = later >= 0 ? later : without.length;
  }
  return reindex([...without.slice(0, insertAt), moved, ...without.slice(insertAt)]);
}

/** Places a moved story directly before or after a target story and stores the order as ranks. */
function insertNextTo(without: Story[], moved: Story, targetId: string, after: boolean): Story[] {
  const targetIndex = without.findIndex((story) => story.id === targetId);
  const insertAt = after ? targetIndex + 1 : targetIndex;
  return reindex([...without.slice(0, insertAt), moved, ...without.slice(insertAt)]);
}

/**
 * Moves a story in the backlog as the result of a drag and drop.
 * `overId` is another story id or a section id (drop at the end of that section).
 * Moving into another section changes the sprint. Ranks follow the shown order afterwards.
 */
export function dropInBacklog(
  stories: Story[],
  sprints: readonly Sprint[],
  activeId: string,
  overId: string,
  placement?: Placement
): Story[] {
  if (activeId === overId) return stories;
  const list = backlogOrder(stories, sprints);
  const from = list.findIndex((story) => story.id === activeId);
  if (from < 0) return stories;
  const active = list[from];
  const without = list.filter((story) => story.id !== activeId);

  const section = parseSectionId(overId);
  if (section !== undefined) {
    if (section !== null && !sprints.some((sprint) => sprint.id === section)) return stories;
    const moved: Story = { ...active, sprintId: section };
    return insertMoved(without, moved, sprints, (story) => story.sprintId === section);
  }

  const to = list.findIndex((story) => story.id === overId);
  if (to < 0) return stories;
  const target = list[to];
  const after = placement ? placement === 'after' : target.sprintId === active.sprintId && from < to;
  return insertNextTo(without, { ...active, sprintId: target.sprintId }, overId, after);
}

/* ---------- Story map ---------- */

export const CELL_PREFIX = 'cell:';

/** Drop target id of a story map cell: one epic in one sprint (or "not planned" for null). */
/** Marks the column of stories without an epic in a cell id. */
export const NO_EPIC = '-';

export const cellId = (epicId: string | null, sprintId: string | null): string =>
  `${CELL_PREFIX}${epicId ?? NO_EPIC}::${sprintId ?? NOT_PLANNED}`;

export function parseCellId(id: string): { epicId: string | null; sprintId: string | null } | null {
  if (!id.startsWith(CELL_PREFIX)) return null;
  const [epicId, sprint] = id.slice(CELL_PREFIX.length).split('::');
  if (!epicId || sprint === undefined) return null;
  return { epicId: epicId === NO_EPIC ? null : epicId, sprintId: sprint === NOT_PLANNED ? null : sprint };
}

/** Stories in one cell of the map, in backlog order. A null epic is the column of stories without an epic. */
export function storiesInCell(stories: readonly Story[], epicId: string | null, sprintId: string | null): Story[] {
  return sortByRank(stories).filter((story) => story.epicId === epicId && story.sprintId === sprintId);
}

/**
 * Moves a story on the story map as the result of a drag and drop.
 * `overId` is another story id (drop next to it) or a cell id (drop at the end of that cell).
 * The story takes the epic and sprint of the target. Ranks follow the backlog order afterwards.
 */
export function dropOnMap(
  stories: Story[],
  sprints: readonly Sprint[],
  activeId: string,
  overId: string,
  placement?: Placement
): Story[] {
  if (activeId === overId) return stories;
  const list = backlogOrder(stories, sprints);
  const from = list.findIndex((story) => story.id === activeId);
  if (from < 0) return stories;
  const active = list[from];
  const without = list.filter((story) => story.id !== activeId);

  const cell = parseCellId(overId);
  if (cell) {
    if (cell.sprintId !== null && !sprints.some((sprint) => sprint.id === cell.sprintId)) return stories;
    const moved: Story = { ...active, epicId: cell.epicId, sprintId: cell.sprintId };
    return insertMoved(
      without,
      moved,
      sprints,
      (story) => story.epicId === cell.epicId && story.sprintId === cell.sprintId
    );
  }

  const to = list.findIndex((story) => story.id === overId);
  if (to < 0) return stories;
  const target = list[to];
  const sameCell = target.epicId === active.epicId && target.sprintId === active.sprintId;
  const after = placement ? placement === 'after' : sameCell && from < to;
  return insertNextTo(without, { ...active, epicId: target.epicId, sprintId: target.sprintId }, overId, after);
}

export function toggleCriterion(stories: Story[], storyId: string, criterionId: string): Story[] {
  return stories.map((story) =>
    story.id !== storyId
      ? story
      : {
          ...story,
          criteria: story.criteria.map((criterion) =>
            criterion.id === criterionId ? { ...criterion, done: !criterion.done } : criterion
          )
        }
  );
}

export function addCriterion(stories: Story[], storyId: string, id: string, text: string): Story[] {
  return stories.map((story) =>
    story.id === storyId ? { ...story, criteria: [...story.criteria, { id, text, done: false }] } : story
  );
}

function mapCriteria(stories: Story[], storyId: string, change: (criteria: Criterion[]) => Criterion[]): Story[] {
  return stories.map((story) => (story.id === storyId ? { ...story, criteria: change(story.criteria) } : story));
}

export function updateCriterionText(stories: Story[], storyId: string, criterionId: string, text: string): Story[] {
  return mapCriteria(stories, storyId, (criteria) =>
    criteria.map((criterion) => (criterion.id === criterionId ? { ...criterion, text } : criterion))
  );
}

export function deleteCriterion(stories: Story[], storyId: string, criterionId: string): Story[] {
  return mapCriteria(stories, storyId, (criteria) => criteria.filter((criterion) => criterion.id !== criterionId));
}

/** Moves a criterion to the position of another one (drag and drop inside one story). */
export function moveCriterion(stories: Story[], storyId: string, activeId: string, overId: string): Story[] {
  return mapCriteria(stories, storyId, (criteria) => {
    const from = criteria.findIndex((criterion) => criterion.id === activeId);
    const to = criteria.findIndex((criterion) => criterion.id === overId);
    if (from < 0 || to < 0 || from === to) return criteria;
    const list = [...criteria];
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    return list;
  });
}

export interface Progress {
  done: number;
  total: number;
  percent: number;
}

export function criteriaProgress(story: Pick<Story, 'criteria'>): Progress {
  const total = story.criteria.length;
  const done = story.criteria.filter((criterion) => criterion.done).length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function totalPoints(stories: readonly Story[]): number {
  return stories.reduce((sum, story) => sum + story.points, 0);
}

export function nextCode(stories: readonly Story[]): string {
  const highest = stories.reduce((max, story) => {
    const match = /^S-(\d+)$/.exec(story.code);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `S-${highest + 1}`;
}

export interface NewStoryInput {
  title: string;
  description: string;
  epicId: string | null;
  points: number;
  /** The sprint to plan the story in, or null for "not planned". */
  sprintId: string | null;
  /** Values of custom fields, from the create dialog. */
  values?: Record<string, FieldValue>;
}

export type StoryPatch = Partial<Pick<Story, 'title' | 'description' | 'epicId' | 'points' | 'status' | 'sprintId'>>;

/** Changes the editable fields of a story. Text is trimmed and an empty title is ignored. */
export function updateStory(stories: Story[], id: string, patch: StoryPatch): Story[] {
  const clean: StoryPatch = { ...patch };
  if (clean.title !== undefined) {
    clean.title = clean.title.trim();
    if (!clean.title) delete clean.title;
  }
  if (clean.description !== undefined) clean.description = clean.description.trim();
  return stories.map((story) => (story.id === id ? { ...story, ...clean } : story));
}

export function deleteStory(stories: Story[], id: string): Story[] {
  return stories.filter((story) => story.id !== id);
}

/** Adds a story in "To do", at the end of its sprint (or of the unplanned stories) in the backlog. */
export function createStory(stories: Story[], input: NewStoryInput, id: string): { stories: Story[]; story: Story } {
  const story: Story = {
    id,
    code: nextCode(stories),
    title: input.title.trim(),
    description: input.description.trim(),
    epicId: input.epicId,
    points: input.points,
    status: 'todo',
    sprintId: input.sprintId,
    rank: stories.reduce((max, item) => Math.max(max, item.rank), -1) + 1,
    criteria: [],
    values: input.values ?? {}
  };
  return { stories: [...stories, story], story };
}
