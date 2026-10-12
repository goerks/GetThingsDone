import { describe, expect, it } from 'vitest';
import { burndownReport } from './burndown';
import type { Release, ReleaseEvent } from './types';

const release: Release = { id: 'r1', title: 'One', description: '', startDate: '2026-10-05', endDate: '2026-10-15' };
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
  event('2026-10-05', 'baseline', 'a', 5),
  event('2026-10-05', 'baseline', 'b', 3),
  event('2026-10-05', 'baseline', 'c', 2),
  event('2026-10-07', 'done', 'a', 5, true), // 5 points burn down
  event('2026-10-08', 'added', 'd', 8), // the scope grows by 8
  event('2026-10-09', 'removed', 'c', 2), // the scope shrinks by 2
  event('2026-10-10', 'done', 'd', 8, true)
];
const report = burndownReport(release, history, '2026-10-11');
const day = (value: string) => report?.days.find((entry) => entry.day === value);

describe('burndownReport', () => {
  it('is null without a history', () => {
    expect(burndownReport(release, [], '2026-10-11')).toBeNull();
  });

  it('is what is left: scope minus done, per day', () => {
    expect(day('2026-10-05')?.remaining).toEqual({ tickets: 3, points: 10 });
    expect(day('2026-10-07')?.remaining).toEqual({ tickets: 2, points: 5 });
  });

  it('goes up when stories are added and down when they are removed or finished', () => {
    expect(day('2026-10-08')?.remaining).toEqual({ tickets: 3, points: 13 });
    expect(day('2026-10-09')?.remaining).toEqual({ tickets: 2, points: 11 });
    expect(day('2026-10-10')?.remaining).toEqual({ tickets: 1, points: 3 });
  });

  it('knows the numbers of today', () => {
    expect(report?.today).toBe('2026-10-11');
    expect(report?.remaining).toEqual({ tickets: 1, points: 3 });
    expect(report?.done).toEqual({ tickets: 2, points: 13 });
    expect(report?.scope).toEqual({ tickets: 3, points: 16 });
  });

  it('keeps the days after today empty until the end date', () => {
    expect(report?.days[report.days.length - 1].day).toBe('2026-10-15');
    expect(day('2026-10-12')?.remaining).toBeNull();
    expect(day('2026-10-15')?.remaining).toBeNull();
  });

  it('has a target line from what was left on the start day to nothing on the end day', () => {
    expect(report?.idealFrom).toBe('2026-10-05');
    expect(report?.idealTo).toBe('2026-10-15');
    expect(day('2026-10-05')?.ideal).toEqual({ tickets: 3, points: 10 });
    expect(day('2026-10-10')?.ideal).toEqual({ tickets: 1.5, points: 5 });
    expect(day('2026-10-15')?.ideal).toEqual({ tickets: 0, points: 0 });
  });

  it('says how far the release is from the line today', () => {
    // Today 11 Oct: the line is at 4 points and 1.2 tickets, 3 points and 1 ticket are left: slightly ahead.
    expect(report?.againstIdeal?.points).toBeCloseTo(-1);
    expect(report?.againstIdeal?.tickets).toBeCloseTo(-0.2);
  });

  it('has no target line without a start and an end date', () => {
    for (const open of [{ ...release, startDate: null }, { ...release, endDate: null }, { ...release, startDate: null, endDate: null }]) {
      const result = burndownReport(open, history, '2026-10-11');
      expect(result?.idealFrom).toBeNull();
      expect(result?.againstIdeal).toBeNull();
      expect(result?.days.every((entry) => entry.ideal === null)).toBe(true);
    }
  });

  it('runs from the first record to today when there is no end date', () => {
    const open = burndownReport({ ...release, endDate: null }, history, '2026-10-11');
    expect(open?.days[open.days.length - 1].day).toBe('2026-10-11');
  });

  it('starts the line on the first recorded day when the history starts after the start date', () => {
    const late = burndownReport(release, [event('2026-10-09', 'baseline', 'a', 5), event('2026-10-09', 'baseline', 'b', 3)], '2026-10-11');
    expect(late?.recordedSince).toBe('2026-10-09');
    expect(late?.idealFrom).toBe('2026-10-09');
    expect(late?.days[0].ideal).toEqual({ tickets: 2, points: 8 });
  });

  it('has no line when the end date is before the first recorded day', () => {
    const over = burndownReport({ ...release, endDate: '2026-10-06' }, [event('2026-10-09', 'baseline', 'a', 5)], '2026-10-11');
    expect(over?.idealFrom).toBeNull();
    expect(over?.againstIdeal).toBeNull();
  });

  it('shows the change of the scope on the day it happened', () => {
    expect(day('2026-10-08')?.change).toEqual({ tickets: 1, points: 8 });
    expect(day('2026-10-09')?.change).toEqual({ tickets: -1, points: -2 });
    expect(day('2026-10-10')?.change).toEqual({ tickets: 0, points: 0 });
    expect(report?.changes).toHaveLength(2);
  });

  it('is behind when more is left than the line says, and ahead when less', () => {
    const behind = burndownReport(release, [event('2026-10-05', 'baseline', 'a', 10)], '2026-10-12');
    expect(behind?.againstIdeal?.points ?? 0).toBeGreaterThan(0);
    const ahead = burndownReport(release, [event('2026-10-05', 'baseline', 'a', 10), event('2026-10-06', 'done', 'a', 10, true)], '2026-10-12');
    expect(ahead?.againstIdeal?.points ?? 0).toBeLessThan(0);
  });
});
