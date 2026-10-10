import type { Story, Status } from './types';

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
 * The result keeps the global rank order consistent, so the board order is the backlog priority.
 */
export function dropStory(stories: Story[], activeId: string, overId: string): Story[] {
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
    const movingDownInSameColumn = target.status === active.status && from < to;
    insertAt = movingDownInSameColumn ? targetIndex + 1 : targetIndex;
  }

  const moved: Story = { ...active, status: targetStatus };
  return reindex([...without.slice(0, insertAt), moved, ...without.slice(insertAt)]);
}

/** Stories whose status or rank differs between two lists (what has to be saved). */
export function changedPositions(before: readonly Story[], after: readonly Story[]): Story[] {
  const previous = new Map(before.map((story) => [story.id, story]));
  return after.filter((story) => {
    const old = previous.get(story.id);
    return !old || old.status !== story.status || old.rank !== story.rank;
  });
}

export function moveInBacklog(stories: Story[], id: string, delta: -1 | 1): Story[] {
  const list = sortByRank(stories);
  const index = list.findIndex((story) => story.id === id);
  const other = index + delta;
  if (index < 0 || other < 0 || other >= list.length) return stories;
  [list[index], list[other]] = [list[other], list[index]];
  return reindex(list);
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
    rank: stories.length,
    criteria: []
  };
  return { stories: [...stories, story], story };
}
