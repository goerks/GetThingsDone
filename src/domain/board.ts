import type { Criterion, Story, Status } from './types';

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

export function sprintStories(stories: readonly Story[]): Story[] {
  return sortByRank(stories).filter((story) => story.inSprint);
}

export function storiesInColumn(stories: readonly Story[], status: Status): Story[] {
  return sprintStories(stories).filter((story) => story.status === status);
}

/**
 * Moves a story as the result of a drag and drop.
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
      if (story.inSprint && story.status === columnStatus) last = index;
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

/** Stories whose status, rank or sprint membership differs between two lists (what has to be saved). */
export function changedPositions(before: readonly Story[], after: readonly Story[]): Story[] {
  const previous = new Map(before.map((story) => [story.id, story]));
  return after.filter((story) => {
    const old = previous.get(story.id);
    return !old || old.status !== story.status || old.rank !== story.rank || old.inSprint !== story.inSprint;
  });
}

/* ---------- Backlog ---------- */

export type BacklogSection = 'sprint' | 'backlog';

export const SECTION_PREFIX = 'section:';

export const sectionId = (section: BacklogSection): string => `${SECTION_PREFIX}${section}`;

export function parseSectionId(id: string): BacklogSection | null {
  if (!id.startsWith(SECTION_PREFIX)) return null;
  const section = id.slice(SECTION_PREFIX.length);
  return section === 'sprint' || section === 'backlog' ? section : null;
}

/** The backlog as shown: the sprint above the sprint line, everything else below, each part by rank. */
export function backlogOrder(stories: readonly Story[]): Story[] {
  const sorted = sortByRank(stories);
  return [...sorted.filter((story) => story.inSprint), ...sorted.filter((story) => !story.inSprint)];
}

/**
 * Moves a story in the backlog as the result of a drag and drop.
 * `overId` is another story id or a section id (drop at the end of that section).
 * Crossing the sprint line changes the sprint membership. Ranks follow the shown order afterwards.
 */
export function dropInBacklog(stories: Story[], activeId: string, overId: string, placement?: Placement): Story[] {
  if (activeId === overId) return stories;
  const list = backlogOrder(stories);
  const from = list.findIndex((story) => story.id === activeId);
  if (from < 0) return stories;
  const active = list[from];
  const without = list.filter((story) => story.id !== activeId);

  let inSprint: boolean;
  let insertAt: number;

  const section = parseSectionId(overId);
  if (section) {
    inSprint = section === 'sprint';
    insertAt = inSprint ? without.filter((story) => story.inSprint).length : without.length;
  } else {
    const to = list.findIndex((story) => story.id === overId);
    if (to < 0) return stories;
    const target = list[to];
    inSprint = target.inSprint;
    const targetIndex = without.findIndex((story) => story.id === overId);
    const after = placement ? placement === 'after' : target.inSprint === active.inSprint && from < to;
    insertAt = after ? targetIndex + 1 : targetIndex;
  }

  const moved: Story = { ...active, inSprint };
  return reindex([...without.slice(0, insertAt), moved, ...without.slice(insertAt)]);
}

export function setInSprint(stories: Story[], id: string, value: boolean): Story[] {
  return stories.map((story) => (story.id === id ? { ...story, inSprint: value } : story));
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

export function sprintPoints(stories: readonly Story[]): number {
  return sprintStories(stories).reduce((sum, story) => sum + story.points, 0);
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
  epicId: string;
  points: number;
}

export type StoryPatch = Partial<Pick<Story, 'title' | 'description' | 'epicId' | 'points' | 'status' | 'inSprint'>>;

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

/** Adds a story at the end of the backlog, in "To do", and in the sprint. */
export function createStory(stories: Story[], input: NewStoryInput, id: string): { stories: Story[]; story: Story } {
  const story: Story = {
    id,
    code: nextCode(stories),
    title: input.title.trim(),
    description: input.description.trim(),
    epicId: input.epicId,
    points: input.points,
    status: 'todo',
    inSprint: true,
    rank: stories.reduce((max, item) => Math.max(max, item.rank), -1) + 1,
    criteria: []
  };
  return { stories: [...stories, story], story };
}
