import { describe, expect, it } from 'vitest';
import {
  createRelease,
  deleteRelease,
  isReleaseDone,
  releaseState,
  releaseStats,
  selectableReleases,
  sortReleases,
  sprintEndsAfterRelease,
  storiesAfterReleaseEnd,
  storiesInRelease,
  updateRelease,
  validateRelease,
  type ReleaseInput
} from './releases';
import type { Release, Sprint, Story } from './types';

function story(id: string, releaseId: string | null, overrides: Partial<Story> = {}): Story {
  return {
    id,
    code: id.toUpperCase(),
    title: id,
    description: '',
    epicId: null,
    points: 3,
    status: 'todo',
    sprintId: null,
    releaseId,
    rank: Number(id.replace(/\D/g, '')) || 0,
    criteria: [],
    values: {},
    ...overrides
  };
}

const release = (id: string, startDate: string | null = null, endDate: string | null = null, title = id): Release => ({
  id,
  title,
  description: '',
  startDate,
  endDate
});

const input = (overrides: Partial<ReleaseInput> = {}): ReleaseInput => ({
  title: 'Release 1.0',
  description: '',
  startDate: null,
  endDate: null,
  ...overrides
});

describe('validateRelease', () => {
  it('needs a title, but no dates and no description', () => {
    expect(validateRelease(input())).toBeNull();
    expect(validateRelease(input({ title: '   ' }))).toBe('titleRequired');
  });

  it('accepts one date alone and rejects a date that does not exist', () => {
    expect(validateRelease(input({ startDate: '2026-10-05' }))).toBeNull();
    expect(validateRelease(input({ endDate: '2026-11-20' }))).toBeNull();
    expect(validateRelease(input({ startDate: '2026-02-30' }))).toBe('startInvalid');
    expect(validateRelease(input({ endDate: 'soon' }))).toBe('endInvalid');
  });

  it('refuses an end before the start and allows a single-day release', () => {
    expect(validateRelease(input({ startDate: '2026-11-20', endDate: '2026-11-19' }))).toBe('endBeforeStart');
    expect(validateRelease(input({ startDate: '2026-11-20', endDate: '2026-11-20' }))).toBeNull();
  });
});

describe('create, update and delete', () => {
  it('creates a trimmed release and stores missing dates as null', () => {
    const result = createRelease([], input({ title: '  Beta ', description: ' text ', startDate: '' }), 'r1');
    expect(result?.release).toEqual({ id: 'r1', title: 'Beta', description: 'text', startDate: null, endDate: null });
  });

  it('refuses an invalid release', () => {
    expect(createRelease([], input({ title: '' }), 'r1')).toBeNull();
  });

  it('changes a release and ignores invalid input and unknown ids', () => {
    const list = [release('r1')];
    expect(updateRelease(list, 'r1', input({ title: 'Beta', endDate: '2026-12-01' }))[0]).toMatchObject({ title: 'Beta', endDate: '2026-12-01' });
    expect(updateRelease(list, 'r1', input({ title: '' }))).toBe(list);
    expect(updateRelease(list, 'nope', input())).toBe(list);
  });

  it('deletes a release and lets its stories lose it while the other stories keep theirs', () => {
    const stories = [story('s1', 'r1'), story('s2', 'r2'), story('s3', null)];
    const result = deleteRelease([release('r1'), release('r2')], stories, 'r1');
    expect(result.releases.map((item) => item.id)).toEqual(['r2']);
    expect(result.stories.map((item) => item.releaseId)).toEqual([null, 'r2', null]);
    expect(result.stories).toHaveLength(3);
  });
});

describe('size and progress', () => {
  const stories = [
    story('s1', 'r1', { points: 5, status: 'done' }),
    story('s2', 'r1', { points: 3 }),
    story('s3', 'r1', { points: 2, status: 'done' }),
    story('s4', 'r2', { points: 8 }),
    story('s5', null, { points: 13 })
  ];

  it('counts stories and points of a release, and what is done', () => {
    expect(releaseStats(stories, 'r1')).toEqual({ stories: 3, points: 10, doneStories: 2, donePoints: 7 });
    expect(releaseStats(stories, 'r2')).toEqual({ stories: 1, points: 8, doneStories: 0, donePoints: 0 });
    expect(releaseStats(stories, 'none')).toEqual({ stories: 0, points: 0, doneStories: 0, donePoints: 0 });
  });

  it('lists the stories of a release by rank', () => {
    expect(storiesInRelease(stories, 'r1').map((item) => item.id)).toEqual(['s1', 's2', 's3']);
  });
});

describe('release state', () => {
  const today = '2026-10-12';
  const open = [story('s1', 'r1', { status: 'done' }), story('s2', 'r1')];
  const allDone = [story('s1', 'r1', { status: 'done' }), story('s2', 'r1', { status: 'done' })];

  it('is done only when the release has stories and all are done', () => {
    expect(releaseState(release('r1'), allDone, today)).toBe('done');
    expect(releaseState(release('r1'), open, today)).toBe('planned');
    expect(releaseState(release('r1', '2026-10-01'), [], today)).toBe('running');
    expect(isReleaseDone([], 'r1')).toBe(false);
  });

  it('is running from the start date on and planned before it or without one', () => {
    expect(releaseState(release('r1', '2026-10-12'), open, today)).toBe('running');
    expect(releaseState(release('r1', '2026-10-13'), open, today)).toBe('planned');
    expect(releaseState(release('r1', null, '2026-12-01'), open, today)).toBe('planned');
  });

  it('runs again when a story is added to a done release', () => {
    const reopened = [...allDone, story('s3', 'r1')];
    expect(releaseState(release('r1', '2026-10-01'), reopened, today)).toBe('running');
  });
});

describe('order and choice', () => {
  const stories = [story('s1', 'done-one', { status: 'done' })];
  const list = [
    release('no-date-b', null, null, 'B'),
    release('done-one', '2026-01-01'),
    release('late', '2026-12-01'),
    release('no-date-a', null, null, 'A'),
    release('early', '2026-10-01')
  ];

  it('sorts by start date, then releases without one by title, and done releases last', () => {
    expect(sortReleases(list, stories).map((item) => item.id)).toEqual(['early', 'late', 'no-date-a', 'no-date-b', 'done-one']);
  });

  it('offers releases that are not done, plus the current one even when it is done', () => {
    expect(selectableReleases(list, stories, null).map((item) => item.id)).not.toContain('done-one');
    expect(selectableReleases(list, stories, 'done-one').map((item) => item.id)).toContain('done-one');
  });
});

describe('sprint after release end', () => {
  const sprints: Sprint[] = [
    { id: 'p1', name: 'Sprint 1', startDate: '2026-11-02', endDate: '2026-11-15' },
    { id: 'p2', name: 'Sprint 2', startDate: '2026-11-16', endDate: '2026-11-29' }
  ];
  const target = release('r1', '2026-10-05', '2026-11-20');
  const stories = [story('s1', 'r1', { sprintId: 'p1' }), story('s2', 'r1', { sprintId: 'p2' }), story('s3', 'r1'), story('s4', 'r2', { sprintId: 'p2' })];

  it('lists the stories of a release whose sprint ends after the release', () => {
    expect(storiesAfterReleaseEnd(target, stories, sprints).map((item) => item.id)).toEqual(['s2']);
  });

  it('has no hint for a release without an end date', () => {
    expect(storiesAfterReleaseEnd(release('r1'), stories, sprints)).toEqual([]);
  });

  it('names the release and the sprint for one story, and nothing when it fits', () => {
    expect(sprintEndsAfterRelease(stories[1], [target], sprints)?.sprint.name).toBe('Sprint 2');
    expect(sprintEndsAfterRelease(stories[0], [target], sprints)).toBeNull();
    expect(sprintEndsAfterRelease(stories[2], [target], sprints)).toBeNull();
    expect(sprintEndsAfterRelease(stories[3], [target], sprints)).toBeNull();
  });
});
