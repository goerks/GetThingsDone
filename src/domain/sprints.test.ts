import { describe, expect, it } from 'vitest';
import {
  addDays,
  createSprint,
  isValidDay,
  mapSprints,
  moveSprint,
  newSprintDefaults,
  runningSprint,
  sortSprints,
  todayIso,
  updateSprint,
  validateSprint
} from './sprints';
import type { Sprint } from './types';

const sprint = (id: string, startDate: string, endDate: string, name = id): Sprint => ({ id, name, startDate, endDate });
const past = sprint('past', '2026-09-21', '2026-10-04', 'Sprint 1');
const now = sprint('now', '2026-10-05', '2026-10-18', 'Sprint 2');
const next = sprint('next', '2026-10-19', '2026-11-01', 'Sprint 3');
const nameFor = (number: number): string => `Sprint ${number}`;

describe('calendar days', () => {
  it('adds days across months and years', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-25', 13)).toBe('2027-01-07');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('formats today as a local calendar day', () => {
    expect(todayIso(new Date(2026, 9, 11, 23, 30))).toBe('2026-10-11');
  });

  it('validates days', () => {
    expect(isValidDay('2026-10-11')).toBe(true);
    expect(isValidDay('2026-02-30')).toBe(false);
    expect(isValidDay('11.10.2026')).toBe(false);
  });
});

describe('running sprint', () => {
  it('is the sprint whose dates include today, including the first and last day', () => {
    expect(runningSprint([next, now, past], '2026-10-11')?.id).toBe('now');
    expect(runningSprint([next, now, past], '2026-10-05')?.id).toBe('now');
    expect(runningSprint([next, now, past], '2026-10-18')?.id).toBe('now');
  });

  it('is the next upcoming sprint when none runs', () => {
    expect(runningSprint([next, past], '2026-10-11')?.id).toBe('next');
  });

  it('is the last sprint when all are over', () => {
    expect(runningSprint([past, now], '2026-12-01')?.id).toBe('now');
  });

  it('is null without sprints', () => {
    expect(runningSprint([], '2026-10-11')).toBeNull();
  });
});

describe('sprints on the map', () => {
  it('sorts by start date', () => {
    expect(sortSprints([next, past, now]).map((s) => s.id)).toEqual(['past', 'now', 'next']);
  });

  it('leaves out sprints that ended before today', () => {
    expect(mapSprints([next, past, now], '2026-10-11').map((s) => s.id)).toEqual(['now', 'next']);
    expect(mapSprints([next, past, now], '2026-10-04').map((s) => s.id)).toEqual(['past', 'now', 'next']);
  });
});

describe('new sprint', () => {
  it('follows the last sprint for two weeks with the next number', () => {
    expect(newSprintDefaults([past, now, next], '2026-10-11', nameFor)).toEqual({
      name: 'Sprint 4',
      startDate: '2026-11-02',
      endDate: '2026-11-15'
    });
  });

  it('starts today when there is no sprint or the last one is over', () => {
    expect(newSprintDefaults([], '2026-10-11', nameFor)).toEqual({
      name: 'Sprint 1',
      startDate: '2026-10-11',
      endDate: '2026-10-24'
    });
    expect(newSprintDefaults([past], '2026-10-11', nameFor).startDate).toBe('2026-10-11');
  });

  it('validates name and dates', () => {
    expect(validateSprint({ name: ' ', startDate: '2026-10-01', endDate: '2026-10-02' })).toBe('name');
    expect(validateSprint({ name: 'S', startDate: '2026-10-02', endDate: '2026-10-01' })).toBe('dates');
    expect(validateSprint({ name: 'S', startDate: '', endDate: '2026-10-01' })).toBe('dates');
    expect(validateSprint({ name: 'S', startDate: '2026-10-01', endDate: '2026-10-01' })).toBeNull();
  });

  it('creates a sprint with a trimmed name and refuses invalid input', () => {
    const result = createSprint([now], { name: ' Sprint 3 ', startDate: '2026-10-19', endDate: '2026-11-01' }, 'id');
    expect(result?.sprint).toEqual({ id: 'id', name: 'Sprint 3', startDate: '2026-10-19', endDate: '2026-11-01' });
    expect(result?.sprints).toHaveLength(2);
    expect(createSprint([now], { name: '', startDate: '2026-10-19', endDate: '2026-11-01' }, 'id')).toBeNull();
  });

  it('updates a sprint and ignores invalid input', () => {
    const changed = updateSprint([now], 'now', { name: 'Kick-off', startDate: '2026-10-06', endDate: '2026-10-19' });
    expect(changed[0]).toEqual({ id: 'now', name: 'Kick-off', startDate: '2026-10-06', endDate: '2026-10-19' });
    const list = [now];
    expect(updateSprint(list, 'now', { name: 'x', startDate: '2026-10-19', endDate: '2026-10-06' })).toBe(list);
  });
});

describe('reordering upcoming sprints', () => {
  // today 2026-10-11: "now" runs until 10-18; next, later and last are upcoming.
  const later = sprint('later', '2026-11-02', '2026-11-08', 'Sprint 4'); // one week
  const last = sprint('last', '2026-11-09', '2026-11-22', 'Sprint 5');
  const all = [past, now, next, later, last];
  const dates = (list: Sprint[]): Array<[string, string, string]> =>
    sortSprints(list).map((s) => [s.id, s.startDate, s.endDate]);

  it('moves a sprint up and recalculates dates without gaps, each sprint keeping its length', () => {
    expect(dates(moveSprint(all, '2026-10-11', 'last', 'next', 'before'))).toEqual([
      ['past', '2026-09-21', '2026-10-04'],
      ['now', '2026-10-05', '2026-10-18'],
      ['last', '2026-10-19', '2026-11-01'],
      ['next', '2026-11-02', '2026-11-15'],
      ['later', '2026-11-16', '2026-11-22']
    ]);
  });

  it('moves a sprint down', () => {
    expect(dates(moveSprint(all, '2026-10-11', 'next', 'later', 'after')).map(([id]) => id)).toEqual([
      'past',
      'now',
      'later',
      'next',
      'last'
    ]);
  });

  it('closes a gap after the running sprint', () => {
    const gap = [now, sprint('far', '2026-12-01', '2026-12-14')];
    const other = sprint('other', '2027-01-01', '2027-01-14');
    expect(dates(moveSprint([...gap, other], '2026-10-11', 'other', 'far', 'before'))).toEqual([
      ['now', '2026-10-05', '2026-10-18'],
      ['other', '2026-10-19', '2026-11-01'],
      ['far', '2026-11-02', '2026-11-15']
    ]);
  });

  it('never moves the running sprint or a sprint above it', () => {
    expect(moveSprint(all, '2026-10-11', 'now', 'last', 'after')).toBe(all);
    expect(moveSprint(all, '2026-10-11', 'last', 'now', 'before')).toBe(all);
    expect(moveSprint(all, '2026-10-11', 'last', 'past', 'before')).toBe(all);
  });

  it('returns the same list when nothing changes', () => {
    expect(moveSprint(all, '2026-10-11', 'next', 'later', 'before')).toBe(all);
    expect(moveSprint(all, '2026-10-11', 'next', 'next', 'after')).toBe(all);
  });
});
