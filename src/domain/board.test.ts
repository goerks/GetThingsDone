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
  sortByRank,
  sprintStories,
  storiesInColumn,
  totalPoints,
  cellId,
  dropOnMap,
  parseCellId,
  storiesInCell,
  toggleCriterion,
  updateCriterionText,
  updateStory
} from './board';
import type { Sprint, Story } from './types';

const TODAY = '2026-10-11';
const S1 = 'sprint-1';
const S2 = 'sprint-2';
const sprints: Sprint[] = [
  { id: S2, name: 'Sprint 2', startDate: '2026-10-19', endDate: '2026-11-01' },
  { id: S1, name: 'Sprint 1', startDate: '2026-10-05', endDate: '2026-10-18' }
];

function story(id: string, status: Story['status'], rank: number, sprintId: string | null = S1, epicId = 'e'): Story {
  return {
    id,
    code: `S-${rank + 1}`,
    title: id,
    description: '',
    epicId,
    points: 1,
    status,
    sprintId,
    releaseId: null,
    rank,
    criteria: [],
    values: {}
  };
}

const ids = (stories: Story[]): string[] => sortByRank(stories).map((s) => s.id);
const inColumn = (stories: Story[], status: Story['status']): string[] =>
  storiesInColumn(stories, S1, status).map((s) => s.id);

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

  it('ignores stories of other sprints when appending to a column', () => {
    const list = [story('a', 'todo', 0), story('hidden', 'done', 1, S2), story('d', 'done', 2)];
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

  it('lists stories whose sprint or epic changed', () => {
    const before = [story('a', 'todo', 0), story('b', 'todo', 1, null), story('c', 'todo', 2)];
    const after = before.map((s) => (s.id === 'b' ? { ...s, sprintId: S1 } : s.id === 'c' ? { ...s, epicId: 'x' } : s));
    expect(changedPositions(before, after).map((s) => s.id)).toEqual(['b', 'c']);
  });
});

describe('backlog', () => {
  // Sprint 1: a, b, c. Sprint 2: f. Not planned: d, e. Ranks are mixed on purpose to test the shown order.
  const base = [
    story('a', 'todo', 0),
    story('f', 'todo', 1, S2),
    story('b', 'todo', 2),
    story('d', 'todo', 3, null),
    story('c', 'todo', 4),
    story('e', 'todo', 5, null)
  ];
  const shown = (stories: Story[]): string[] => backlogOrder(stories, sprints).map((s) => s.id);
  const inSprint = (stories: Story[], sprintId: string | null): string[] =>
    backlogOrder(stories, sprints)
      .filter((s) => s.sprintId === sprintId)
      .map((s) => s.id);
  const drop = (activeId: string, overId: string, placement?: 'before' | 'after'): Story[] =>
    dropInBacklog(base, sprints, activeId, overId, placement);

  it('round-trips section ids', () => {
    expect(parseSectionId(sectionId(S2))).toBe(S2);
    expect(parseSectionId(sectionId(null))).toBeNull();
    expect(parseSectionId('story-1')).toBeUndefined();
  });

  it('shows one section per sprint in time order, then the unplanned stories, each by rank', () => {
    expect(shown(base)).toEqual(['a', 'b', 'c', 'f', 'd', 'e']);
  });

  it('moves a story up and down inside a sprint', () => {
    expect(shown(drop('c', 'a'))).toEqual(['c', 'a', 'b', 'f', 'd', 'e']);
    expect(shown(drop('a', 'b'))).toEqual(['b', 'a', 'c', 'f', 'd', 'e']);
  });

  it('follows an explicit placement', () => {
    expect(shown(drop('a', 'c', 'before'))).toEqual(['b', 'a', 'c', 'f', 'd', 'e']);
    expect(shown(drop('c', 'a', 'after'))).toEqual(['a', 'c', 'b', 'f', 'd', 'e']);
  });

  it('plans a story into the sprint it is dropped in', () => {
    const next = drop('e', 'b');
    expect(inSprint(next, S1)).toEqual(['a', 'e', 'b', 'c']);
    expect(next.find((s) => s.id === 'e')?.sprintId).toBe(S1);
  });

  it('moves a story from one sprint to another', () => {
    const next = drop('a', 'f', 'after');
    expect(inSprint(next, S2)).toEqual(['f', 'a']);
    expect(shown(next)).toEqual(['b', 'c', 'f', 'a', 'd', 'e']);
  });

  it('takes a story out of its sprint when it is dropped among the unplanned stories', () => {
    const next = drop('a', 'e');
    expect(shown(next)).toEqual(['b', 'c', 'f', 'd', 'a', 'e']);
    expect(next.find((s) => s.id === 'a')?.sprintId).toBeNull();
  });

  it('appends to the end of a section when dropped on the section', () => {
    expect(inSprint(drop('d', sectionId(S1)), S1)).toEqual(['a', 'b', 'c', 'd']);
    expect(inSprint(drop('d', sectionId(S2)), S2)).toEqual(['f', 'd']);
    expect(shown(drop('a', sectionId(null)))).toEqual(['b', 'c', 'f', 'd', 'e', 'a']);
  });

  it('places a story into an empty sprint between the sprints around it', () => {
    const three = [...sprints, { id: 'sprint-3', name: 'Sprint 3', startDate: '2026-11-02', endDate: '2026-11-15' }];
    const next = dropInBacklog(base, three, 'd', sectionId('sprint-3'));
    expect(backlogOrder(next, three).map((s) => s.id)).toEqual(['a', 'b', 'c', 'f', 'd', 'e']);
    expect(next.find((s) => s.id === 'd')?.sprintId).toBe('sprint-3');
  });

  it('stores the shown order as gapless ranks, so the board follows', () => {
    const next = drop('c', 'a');
    expect(sortByRank(next).map((s) => [s.id, s.rank])).toEqual([
      ['c', 0],
      ['a', 1],
      ['b', 2],
      ['f', 3],
      ['d', 4],
      ['e', 5]
    ]);
    expect(storiesInColumn(next, S1, 'todo').map((s) => s.id)).toEqual(['c', 'a', 'b']);
  });

  it('does nothing when dropped on itself, on an unknown id or on an unknown sprint', () => {
    expect(drop('a', 'a')).toBe(base);
    expect(drop('a', 'nope')).toBe(base);
    expect(drop('nope', 'a')).toBe(base);
    expect(drop('a', sectionId('no-such-sprint'))).toBe(base);
  });
});

describe('story map', () => {
  // Epic x: a (S1), b (S1), c (S2). Epic y: d (S1). Not planned: e (x).
  const base = [
    story('a', 'todo', 0, S1, 'x'),
    story('d', 'todo', 1, S1, 'y'),
    story('b', 'todo', 2, S1, 'x'),
    story('c', 'todo', 3, S2, 'x'),
    story('e', 'todo', 4, null, 'x')
  ];
  const cell = (stories: Story[], epicId: string, sprintId: string | null): string[] =>
    storiesInCell(stories, epicId, sprintId).map((s) => s.id);

  it('round-trips cell ids', () => {
    expect(parseCellId(cellId('epic-1', S2))).toEqual({ epicId: 'epic-1', sprintId: S2 });
    expect(parseCellId(cellId('epic-1', null))).toEqual({ epicId: 'epic-1', sprintId: null });
    expect(parseCellId('story-1')).toBeNull();
  });

  it('lists the stories of a cell by rank', () => {
    expect(cell(base, 'x', S1)).toEqual(['a', 'b']);
    expect(cell(base, 'y', S1)).toEqual(['d']);
    expect(cell(base, 'x', null)).toEqual(['e']);
  });

  it('moves a story into another epic and sprint when dropped on a cell', () => {
    const next = dropOnMap(base, sprints, 'e', cellId('y', S2));
    expect(next.find((s) => s.id === 'e')).toMatchObject({ epicId: 'y', sprintId: S2 });
    expect(cell(next, 'y', S2)).toEqual(['e']);
  });

  it('appends to the end of a cell', () => {
    expect(cell(dropOnMap(base, sprints, 'e', cellId('x', S1)), 'x', S1)).toEqual(['a', 'b', 'e']);
  });

  it('places a story before or after the card it is dropped on, taking that card\'s epic and sprint', () => {
    expect(cell(dropOnMap(base, sprints, 'e', 'b', 'before'), 'x', S1)).toEqual(['a', 'e', 'b']);
    expect(cell(dropOnMap(base, sprints, 'd', 'a', 'after'), 'x', S1)).toEqual(['a', 'd', 'b']);
  });

  it('reorders inside a cell like the board when no placement is given', () => {
    expect(cell(dropOnMap(base, sprints, 'a', 'b'), 'x', S1)).toEqual(['b', 'a']);
    expect(cell(dropOnMap(base, sprints, 'b', 'a'), 'x', S1)).toEqual(['b', 'a']);
  });

  it('takes a story out of its sprint when dropped in the "not planned" row', () => {
    const next = dropOnMap(base, sprints, 'a', cellId('y', null));
    expect(next.find((s) => s.id === 'a')).toMatchObject({ epicId: 'y', sprintId: null });
  });

  it('keeps the backlog grouped by sprint after a drop', () => {
    const next = dropOnMap(base, sprints, 'c', cellId('y', S1));
    expect(backlogOrder(next, sprints).map((s) => s.sprintId)).toEqual([S1, S1, S1, S1, null]);
    expect(sortByRank(next).map((s) => s.rank)).toEqual([0, 1, 2, 3, 4]);
  });

  it('does nothing for unknown ids or an unknown sprint', () => {
    expect(dropOnMap(base, sprints, 'a', 'a')).toBe(base);
    expect(dropOnMap(base, sprints, 'a', 'nope')).toBe(base);
    expect(dropOnMap(base, sprints, 'a', cellId('x', 'no-such-sprint'))).toBe(base);
  });
});

describe('sprint', () => {
  const base = [story('a', 'todo', 0), story('b', 'todo', 1, null), story('c', 'done', 2, S2)];

  it('lists the stories of one sprint, or the unplanned ones', () => {
    expect(sprintStories(base, S1).map((s) => s.id)).toEqual(['a']);
    expect(sprintStories(base, null).map((s) => s.id)).toEqual(['b']);
  });

  it('adds up points', () => {
    expect(totalPoints(sprintStories(base, S1))).toBe(1);
    expect(totalPoints(base)).toBe(3);
  });
});

describe('acceptance criteria', () => {
  const { stories } = seedSnapshot(TODAY);

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
  const { stories } = seedSnapshot(TODAY);

  it('uses the next free key', () => {
    expect(nextCode(stories)).toBe('S-8');
  });

  it('appends a trimmed story to "To do" and the sprint', () => {
    const result = createStory(
      stories,
      { title: '  New idea  ', description: ' text ', epicId: 'epic-boards', points: 3, sprintId: S1 },
      'id-1'
    );
    expect(result.story).toMatchObject({
      id: 'id-1',
      code: 'S-8',
      title: 'New idea',
      description: 'text',
      status: 'todo',
      sprintId: S1,
      rank: stories.length
    });
    expect(result.stories).toHaveLength(stories.length + 1);
  });

  it('puts the story behind the last rank even after a delete left a gap', () => {
    const withGap = deleteStory(stories, 'story-3');
    const result = createStory(withGap, { title: 'Next', description: '', epicId: 'epic-boards', points: 1, sprintId: null }, 'id-2');
    expect(result.story.rank).toBe(7);
    expect(new Set(result.stories.map((s) => s.rank)).size).toBe(result.stories.length);
  });
});

describe('editing stories', () => {
  const { stories } = seedSnapshot(TODAY);
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
    const next = updateStory(stories, 'story-1', { epicId: 'epic-storage', sprintId: null });
    expect(find(next, 'story-1')).toMatchObject({ epicId: 'epic-storage', sprintId: null });
  });

  it('deletes a story', () => {
    expect(deleteStory(stories, 'story-1').map((s) => s.id)).not.toContain('story-1');
  });
});
