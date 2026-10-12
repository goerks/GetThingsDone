import { describe, expect, it } from 'vitest';
import { baselineEvents, dayOf, eventsOfRelease, netChange, releaseEventsFor, scopeReport } from './history';
import type { Release, ReleaseEvent, Story } from './types';

let counter = 0;
const newId = (): string => `ev-${(counter += 1)}`;

function story(id: string, overrides: Partial<Story> = {}): Story {
  return {
    id,
    code: id.toUpperCase(),
    title: id,
    description: '',
    epicId: null,
    points: 3,
    status: 'todo',
    sprintId: null,
    releaseId: null,
    rank: 0,
    criteria: [],
    values: {},
    ...overrides
  };
}

const AT = '2026-10-12T10:00:00.000Z';
const kinds = (events: ReleaseEvent[]): string[] => events.map((event) => `${event.kind}:${event.releaseId}:${event.storyId}`);

describe('releaseEventsFor', () => {
  it('records nothing for stories without a release', () => {
    const before = [story('a')];
    expect(releaseEventsFor(before, [story('a', { points: 5, status: 'done' })], AT, newId)).toEqual([]);
  });

  it('records a story that joins a release, with its points and whether it is done', () => {
    const events = releaseEventsFor([story('a')], [story('a', { releaseId: 'r1', points: 5, status: 'done' })], AT, newId);
    expect(events).toMatchObject([{ kind: 'added', releaseId: 'r1', storyId: 'a', code: 'A', points: 5, done: true, at: AT }]);
  });

  it('records a story that leaves a release', () => {
    const events = releaseEventsFor([story('a', { releaseId: 'r1', points: 8 })], [story('a')], AT, newId);
    expect(events).toMatchObject([{ kind: 'removed', releaseId: 'r1', points: 8 }]);
  });

  it('records a move between releases as a removal and an addition', () => {
    const events = releaseEventsFor([story('a', { releaseId: 'r1' })], [story('a', { releaseId: 'r2' })], AT, newId);
    expect(kinds(events)).toEqual(['removed:r1:a', 'added:r2:a']);
  });

  it('records a change of points and a change into and out of done while in a release', () => {
    const base = story('a', { releaseId: 'r1' });
    expect(kinds(releaseEventsFor([base], [{ ...base, points: 5 }], AT, newId))).toEqual(['points:r1:a']);
    expect(kinds(releaseEventsFor([base], [{ ...base, status: 'done' }], AT, newId))).toEqual(['done:r1:a']);
    expect(kinds(releaseEventsFor([{ ...base, status: 'done' }], [{ ...base, status: 'review' }], AT, newId))).toEqual(['reopened:r1:a']);
    expect(releaseEventsFor([base], [{ ...base, status: 'in_progress' }], AT, newId)).toEqual([]);
  });

  it('records a deleted story as removed, and a new story with a release as added', () => {
    const gone = story('a', { releaseId: 'r1' });
    expect(kinds(releaseEventsFor([gone], [], AT, newId))).toEqual(['removed:r1:a']);
    expect(kinds(releaseEventsFor([], [gone], AT, newId))).toEqual(['added:r1:a']);
    expect(releaseEventsFor([story('b')], [], AT, newId)).toEqual([]);
  });

  it('records nothing when nothing changed', () => {
    const list = [story('a', { releaseId: 'r1' })];
    expect(releaseEventsFor(list, list, AT, newId)).toEqual([]);
  });
});

describe('baselineEvents', () => {
  const releases: Release[] = [
    { id: 'r1', title: 'One', description: '', startDate: null, endDate: null },
    { id: 'r2', title: 'Two', description: '', startDate: null, endDate: null }
  ];
  const stories = [story('a', { releaseId: 'r1', points: 5, status: 'done' }), story('b', { releaseId: 'r2' }), story('c')];

  it('starts the history of a release that has stories and none yet', () => {
    const events = baselineEvents(releases, stories, [], AT, newId);
    expect(events).toMatchObject([
      { kind: 'baseline', releaseId: 'r1', storyId: 'a', points: 5, done: true },
      { kind: 'baseline', releaseId: 'r2', storyId: 'b', points: 3, done: false }
    ]);
  });

  it('leaves a release with a history alone', () => {
    const existing: ReleaseEvent[] = [{ id: 'x', at: AT, releaseId: 'r1', storyId: 'a', code: 'A', kind: 'baseline', points: 5, done: false }];
    expect(baselineEvents(releases, stories, existing, AT, newId).map((event) => event.releaseId)).toEqual(['r2']);
  });
});

describe('scopeReport', () => {
  const release: Release = { id: 'r1', title: 'One', description: '', startDate: '2026-10-05', endDate: '2026-11-20' };
  const event = (day: string, kind: ReleaseEvent['kind'], storyId: string, points: number, done = false): ReleaseEvent => ({
    id: `${day}-${kind}-${storyId}`,
    at: `${day}T12:00:00.000Z`,
    releaseId: 'r1',
    storyId,
    code: storyId.toUpperCase(),
    kind,
    points,
    done
  });
  const history = [
    event('2026-10-04', 'added', 'a', 5), // before the start: part of the start
    event('2026-10-04', 'added', 'b', 3),
    event('2026-10-05', 'added', 'c', 2), // on the start day: still the start
    event('2026-10-07', 'done', 'a', 5, true),
    event('2026-10-08', 'added', 'd', 8), // after the start: an increase
    event('2026-10-09', 'points', 'b', 5), // +2
    event('2026-10-10', 'removed', 'c', 2), // a decrease
    event('2026-10-11', 'points', 'd', 5) // -3
  ];
  const report = scopeReport(release, history, '2026-10-12');

  it('is null without a history', () => {
    expect(scopeReport(release, [], '2026-10-12')).toBeNull();
    expect(scopeReport(release, [{ ...history[0], releaseId: 'other' }], '2026-10-12')).toBeNull();
  });

  it('starts with the state on the start day and does not know the time before the first entry', () => {
    expect(report?.recordedSince).toBe('2026-10-04');
    expect(report?.changesAfter).toBe('2026-10-05');
    expect(report?.start).toEqual({ tickets: 3, points: 10 });
  });

  it('counts a story added after the start as an increase and one removed as a decrease', () => {
    expect(report?.changes.map((change) => [change.day, change.kind, change.tickets, change.points])).toEqual([
      ['2026-10-08', 'added', 1, 8],
      ['2026-10-09', 'points', 0, 2],
      ['2026-10-10', 'removed', -1, -2],
      ['2026-10-11', 'points', 0, -3]
    ]);
    expect(report?.increase).toEqual({ tickets: 1, points: 10 });
    expect(report?.decrease).toEqual({ tickets: 1, points: 5 });
  });

  it('adds up: start plus increase minus decrease is the scope now', () => {
    expect(report?.now).toEqual({ tickets: 3, points: 10 + 10 - 5 });
    expect(report && netChange(report)).toEqual({ tickets: 0, points: 5 });
  });

  it('never lets a change of status change the scope, but tracks what is done', () => {
    const done = report?.days.find((day) => day.day === '2026-10-07');
    expect(done?.change).toEqual({ tickets: 0, points: 0 });
    expect(done?.done).toEqual({ tickets: 1, points: 5 });
    expect(done?.scope).toEqual({ tickets: 3, points: 10 });
  });

  it('has one entry per calendar day up to today, with the net change of that day', () => {
    expect(report?.days).toHaveLength(9);
    expect(report?.days[0].day).toBe('2026-10-04');
    expect(report?.days[8].day).toBe('2026-10-12');
    expect(report?.days.find((day) => day.day === '2026-10-08')?.change).toEqual({ tickets: 1, points: 8 });
    expect(report?.days.find((day) => day.day === '2026-10-06')?.scope).toEqual({ tickets: 3, points: 10 });
  });

  it('treats a baseline entry as part of the start, whenever it was recorded', () => {
    const late = scopeReport(release, [event('2026-10-12', 'baseline', 'a', 5), event('2026-10-12', 'baseline', 'b', 3)], '2026-10-12');
    expect(late?.start).toEqual({ tickets: 2, points: 8 });
    expect(late?.increase).toEqual({ tickets: 0, points: 0 });
    expect(late?.days).toHaveLength(1);
  });

  it('without a start date, the first day of the history is the start', () => {
    const open = { ...release, startDate: null };
    const result = scopeReport(open, [event('2026-10-04', 'added', 'a', 5), event('2026-10-04', 'added', 'b', 3), event('2026-10-06', 'added', 'c', 2)], '2026-10-06');
    expect(result?.changesAfter).toBe('2026-10-04');
    expect(result?.start).toEqual({ tickets: 2, points: 8 });
    expect(result?.increase).toEqual({ tickets: 1, points: 2 });
  });

  it('keeps a removed story that was never part of the history readable', () => {
    const result = scopeReport({ ...release, startDate: null }, [event('2026-10-04', 'added', 'a', 5), event('2026-10-06', 'removed', 'zzz', 4)], '2026-10-06');
    expect(result?.changes[0]).toMatchObject({ kind: 'removed', code: 'ZZZ', tickets: -1, points: -4 });
  });

  it('orders entries of one day by the time they were recorded', () => {
    const list = [event('2026-10-08', 'removed', 'a', 5), event('2026-10-08', 'added', 'a', 5)];
    const same = list.map((item, index) => ({ ...item, at: `2026-10-08T12:00:0${index}.000Z` }));
    expect(eventsOfRelease([...same].reverse(), 'r1').map((item) => item.kind)).toEqual(['removed', 'added']);
  });

  it('knows the day of a timestamp', () => {
    expect(dayOf('2026-10-08T12:00:00.000Z')).toBe('2026-10-08');
  });
});
