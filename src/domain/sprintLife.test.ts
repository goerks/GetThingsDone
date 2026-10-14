import { describe, expect, it } from 'vitest';
import { completeNeedsDate, completeSprint, contentsOf, settleSprints, startNeedsDates, startSprint, summarizeSprint, type CompleteInput } from './sprintLife';
import { DEFAULT_STATUSES, isDoneIn } from './statuses';
import type { Sprint, Story } from './types';

const isDone = isDoneIn(DEFAULT_STATUSES);
const nameFor = (number: number): string => `Sprint ${number}`;

function story(id: string, sprintId: string | null, points: number, status = 'todo', rank = 0): Story {
  return { id, code: id, title: `Story ${id}`, description: '', epicId: null, points, status, sprintId, releaseId: null, rank, criteria: [], values: {} };
}

function sprint(id: string, startDate: string, endDate: string, state: Sprint['state'] = 'planned', startItems: Sprint['startItems'] = null): Sprint {
  return { id, name: id.replace('s', 'Sprint '), startDate, endDate, state, startItems, result: null };
}

const input = (over: Partial<CompleteInput> = {}): CompleteInput => ({ target: 'next', endDate: 'today', today: '2026-10-20', newId: 'new', nameFor, ...over });

describe('starting a sprint', () => {
  const stories = [story('a', 's2', 5), story('b', 's2', 3), story('c', 's2', 0), story('x', null, 8)];

  it('AC2.1 keeps the stories and points of the sprint as the planned scope and runs it', () => {
    // Given a planned sprint with three stories and no running sprint
    const sprints = [sprint('s2', '2026-10-21', '2026-11-03')];
    // When it is started on its planned start day
    const after = startSprint(sprints, stories, 's2', 'keep', '2026-10-21');
    // Then it runs and remembers its stories as they are now
    expect(after?.[0]).toMatchObject({
      state: 'running',
      startDate: '2026-10-21',
      endDate: '2026-11-03',
      startItems: [
        { storyId: 'a', code: 'a', points: 5 },
        { storyId: 'b', code: 'b', points: 3 },
        { storyId: 'c', code: 'c', points: 0 }
      ]
    });
  });

  it('AC2.3 starts a sprint without stories', () => {
    const sprints = [sprint('s3', '2026-11-04', '2026-11-17')];
    const after = startSprint(sprints, stories, 's3', 'keep', '2026-11-04');
    expect(after?.[0]).toMatchObject({ state: 'running', startItems: [] });
    expect(contentsOf(stories, 's3')).toEqual({ stories: [], points: 0, withoutPoints: [] });
  });

  it('AC2.4 names the stories without points and counts them as 0', () => {
    const contents = contentsOf(stories, 's2');
    expect(contents.points).toBe(8);
    expect(contents.withoutPoints.map((item) => item.code)).toEqual(['c']);
  });

  it('AC1.2 refuses to start a sprint while another one runs, and a sprint that is not planned', () => {
    const sprints = [sprint('s1', '2026-10-07', '2026-10-20', 'running', []), sprint('s2', '2026-10-21', '2026-11-03')];
    expect(startSprint(sprints, stories, 's2', 'keep', '2026-10-21')).toBeNull();
    expect(startSprint([sprints[0]], stories, 's1', 'keep', '2026-10-21')).toBeNull();
    expect(startSprint(sprints, stories, 'missing', 'keep', '2026-10-21')).toBeNull();
  });

  it('AC3.1 asks for the dates only when today is not the planned start day', () => {
    const planned = sprint('s2', '2026-10-21', '2026-11-03');
    expect(startNeedsDates(planned, '2026-10-21')).toBe(false);
    expect(startNeedsDates(planned, '2026-10-23')).toBe(true);
    expect(startNeedsDates(planned, '2026-10-19')).toBe(true);
  });

  it.each([
    ['AC3.2 later, from today', '2026-10-23', 'today', '2026-10-23', '2026-11-05'],
    ['AC3.3 later, keeping the planned dates', '2026-10-23', 'keep', '2026-10-21', '2026-11-03'],
    ['AC3.4 earlier, from today', '2026-10-19', 'today', '2026-10-19', '2026-11-01']
  ])('%s', (_name, today, dates, start, end) => {
    const after = startSprint([sprint('s2', '2026-10-21', '2026-11-03')], stories, 's2', dates as 'today' | 'keep', today);
    expect([after?.[0].startDate, after?.[0].endDate]).toEqual([start, end]);
  });
});

describe('summary of a sprint', () => {
  // Started with a, b, c, d (23 points); s was added later, c was taken out, b grew from 5 to 8 points.
  const startItems = [
    { storyId: 'a', code: 'S-1', points: 8 },
    { storyId: 'b', code: 'S-2', points: 5 },
    { storyId: 'c', code: 'S-3', points: 3 },
    { storyId: 'd', code: 'S-4', points: 7 }
  ];
  const running = sprint('s1', '2026-10-07', '2026-10-20', 'running', startItems);
  const stories = [
    { ...story('a', 's1', 8, 'done'), code: 'S-1' },
    { ...story('b', 's1', 8, 'in_progress'), code: 'S-2' },
    { ...story('c', null, 3), code: 'S-3' },
    { ...story('d', 's1', 7, 'done'), code: 'S-4' },
    { ...story('s', 's1', 3, 'done'), code: 'S-8' }
  ];

  it('AC6.1 counts planned, done and not done, and what joined during the sprint', () => {
    // Given the sprint above
    // When it is summarised
    const summary = summarizeSprint(running, stories, isDone);
    // Then planned is the scope at the start and the changes are named
    expect(summary).toMatchObject({ plannedPoints: 23, plannedStories: 4, donePoints: 18, notDonePoints: 8 });
    expect(summary.done.map((item) => item.code)).toEqual(['S-1', 'S-4', 'S-8']);
    expect(summary.notDone.map((item) => item.code)).toEqual(['S-2']);
    expect(summary.added.map((item) => item.code)).toEqual(['S-8']);
    expect(summary.addedPoints).toBe(3);
  });

  it('AC6.2 names a story that left the sprint, also when it was deleted', () => {
    const summary = summarizeSprint(running, stories.filter((item) => item.id !== 'd'), isDone);
    expect(summary.removed.map((item) => item.code)).toEqual(['S-3', 'S-4']);
    expect(summary.removedPoints).toBe(10);
  });

  it('Q20 counts a change of the points of a story that stayed, and keeps the planned points', () => {
    const summary = summarizeSprint(running, stories, isDone);
    expect(summary.changedPoints).toBe(3);
    expect(summary.plannedPoints).toBe(23);
  });

  it('AC6.3 names the stories without points', () => {
    const summary = summarizeSprint(running, [...stories, story('z', 's1', 0)], isDone);
    expect(summary.withoutPoints.map((item) => item.code)).toEqual(['z']);
  });

  it('AC6.4 can be more done than planned', () => {
    const items = [{ storyId: 'a', code: 'a', points: 3 }];
    const all = [story('a', 's1', 3, 'done'), story('b', 's1', 3, 'done')];
    const summary = summarizeSprint(sprint('s1', '2026-10-07', '2026-10-20', 'running', items), all, isDone);
    expect(summary).toMatchObject({ plannedPoints: 3, donePoints: 6, notDonePoints: 0 });
  });
});

describe('completing a sprint', () => {
  // s1 runs with a (done), b, c (not done); s2 is planned and already holds p.
  const items = [
    { storyId: 'a', code: 'a', points: 3 },
    { storyId: 'b', code: 'b', points: 5 },
    { storyId: 'c', code: 'c', points: 5 }
  ];
  const sprints = [sprint('s1', '2026-10-07', '2026-10-20', 'running', items), sprint('s2', '2026-10-21', '2026-11-03')];
  const stories = [story('a', 's1', 3, 'done', 0), story('b', 's1', 5, 'in_progress', 1), story('c', 's1', 5, 'todo', 2), story('p', 's2', 8, 'todo', 3), story('u', null, 2, 'todo', 4)];
  const sprintOf = (list: Story[], id: string): string | null => list.find((item) => item.id === id)?.sprintId ?? null;

  it('AC7.1 moves the unfinished stories to the top of the next sprint and keeps the done one', () => {
    // Given a running sprint with two unfinished stories and a planned sprint
    // When it is completed with "next sprint"
    const result = completeSprint(sprints, stories, 's1', isDone, input());
    // Then the unfinished stories lead the next sprint and the done story stays in the completed sprint
    expect(result?.completed).toMatchObject({ state: 'completed' });
    expect(result?.targetSprint?.id).toBe('s2');
    expect(sprintOf(result!.stories, 'a')).toBe('s1');
    expect(['b', 'c', 'p'].map((id) => sprintOf(result!.stories, id))).toEqual(['s2', 's2', 's2']);
    const order = [...result!.stories].sort((x, y) => x.rank - y.rank).filter((item) => item.sprintId === 's2').map((item) => item.id);
    expect(order).toEqual(['b', 'c', 'p']);
    expect(contentsOf(result!.stories, 's2').points).toBe(18);
  });

  it('AC7.2 creates a new sprint after the last one with the next number and two weeks', () => {
    const result = completeSprint(sprints, stories, 's1', isDone, input({ target: 'new' }));
    expect(result?.created).toBe(true);
    expect(result?.targetSprint).toMatchObject({ id: 'new', name: 'Sprint 3', startDate: '2026-11-04', endDate: '2026-11-17', state: 'planned' });
    expect(result?.sprints.map((item) => item.id)).toEqual(['s1', 's2', 'new']);
    expect(['b', 'c'].map((id) => sprintOf(result!.stories, id))).toEqual(['new', 'new']);
  });

  it('AC7.3 puts the unfinished stories at the top of the backlog', () => {
    const result = completeSprint(sprints, stories, 's1', isDone, input({ target: 'backlog' }));
    expect(result?.targetSprint).toBeNull();
    expect(['b', 'c'].map((id) => sprintOf(result!.stories, id))).toEqual([null, null]);
    const unplanned = [...result!.stories].sort((x, y) => x.rank - y.rank).filter((item) => item.sprintId === null).map((item) => item.id);
    expect(unplanned).toEqual(['b', 'c', 'u']);
  });

  it('AC7.4 cannot move to a next sprint when none is planned', () => {
    expect(completeSprint([sprints[0]], stories, 's1', isDone, input())).toBeNull();
  });

  it('AC7.5 moves nothing when every story is done and creates no sprint', () => {
    const done = stories.map((item) => (item.sprintId === 's1' ? { ...item, status: 'done' } : item));
    const result = completeSprint(sprints, done, 's1', isDone, input({ target: 'new' }));
    expect(result?.created).toBe(false);
    expect(result?.sprints).toHaveLength(2);
    expect(result?.stories).toBe(done);
  });

  it('AC9.1 stores the result of the sprint', () => {
    const result = completeSprint(sprints, stories, 's1', isDone, input());
    expect(result?.completed.result).toEqual({
      completedOn: '2026-10-20',
      plannedPoints: 13,
      plannedStories: 3,
      donePoints: 3,
      doneStories: 1,
      notDonePoints: 10,
      notDoneStories: 2,
      addedStories: 0,
      addedPoints: 0,
      removedStories: 0,
      removedPoints: 0,
      changedPoints: 0
    });
  });

  it('refuses a sprint that does not run', () => {
    expect(completeSprint(sprints, stories, 's2', isDone, input())).toBeNull();
  });

  it('AC8.1 asks about the end date only when today is not the planned end day and not before the start', () => {
    const running = sprints[0];
    expect(completeNeedsDate(running, '2026-10-20')).toBe(false);
    expect(completeNeedsDate(running, '2026-10-16')).toBe(true);
    expect(completeNeedsDate(running, '2026-10-23')).toBe(true);
    expect(completeNeedsDate(running, '2026-10-05')).toBe(false);
  });

  it.each([
    ['AC8.2 earlier, end date today', '2026-10-16', 'today', '2026-10-16'],
    ['AC8.3 earlier, keeping the planned end', '2026-10-16', 'keep', '2026-10-20'],
    ['AC8.4 later, end date today', '2026-10-23', 'today', '2026-10-23']
  ])('%s', (_name, today, endDate, expected) => {
    const result = completeSprint(sprints, stories, 's1', isDone, input({ today, endDate: endDate as 'today' | 'keep' }));
    expect(result?.completed.endDate).toBe(expected);
    expect(result?.completed.result?.completedOn).toBe(today);
  });
});

describe('sprints of an earlier version', () => {
  const legacy = (id: string, startDate: string, endDate: string): Omit<Sprint, 'state' | 'startItems' | 'result'> => ({
    id,
    name: id.replace('s', 'Sprint '),
    startDate,
    endDate
  });
  // Today is 12 October: s0 ended on 6 October, s1 runs, s2 starts on 21 October.
  const sprints = [legacy('s0', '2026-09-23', '2026-10-06'), legacy('s1', '2026-10-07', '2026-10-20'), legacy('s2', '2026-10-21', '2026-11-03')];
  const stories = [
    story('a', 's0', 5, 'done', 0),
    story('b', 's0', 5, 'done', 1),
    story('c', 's0', 10, 'in_progress', 2),
    story('d', 's1', 3, 'todo', 3),
    story('e', 's2', 2, 'todo', 4)
  ];

  it('AC11.1 gives each sprint its state by the dates', () => {
    // When the sprints of an earlier version are settled on 12 October
    const settled = settleSprints(sprints, stories, isDone, '2026-10-12');
    // Then earlier sprints are completed, today's sprint runs and later ones are planned
    expect(settled.sprints.map((item) => [item.id, item.state])).toEqual([
      ['s0', 'completed'],
      ['s1', 'running'],
      ['s2', 'planned']
    ]);
  });

  it('AC11.2 computes the result of a completed sprint and keeps the scope of a running one', () => {
    const settled = settleSprints(sprints, stories, isDone, '2026-10-12');
    expect(settled.sprints[0].result).toMatchObject({ completedOn: '2026-10-06', plannedPoints: 20, donePoints: 10, doneStories: 2, notDonePoints: 10, notDoneStories: 1 });
    expect(settled.sprints[1].startItems).toEqual([{ storyId: 'd', code: 'd', points: 3 }]);
    expect(settled.sprints[2].startItems).toBeNull();
  });

  it('Q19 moves the unfinished stories of a sprint that is completed this way back to the backlog', () => {
    const settled = settleSprints(sprints, stories, isDone, '2026-10-12');
    expect(settled.stories.find((item) => item.id === 'c')?.sprintId).toBeNull();
    expect(settled.stories.find((item) => item.id === 'a')?.sprintId).toBe('s0');
  });

  it('AC11.3 lets no sprint run between two sprints', () => {
    const settled = settleSprints([legacy('s1', '2026-10-07', '2026-10-20'), legacy('s2', '2026-10-28', '2026-11-10')], [], isDone, '2026-10-23');
    expect(settled.sprints.map((item) => item.state)).toEqual(['completed', 'planned']);
  });

  it('keeps sprints that already have a state and does not touch the stories', () => {
    const current = [sprint('s1', '2026-10-07', '2026-10-20', 'running', [])];
    const settled = settleSprints(current, stories, isDone, '2026-12-01');
    expect(settled.sprints).toEqual(current);
    expect(settled.stories).toBe(stories);
  });
});
