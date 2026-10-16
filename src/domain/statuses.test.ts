import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STATUSES,
  addStatus,
  changedCategories,
  defaultTarget,
  dropOf,
  isDoneIn,
  isLastOfRequired,
  moveStatus,
  normalizeStatuses,
  removeStatus,
  renameStatus,
  reorderStatuses,
  repairStatuses,
  startStatus,
  statusColor,
  stepStatus,
  storiesChangingDone
} from './statuses';
import type { StatusValue, Story } from './types';

const defaults = (): StatusValue[] => DEFAULT_STATUSES.map((status) => ({ ...status }));

function story(id: string, status: string): Story {
  return { id, code: `S-${id}`, title: id, description: '', epicId: null, points: 1, status, sprintId: null, releaseId: null, rank: 0, criteria: [], values: {}, checks: {}, special: null, reference: false, doneItems: null };
}

const ids = (statuses: readonly { id: string }[]): string[] => statuses.map((status) => status.id);

describe('normalizeStatuses', () => {
  it('gives the four defaults when nothing is stored', () => {
    expect(normalizeStatuses(undefined)).toEqual(DEFAULT_STATUSES);
    expect(normalizeStatuses([])).toEqual(DEFAULT_STATUSES);
  });

  it('orders by category, drops unknown categories and duplicates and fills an empty required category', () => {
    const result = normalizeStatuses([
      { id: 'test', label: 'Test', category: 'in_progress' },
      { id: 'todo', label: null, category: 'not_started' },
      { id: 'todo', label: 'Again', category: 'done' },
      { id: 'odd', label: 'Odd', category: 'later' as never }
    ]);
    expect(result).toEqual([
      { id: 'todo', label: null, category: 'not_started' },
      { id: 'test', label: 'Test', category: 'in_progress' },
      { id: 'done', label: null, category: 'done' }
    ]);
  });
});

describe('done and start', () => {
  it('counts a story as done when its status is in the done category', () => {
    const statuses = [...defaults(), { id: 'shipped', label: 'Shipped', category: 'done' as const }];
    const isDone = isDoneIn(statuses);
    expect(isDone(story('a', 'done'))).toBe(true);
    expect(isDone(story('a', 'shipped'))).toBe(true);
    expect(isDone(story('a', 'review'))).toBe(false);
    expect(isDone(story('a', 'gone'))).toBe(false);
  });

  it('starts new stories in the first status of "not started"', () => {
    const statuses = normalizeStatuses([{ id: 'idea', label: 'Idea', category: 'not_started' }, ...defaults()]);
    expect(startStatus(statuses)).toBe('idea');
  });

  it('gives a story with an unknown status the start status', () => {
    const stories = [story('a', 'review'), story('b', 'gone')];
    expect(repairStatuses(stories, defaults()).map((item) => item.status)).toEqual(['review', 'todo']);
    expect(repairStatuses([stories[0]], defaults())).toEqual([stories[0]]);
  });
});

describe('colours', () => {
  it('gives the first status of a category the base colour and the following ones lighter shades', () => {
    const statuses = defaults();
    expect(statusColor(statuses, 'todo')).toBe('var(--epic-slate)');
    expect(statusColor(statuses, 'in_progress')).toBe('var(--epic-blue)');
    expect(statusColor(statuses, 'review')).toBe('color-mix(in oklab, var(--epic-blue) 72%, var(--surface))');
    expect(statusColor(statuses, 'done')).toBe('var(--epic-green)');
  });
});

describe('add and rename', () => {
  it('adds a status at the end of its category', () => {
    const result = addStatus(defaults(), 'in_progress', '  Test ', 'test');
    expect(ids(result ?? [])).toEqual(['todo', 'in_progress', 'review', 'test', 'done']);
    expect(result?.[3]).toEqual({ id: 'test', label: 'Test', category: 'in_progress' });
    expect(addStatus(defaults(), 'done', '  ', 'x')).toBeNull();
  });

  it('renames a status for every language and brings back the default name with an empty name', () => {
    const renamed = renameStatus(defaults(), 'todo', 'Backlog');
    expect(renamed?.[0].label).toBe('Backlog');
    expect(renameStatus(renamed ?? [], 'todo', ' ')?.[0].label).toBeNull();
    const own = addStatus(defaults(), 'in_progress', 'Test', 'test') ?? [];
    expect(renameStatus(own, 'test', '')).toBeNull();
  });
});

describe('order and categories', () => {
  it('keeps the categories in order and the required categories filled', () => {
    const statuses = defaults();
    expect(reorderStatuses(statuses, [
      { id: 'todo', category: 'not_started' },
      { id: 'review', category: 'in_progress' },
      { id: 'in_progress', category: 'in_progress' },
      { id: 'done', category: 'done' }
    ])?.map((status) => status.id)).toEqual(['todo', 'review', 'in_progress', 'done']);
    // "Done" before "In progress" is not possible.
    expect(reorderStatuses(statuses, [
      { id: 'todo', category: 'not_started' },
      { id: 'done', category: 'done' },
      { id: 'in_progress', category: 'in_progress' },
      { id: 'review', category: 'in_progress' }
    ])).toBeNull();
    // The last status of "not started" cannot leave it.
    expect(reorderStatuses(statuses, [
      { id: 'todo', category: 'in_progress' },
      { id: 'in_progress', category: 'in_progress' },
      { id: 'review', category: 'in_progress' },
      { id: 'done', category: 'done' }
    ])).toBeNull();
  });

  it('steps a status up and down and across the edge of its category', () => {
    const statuses = defaults();
    expect(stepStatus(statuses, 'review', -1)).toEqual([
      { id: 'todo', category: 'not_started' },
      { id: 'review', category: 'in_progress' },
      { id: 'in_progress', category: 'in_progress' },
      { id: 'done', category: 'done' }
    ]);
    // Down from the last place of "In progress" goes to the start of "Done".
    const down = stepStatus(statuses, 'review', 1);
    expect(reorderStatuses(statuses, down ?? [])?.map((status) => `${status.id}:${status.category}`)).toEqual([
      'todo:not_started',
      'in_progress:in_progress',
      'review:done',
      'done:done'
    ]);
    // Up from the first place of "In progress" goes to the end of "Not started".
    expect(stepStatus(statuses, 'in_progress', -1)?.[1]).toEqual({ id: 'in_progress', category: 'not_started' });
    expect(stepStatus(statuses, 'todo', -1)).toBeNull();
    expect(stepStatus(statuses, 'done', 1)).toBeNull();
  });

  it('moves a status next to another one or to the end of a category', () => {
    const statuses = defaults();
    expect(moveStatus(statuses, 'todo', 'review', 'in_progress', 'after').map((place) => `${place.id}:${place.category}`)).toEqual([
      'in_progress:in_progress',
      'review:in_progress',
      'todo:in_progress',
      'done:done'
    ]);
    expect(moveStatus(statuses, 'review', null, 'done', 'after').map((place) => place.id)).toEqual(['todo', 'in_progress', 'done', 'review']);
    expect(moveStatus(statuses, 'review', null, 'not_started', 'after').map((place) => place.id)).toEqual(['todo', 'review', 'in_progress', 'done']);
  });

  it('names the status values that changed category and the stories that change between open and done', () => {
    const before = defaults();
    const after = reorderStatuses(before, stepStatus(before, 'review', 1) ?? []) ?? [];
    expect(changedCategories(before, after).map((status) => status.id)).toEqual(['review']);
    const stories = [story('a', 'review'), story('b', 'in_progress'), story('c', 'done')];
    expect(storiesChangingDone(stories, before, after).map((item) => item.id)).toEqual(['a']);
  });
});

describe('remove', () => {
  it('moves the stories of a removed status to the target', () => {
    const stories = [story('a', 'review'), story('b', 'todo')];
    const result = removeStatus(defaults(), stories, 'review', 'in_progress');
    expect(ids(result?.statuses ?? [])).toEqual(['todo', 'in_progress', 'done']);
    expect(result?.stories.map((item) => item.status)).toEqual(['in_progress', 'todo']);
  });

  it('removes an unused status without a target and refuses a missing target for a used one', () => {
    expect(removeStatus(defaults(), [], 'review', null)?.statuses).toHaveLength(3);
    expect(removeStatus(defaults(), [story('a', 'review')], 'review', null)).toBeNull();
    expect(removeStatus(defaults(), [story('a', 'review')], 'review', 'review')).toBeNull();
  });

  it('never removes the last status of "not started" or "done"', () => {
    expect(isLastOfRequired(defaults(), 'todo')).toBe(true);
    expect(isLastOfRequired(defaults(), 'review')).toBe(false);
    expect(removeStatus(defaults(), [], 'done', null)).toBeNull();
  });

  it('suggests the status to the left as the target', () => {
    expect(defaultTarget(defaults(), 'review')).toBe('in_progress');
    expect(defaultTarget(defaults(), 'todo')).toBe('in_progress');
  });
});

describe('moving a status into another category', () => {
  const statuses = normalizeStatuses([
    ...defaults(),
    { id: 'test', label: 'Test', category: 'in_progress' }
  ]);
  const layout = (places: readonly { id: string; category: string }[]): string[] => places.map((place) => `${place.id}:${place.category}`);

  it('puts the status in front of or behind the status it is dropped on, and changes only that status', () => {
    expect(layout(moveStatus(statuses, 'test', 'done', 'done', 'before'))).toEqual([
      'todo:not_started',
      'in_progress:in_progress',
      'review:in_progress',
      'test:done',
      'done:done'
    ]);
    expect(layout(moveStatus(statuses, 'test', 'done', 'done', 'after'))).toEqual([
      'todo:not_started',
      'in_progress:in_progress',
      'review:in_progress',
      'done:done',
      'test:done'
    ]);
    // Dropped in front of the first status of the next category up: it goes in front of it, in that category.
    expect(layout(moveStatus(statuses, 'test', 'todo', 'not_started', 'before')).slice(0, 2)).toEqual(['test:not_started', 'todo:not_started']);
  });

  it('lets exactly the dragged status change its category', () => {
    const places = moveStatus(statuses, 'review', 'done', 'done', 'before');
    const after = reorderStatuses(statuses, places) ?? [];
    expect(changedCategories(statuses, after).map((status) => status.id)).toEqual(['review']);
  });

  it('puts a status at the end of an empty category, in the right place between the categories', () => {
    const withoutProgress = statuses.filter((status) => status.category !== 'in_progress');
    const withIdea = [...withoutProgress, { id: 'idea', label: 'Idea', category: 'not_started' as const }];
    const places = moveStatus(normalizeStatuses(withIdea), 'idea', null, 'in_progress', 'after');
    expect(layout(places)).toEqual(['todo:not_started', 'idea:in_progress', 'done:done']);
    expect(reorderStatuses(normalizeStatuses(withIdea), places)?.map((status) => status.id)).toEqual(['todo', 'idea', 'done']);
  });

  it('tells where a dropped status lands: in front of the next status of its category, or at the end', () => {
    expect(dropOf(moveStatus(statuses, 'test', 'done', 'done', 'before'), 'test')).toEqual({ category: 'done', beforeId: 'done' });
    expect(dropOf(moveStatus(statuses, 'test', 'done', 'done', 'after'), 'test')).toEqual({ category: 'done', beforeId: null });
    expect(dropOf(moveStatus(statuses, 'test', 'todo', 'not_started', 'before'), 'test')).toEqual({ category: 'not_started', beforeId: 'todo' });
    expect(dropOf([], 'x')).toBeNull();
  });
});
