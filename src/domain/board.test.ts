import { describe, expect, it } from 'vitest';
import { seedSnapshot } from '../data/seed';
import {
  addCriterion,
  backlogOrder,
  changedPositions,
  columnId,
  createStory,
  criteriaProgress,
  deleteCriterion,
  deleteStory,
  dropInBacklog,
  dropStory,
  moveCriterion,
  nextCode,
  parseColumnId,
  parseSectionId,
  sectionId,
  setInSprint,
  sortByRank,
  sprintPoints,
  sprintStories,
  storiesInColumn,
  toggleCriterion,
  updateCriterionText,
  updateStory
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

  it('places the card after the target when the pointer is in its lower half', () => {
    const next = dropStory(base, 'a', 'c', 'after');
    expect(inColumn(next, 'in_progress')).toEqual(['c', 'a']);
  });

  it('places the card before the target when the pointer is in its upper half, even moving down', () => {
    const list = [story('x', 'todo', 0), story('y', 'todo', 1), story('z', 'todo', 2)];
    expect(inColumn(dropStory(list, 'x', 'z', 'before'), 'todo')).toEqual(['y', 'x', 'z']);
  });
});

describe('changedPositions', () => {
  it('lists only stories whose status or rank changed', () => {
    const before = [story('a', 'todo', 0), story('b', 'todo', 1), story('c', 'todo', 2)];
    const after = dropStory(before, 'c', 'b');
    expect(changedPositions(before, after).map((s) => s.id).sort()).toEqual(['b', 'c']);
  });

  it('lists stories whose sprint membership changed', () => {
    const before = [story('a', 'todo', 0), story('b', 'todo', 1, false)];
    expect(changedPositions(before, setInSprint(before, 'b', true)).map((s) => s.id)).toEqual(['b']);
  });
});

describe('backlog', () => {
  // Sprint: a, b, c. Not planned: d, e. Rank 2 of d is deliberately above c to test the shown order.
  const base = [
    story('a', 'todo', 0),
    story('b', 'todo', 1),
    story('d', 'todo', 2, false),
    story('c', 'todo', 3),
    story('e', 'todo', 4, false)
  ];
  const shown = (stories: Story[]): string[] => backlogOrder(stories).map((s) => s.id);
  const sprint = (stories: Story[]): string[] => backlogOrder(stories).filter((s) => s.inSprint).map((s) => s.id);

  it('round-trips section ids', () => {
    expect(parseSectionId(sectionId('sprint'))).toBe('sprint');
    expect(parseSectionId(sectionId('backlog'))).toBe('backlog');
    expect(parseSectionId('story-1')).toBeNull();
    expect(parseSectionId('section:other')).toBeNull();
  });

  it('shows the sprint above the sprint line, then the rest, each by rank', () => {
    expect(shown(base)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('moves a story up inside the sprint', () => {
    expect(shown(dropInBacklog(base, 'c', 'a'))).toEqual(['c', 'a', 'b', 'd', 'e']);
  });

  it('moves a story down inside the sprint after the target', () => {
    expect(shown(dropInBacklog(base, 'a', 'b'))).toEqual(['b', 'a', 'c', 'd', 'e']);
  });

  it('follows an explicit placement', () => {
    expect(shown(dropInBacklog(base, 'a', 'c', 'before'))).toEqual(['b', 'a', 'c', 'd', 'e']);
    expect(shown(dropInBacklog(base, 'c', 'a', 'after'))).toEqual(['a', 'c', 'b', 'd', 'e']);
  });

  it('plans a story into the sprint when it crosses the sprint line', () => {
    const next = dropInBacklog(base, 'e', 'b');
    expect(sprint(next)).toEqual(['a', 'e', 'b', 'c']);
    expect(next.find((s) => s.id === 'e')?.inSprint).toBe(true);
  });

  it('takes a story out of the sprint when it is dropped below the sprint line', () => {
    const next = dropInBacklog(base, 'a', 'e');
    expect(shown(next)).toEqual(['b', 'c', 'd', 'a', 'e']);
    expect(next.find((s) => s.id === 'a')?.inSprint).toBe(false);
  });

  it('appends to the end of a section when dropped on the section', () => {
    expect(shown(dropInBacklog(base, 'd', sectionId('sprint')))).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(sprint(dropInBacklog(base, 'd', sectionId('sprint')))).toEqual(['a', 'b', 'c', 'd']);
    expect(shown(dropInBacklog(base, 'a', sectionId('backlog')))).toEqual(['b', 'c', 'd', 'e', 'a']);
  });

  it('stores the shown order as gapless ranks, so the board follows', () => {
    const next = dropInBacklog(base, 'c', 'a');
    expect(sortByRank(next).map((s) => [s.id, s.rank])).toEqual([
      ['c', 0],
      ['a', 1],
      ['b', 2],
      ['d', 3],
      ['e', 4]
    ]);
    expect(storiesInColumn(next, 'todo').map((s) => s.id)).toEqual(['c', 'a', 'b']);
  });

  it('does nothing when dropped on itself or on an unknown id', () => {
    expect(dropInBacklog(base, 'a', 'a')).toBe(base);
    expect(dropInBacklog(base, 'a', 'nope')).toBe(base);
    expect(dropInBacklog(base, 'nope', 'a')).toBe(base);
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

  it('changes the text of a criterion', () => {
    const next = updateCriterionText(stories, 'story-1', 'c-1-1', 'A story needs a short title');
    expect(next.find((s) => s.id === 'story-1')?.criteria[0].text).toBe('A story needs a short title');
  });

  it('deletes a criterion', () => {
    const next = deleteCriterion(stories, 'story-1', 'c-1-2');
    expect(next.find((s) => s.id === 'story-1')?.criteria.map((c) => c.id)).toEqual(['c-1-1', 'c-1-3', 'c-1-4']);
  });

  it('moves a criterion to the position of another', () => {
    const order = (list: Story[]): string[] => list.find((s) => s.id === 'story-1')?.criteria.map((c) => c.id) ?? [];
    expect(order(moveCriterion(stories, 'story-1', 'c-1-4', 'c-1-1'))).toEqual(['c-1-4', 'c-1-1', 'c-1-2', 'c-1-3']);
    expect(order(moveCriterion(stories, 'story-1', 'c-1-1', 'c-1-3'))).toEqual(['c-1-2', 'c-1-3', 'c-1-1', 'c-1-4']);
    expect(order(moveCriterion(stories, 'story-1', 'c-1-1', 'unknown'))).toEqual(['c-1-1', 'c-1-2', 'c-1-3', 'c-1-4']);
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

  it('puts the story behind the last rank even after a delete left a gap', () => {
    const withGap = deleteStory(stories, 'story-3');
    const result = createStory(withGap, { title: 'Next', description: '', epicId: 'epic-boards', points: 1 }, 'id-2');
    expect(result.story.rank).toBe(7);
    expect(new Set(result.stories.map((s) => s.rank)).size).toBe(result.stories.length);
  });
});

describe('editing stories', () => {
  const { stories } = seedSnapshot();
  const find = (list: Story[], id: string): Story | undefined => list.find((s) => s.id === id);

  it('changes the given fields and trims text', () => {
    const next = updateStory(stories, 'story-3', { title: '  Sort  ', description: ' text ', points: 8, status: 'review' });
    expect(find(next, 'story-3')).toMatchObject({ title: 'Sort', description: 'text', points: 8, status: 'review' });
    expect(find(next, 'story-1')).toBe(find(stories, 'story-1'));
  });

  it('keeps the old title when the new one is empty', () => {
    const next = updateStory(stories, 'story-3', { title: '   ', points: 1 });
    expect(find(next, 'story-3')).toMatchObject({ title: 'Reorder the backlog by priority', points: 1 });
  });

  it('moves a story to another epic and out of the sprint', () => {
    const next = updateStory(stories, 'story-1', { epicId: 'epic-storage', inSprint: false });
    expect(find(next, 'story-1')).toMatchObject({ epicId: 'epic-storage', inSprint: false });
  });

  it('deletes a story', () => {
    expect(deleteStory(stories, 'story-1').map((s) => s.id)).not.toContain('story-1');
  });
});
