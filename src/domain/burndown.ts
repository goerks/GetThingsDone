import { scopeReport, type Amount, type ScopeChange } from './history';
import { addDays } from './sprints';
import type { Release, ReleaseEvent } from './types';

export interface BurndownDay {
  day: string;
  /** What is left at the end of the day (scope minus done); null for a day that has not happened yet. */
  remaining: Amount | null;
  /** The target line on that day; null outside the line or when the release has no start and end date. */
  ideal: Amount | null;
  /** Net change of the scope on that day. */
  change: Amount;
}

export interface BurndownReport {
  recordedSince: string;
  today: string;
  days: BurndownDay[];
  /** Where the target line starts and ends: the start day (or the first recorded day) and the end day. Null without one. */
  idealFrom: string | null;
  idealTo: string | null;
  remaining: Amount;
  done: Amount;
  scope: Amount;
  /** What is left now minus the target line today; above zero is behind, below is ahead. Null without a line today. */
  againstIdeal: Amount | null;
  changes: ScopeChange[];
}

const minus = (a: Amount, b: Amount): Amount => ({ tickets: a.tickets - b.tickets, points: a.points - b.points });

/**
 * What is left of a release over time (scope minus done, per calendar day up to today), computed from its history
 * like the scope report: a story added raises it, a story removed or finished lowers it. With a start and an end
 * date the target line runs straight from what was left on the start day (or on the first recorded day, when the
 * history starts later) to nothing on the end day. Without both there is no line. Null without a history.
 */
export function burndownReport(release: Release, events: readonly ReleaseEvent[], today: string): BurndownReport | null {
  const scope = scopeReport(release, events, today);
  if (!scope) return null;
  const { startDate, endDate } = release;
  const lastDay = endDate && endDate > today ? endDate : today;
  const first = scope.recordedSince;
  const lastRecorded = scope.days[scope.days.length - 1].day;

  const left = (index: number): Amount => minus(scope.days[index].scope, scope.days[index].done);
  const idealFrom = startDate && endDate ? (startDate < first ? first : startDate) : null;
  const fromIndex = idealFrom ? scope.days.findIndex((day) => day.day === idealFrom) : -1;
  const line = idealFrom && endDate && fromIndex >= 0 && endDate > idealFrom ? { from: fromIndex, startLeft: left(fromIndex) } : null;

  const days: BurndownDay[] = [];
  let toIndex = -1;
  for (let day = first, index = 0; day <= lastDay; day = addDays(day, 1), index += 1) {
    if (endDate && day === endDate) toIndex = index;
    days.push({ day, remaining: null, ideal: null, change: { tickets: 0, points: 0 } });
  }
  scope.days.forEach((entry, index) => {
    days[index].remaining = left(index);
    days[index].change = entry.change;
  });
  if (line && toIndex > line.from) {
    for (let index = line.from; index <= toIndex; index += 1) {
      const share = (toIndex - index) / (toIndex - line.from);
      days[index].ideal = { tickets: line.startLeft.tickets * share, points: line.startLeft.points * share };
    }
  }

  const nowIndex = days.findIndex((day) => day.day === lastRecorded);
  const targetToday = days[nowIndex].ideal;
  const remaining = days[nowIndex].remaining ?? { tickets: 0, points: 0 };
  return {
    recordedSince: first,
    today: lastRecorded,
    days,
    idealFrom: line && toIndex > line.from ? days[line.from].day : null,
    idealTo: line && toIndex > line.from ? days[toIndex].day : null,
    remaining,
    done: scope.nowDone,
    scope: scope.now,
    againstIdeal: targetToday ? minus(remaining, targetToday) : null,
    changes: scope.changes
  };
}
