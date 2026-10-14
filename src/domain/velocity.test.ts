import { describe, expect, it } from 'vitest';
import type { Sprint, SprintResult } from './types';
import { averageVelocity, chartRows, velocityRows, VELOCITY_PAGE } from './velocity';

const result = (planned: number, done: number, extra: Partial<SprintResult> = {}): SprintResult => ({
  completedOn: '2026-01-01',
  plannedPoints: planned,
  plannedStories: 3,
  donePoints: done,
  doneStories: 3,
  notDonePoints: 0,
  notDoneStories: 0,
  addedStories: 0,
  addedPoints: 0,
  removedStories: 0,
  removedPoints: 0,
  changedPoints: 0,
  ...extra
});

const completed = (number: number, planned: number, done: number, extra: Partial<SprintResult> = {}): Sprint => ({
  id: `s${number}`,
  name: `Sprint ${number}`,
  startDate: `2026-${String(number).padStart(2, '0')}-01`,
  endDate: `2026-${String(number).padStart(2, '0')}-14`,
  state: 'completed',
  startItems: [],
  result: result(planned, done, extra)
});

const SIX = [completed(1, 18, 12), completed(2, 22, 19), completed(3, 25, 17), completed(4, 20, 22, { addedStories: 2, addedPoints: 5 }), completed(5, 24, 20), completed(6, 26, 22)];

describe('velocity rows', () => {
  it('AC1.1 lists the completed sprints with planned and done points in sprint order', () => {
    // Given sprints in a mixed order, a running and a planned one among them
    const running: Sprint = { ...completed(7, 0, 0), state: 'running', result: null };
    const planned: Sprint = { ...completed(8, 0, 0), state: 'planned', result: null };
    // When the rows are built
    const rows = velocityRows([SIX[3], planned, SIX[0], running, SIX[2], SIX[1], SIX[5], SIX[4]]);
    // Then only completed sprints remain, oldest first, with their figures
    expect(rows.map((row) => [row.name, row.planned, row.done])).toEqual([
      ['Sprint 1', 18, 12],
      ['Sprint 2', 22, 19],
      ['Sprint 3', 25, 17],
      ['Sprint 4', 20, 22],
      ['Sprint 5', 24, 20],
      ['Sprint 6', 26, 22]
    ]);
  });

  it('AC1.2 keeps done above planned and AC1.5 the points that joined, with the share', () => {
    const row = velocityRows(SIX).find((item) => item.name === 'Sprint 4')!;
    expect(row).toMatchObject({ planned: 20, done: 22, addedStories: 2, addedPoints: 5, share: 110 });
  });

  it('has no share when nothing was planned', () => {
    expect(velocityRows([completed(1, 0, 4)])[0].share).toBeNull();
  });
});

describe('average velocity', () => {
  it('AC2.1 averages the done points of the last three sprints, rounded to whole points (21.33 → 21)', () => {
    expect(averageVelocity(velocityRows(SIX))).toEqual({ points: 21, sprints: 3 });
  });

  it('rounds from 0.5 up', () => {
    expect(averageVelocity(velocityRows([completed(1, 10, 10), completed(2, 10, 11), completed(3, 10, 11)]))).toEqual({ points: 11, sprints: 3 });
    expect(averageVelocity(velocityRows([completed(1, 10, 10), completed(2, 10, 11)]))).toEqual({ points: 11, sprints: 2 });
  });

  it('AC2.2 averages the sprints there are when fewer than three are completed', () => {
    expect(averageVelocity(velocityRows([completed(1, 20, 12), completed(2, 30, 24)]))).toEqual({ points: 18, sprints: 2 });
  });

  it('AC2.3 works with a single sprint', () => {
    expect(averageVelocity(velocityRows([completed(1, 20, 12)]))).toEqual({ points: 12, sprints: 1 });
  });

  it('AC4.1 has no average without a completed sprint', () => {
    expect(averageVelocity([])).toBeNull();
  });
});

describe('chart rows', () => {
  const ten = Array.from({ length: 10 }, (_, index) => completed(index + 1, 20, 20));

  it('AC1.3 shows the last 8 sprints and pages back by 8 more', () => {
    const rows = velocityRows(ten);
    const first = chartRows(rows, 1);
    expect(first.rows.map((row) => row.name)).toEqual(['Sprint 3', 'Sprint 4', 'Sprint 5', 'Sprint 6', 'Sprint 7', 'Sprint 8', 'Sprint 9', 'Sprint 10']);
    expect(first.rows).toHaveLength(VELOCITY_PAGE);
    expect(first.hasOlder).toBe(true);
    const second = chartRows(rows, 2);
    expect(second.rows).toHaveLength(10);
    expect(second.hasOlder).toBe(false);
  });

  it('shows everything without an older page when there are 8 or fewer sprints', () => {
    expect(chartRows(velocityRows(SIX), 1)).toMatchObject({ hasOlder: false });
  });
});
