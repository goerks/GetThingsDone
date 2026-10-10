import { describe, expect, it } from 'vitest';
import { seedSnapshot } from '../data/seed';
import {
  addCriterion,
  changedPositions,
  columnId,
  createStory,
  criteriaProgress,
  dropStory,
  moveInBacklog,
  nextCode,
  parseColumnId,
  setInSprint,
  sortByRank,
  sprintPoints,
  sprintStories,
  storiesInColumn,
  toggleCriterion
} from './board';
import type { Story } from './types';

function story(id: string, status: Story['status'], rank: number, inSprint = true): Story {
  return {
    id,
    code: `S-${rank + 1}`,
    title: id,
    description: '',
    epicId: 'e',
    points: 1,
    status,
    inSprint,
    rank,
    criteria: []
  };
}

const ids = (stories: Story[]): string[] => sortByRank(stories).map((s) => s.id);
const inColumn = (stories: Story[], status: Story['status']): string[] => storiesInColumn(stories, status).map((s) => s.id);

describe('column ids', () => {
  it('round-trips a status', () => {
    expect(parseColumnId(columnId('review'))).toBe('review');
  });

  it('returns null for a story id', () => {
    expect(parseColumnId('story-1')).toBeNull();
  });
});

describe('dropStory', () => {
  const base = [story('a', 'todo', 0), story('b', 'todo', 1), story('c', 'in_progress', 2), story('d', 'done', 3)];

  it('moves a card to another column before the card it is dropped on', () => {
    const next = dropStory(base, 'a', 'c');
    expect(inColumn(next, 'todo')).toEqual(['b']);
    expect(inColumn(next, 'in_progress')).toEqual(['a', 'c']);
  });

  it('appends to the end of a column when dropped on the column itself', () => {
    const next = dropStory(base, 'a', columnId('done'));
    expect(inColumn(next, 'done')).toEqual(['d', 'a']);
    expect(inColumn(next, 'todo')).toEqual(['b']);
  });

  it('moves into an empty column', () => {
    const next = dropStory(base, 'a', columnId('review'));
    expect(inColumn(next, 'review')).toEqual(['a']);
  });

  it('puts a card after the target when moving down inside a column', () => {
    const next = dropStory(base, 'a', 'b');
    expect(inColumn(next, 'todo')).toEqual(['b', 'a']);
  });

  it('puts a card before the target when moving up inside a column', () => {
    const next = dropStory(base, 'b', 'a');
    expect(inColumn(next, 'todo')).toEqual(['b', 'a']);
  });

  it('keeps ranks as a gapless sequence', () => {
    const next = dropStory(base, 'd', 'a');
    expect(sortByRank(next).map((s) => s.rank)).toEqual([0, 1, 2, 3]);
    expect(ids(next)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('does nothing when dropped on itself', () => {
    expect(dropStory(base, 'a', 'a')).toBe(base);
  });

  it('does nothing for unknown ids', () => {
    expect(dropStory(base, 'x', 'a')).toBe(base);
    expect(dropStory(base, 'a', 'x')).toBe(base);
  });

  it('ignores stories outside the sprint when appending to a column', () => {
    const list = [story('a', 'todo', 0), story('hidden', 'done', 1, false), story('d', 'done', 2)];
    const next = dropStory(list, 'a', columnId('done'));
    expect(inColumn(next, 'done')).toEqual(['d', 'a']);
  });

  it('does not change the input', () => {
    const copy = JSON.parse(JSON.stringify(base)) as Story[];
    dropStory(base, 'a', 'c');
    expect(base).toEqual(copy);
  });
});

describe('changedPositions', () => {
  it('lists only stories whose status or rank changed', () => {
    const before = [story('a', 'todo', 0), story('b', 'todo', 1), story('c', 'todo', 2)];
    const after = dropStory(before, 'c', 'b');
    expect(changedPositions(before, after).map((s) => s.id).sort()).toEqual(['b', 'c']);
  });
});

describe('moveInBacklog', () => {
  const base = [story('a', 'todo', 0), story('b', 'todo', 1), story('c', 'todo', 2)];

  it('moves a story up', () => {
    expect(ids(moveInBacklog(base, 'b', -1))).toEqual(['b', 'a', 'c']);
  });

  it('moves a story down', () => {
    expect(ids(moveInBacklog(base, 'b', 1))).toEqual(['a', 'c', 'b']);
  });

  it('does not move the first story up or the last story down', () => {
    expect(moveInBacklog(base, 'a', -1)).toBe(base);
    expect(moveInBacklog(base, 'c', 1)).toBe(base);
  });
});

describe('sprint', () => {
  const base = [story('a', 'todo', 0), story('b', 'todo', 1, false)];

  it('lists only stories in the sprint', () => {
    expect(sprintStories(base).map((s) => s.id)).toEqual(['a']);
  });

  it('toggles membership', () => {
    expect(sprintStories(setInSprint(base, 'b', true)).map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('adds up the points of the sprint only', () => {
    expect(sprintPoints(base)).toBe(1);
  });
});

describe('acceptance criteria', () => {
  const { stories } = seedSnapshot();

  it('toggles a single criterion', () => {
    const next = toggleCriterion(stories, 'story-1', 'c-1-3');
    expect(next.find((s) => s.id === 'story-1')?.criteria.find((c) => c.id === 'c-1-3')?.done).toBe(true);
    expect(next.find((s) => s.id === 'story-2')).toBe(stories.find((s) => s.id === 'story-2'));
  });

  it('adds a criterion at the end', () => {
    const next = addCriterion(stories, 'story-3', 'new', 'Works offline');
    const criteria = next.find((s) => s.id === 'story-3')?.criteria ?? [];
    expect(criteria[criteria.length - 1]).toEqual({ id: 'new', text: 'Works offline', done: false });
  });

  it('computes progress', () => {
    expect(criteriaProgress(stories.find((s) => s.id === 'story-1')!)).toEqual({ done: 2, total: 4, percent: 50 });
  });

  it('reports zero progress without criteria', () => {
    expect(criteriaProgress({ criteria: [] })).toEqual({ done: 0, total: 0, percent: 0 });
  });
});

describe('createStory', () => {
  const { stories } = seedSnapshot();

  it('uses the next free key', () => {
    expect(nextCode(stories)).toBe('S-8');
  });

  it('appends a trimmed story to "To do" and the sprint', () => {
    const result = createStory(
      stories,
      { title: '  New idea  ', description: ' text ', epicId: 'epic-boards', points: 3 },
      'id-1'
    );
    expect(result.story).toMatchObject({
      id: 'id-1',
      code: 'S-8',
      title: 'New idea',
      description: 'text',
      status: 'todo',
      inSprint: true,
      rank: stories.length
    });
    expect(result.stories).toHaveLength(stories.length + 1);
  });
});
