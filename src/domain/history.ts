import { addDays, todayIso } from './sprints';
import type { IsDone } from './statuses';
import type { Release, ReleaseEvent, ReleaseEventKind, Story } from './types';
import { storyKey } from './storyKey';

/** The local calendar day (`YYYY-MM-DD`) of a timestamp. */
export const dayOf = (at: string): string => todayIso(new Date(at));

/**
 * The history entries a change of the stories causes. Only stories in a release matter: joining or leaving one
 * (also by moving to another release or by deleting the story), a change of the points and a change into or out
 * of done while the story is in a release. `wasDone` and `isDone` tell what done means before and after the change;
 * they differ when a status value moves to another category (#5), which changes done without changing the story.
 */
export function releaseEventsFor(
  before: readonly Story[],
  after: readonly Story[],
  at: string,
  newId: () => string,
  isDone: IsDone,
  wasDone: IsDone = isDone
): ReleaseEvent[] {
  const events: ReleaseEvent[] = [];
  const entry = (story: Story, kind: ReleaseEventKind, releaseId: string, done: IsDone = isDone): void => {
    events.push({ id: newId(), at, releaseId, storyId: story.id, code: storyKey(story), kind, points: story.points, done: done(story) });
  };
  const previous = new Map(before.map((story) => [story.id, story]));
  for (const story of after) {
    const old = previous.get(story.id);
    previous.delete(story.id);
    if (old?.releaseId !== story.releaseId) {
      if (old?.releaseId) entry(old, 'removed', old.releaseId, wasDone);
      if (story.releaseId) entry(story, 'added', story.releaseId);
    } else if (old && story.releaseId) {
      if (old.points !== story.points) entry(story, 'points', story.releaseId);
      if (wasDone(old) !== isDone(story)) entry(story, isDone(story) ? 'done' : 'reopened', story.releaseId);
    }
  }
  // What is left was deleted.
  for (const gone of previous.values()) if (gone.releaseId) entry(gone, 'removed', gone.releaseId, wasDone);
  return events;
}

/**
 * A release that has stories but no history yet starts its history now: every story is recorded as part of the
 * baseline, so the report starts with the state at the first record and invents nothing before it.
 */
export function baselineEvents(
  releases: readonly Release[],
  stories: readonly Story[],
  events: readonly ReleaseEvent[],
  at: string,
  newId: () => string,
  isDone: IsDone
): ReleaseEvent[] {
  const tracked = new Set(events.map((event) => event.releaseId));
  return releases
    .filter((release) => !tracked.has(release.id))
    .flatMap((release) =>
      stories
        .filter((story) => story.releaseId === release.id)
        .map((story): ReleaseEvent => ({ id: newId(), at, releaseId: release.id, storyId: story.id, code: storyKey(story), kind: 'baseline', points: story.points, done: isDone(story) }))
    );
}

export interface Amount {
  tickets: number;
  points: number;
}

export interface ScopeDay {
  day: string;
  /** Scope at the end of the day. */
  scope: Amount;
  done: Amount;
  /** Net change of the scope on that day (only changes after the start count). */
  change: Amount;
}

/** One change of the scope after the start: a story added or removed, or a change of its points. */
export interface ScopeChange {
  at: string;
  day: string;
  storyId: string;
  code: string;
  kind: 'added' | 'removed' | 'points';
  /** Signed: +1 ticket for added, -1 for removed, 0 for a change of points. */
  tickets: number;
  /** Signed: the points added, the points removed, or the difference. */
  points: number;
  /** For `points`: the points before and after. */
  pointsFrom: number;
  pointsTo: number;
}

export interface ScopeReport {
  /** The first day of the history; the report knows nothing about the time before. */
  recordedSince: string;
  /** Changes of the scope count after this day: the start day of the release, or the first day of the history. */
  changesAfter: string;
  start: Amount;
  increase: Amount;
  decrease: Amount;
  now: Amount;
  nowDone: Amount;
  days: ScopeDay[];
  changes: ScopeChange[];
}

const affectsScope = (kind: ReleaseEventKind): boolean => kind === 'baseline' || kind === 'added' || kind === 'removed' || kind === 'points';

interface Member {
  points: number;
  done: boolean;
}

function totals(members: Map<string, Member>): { scope: Amount; done: Amount } {
  const scope: Amount = { tickets: members.size, points: 0 };
  const done: Amount = { tickets: 0, points: 0 };
  for (const member of members.values()) {
    scope.points += member.points;
    if (member.done) {
      done.tickets += 1;
      done.points += member.points;
    }
  }
  return { scope, done };
}

/** The history of one release in order; ties keep the order they were recorded in. */
export function eventsOfRelease(events: readonly ReleaseEvent[], releaseId: string): ReleaseEvent[] {
  return events
    .map((event, index) => ({ event, index }))
    .filter((entry) => entry.event.releaseId === releaseId)
    .sort((a, b) => a.event.at.localeCompare(b.event.at) || a.index - b.index)
    .map((entry) => entry.event);
}

/**
 * The scope of a release over time, computed from its history (calendar days, up to `today`). Null when there is
 * no history yet. The start is the state of the release on its start day (or, without one, on the first day of
 * the history); a story added or removed after that day is an increase or a decrease, a change of points counts as
 * the difference, a change of status never changes the scope. What happened before the first entry is not known.
 */
export function scopeReport(release: Release, allEvents: readonly ReleaseEvent[], today: string): ScopeReport | null {
  const events = eventsOfRelease(allEvents, release.id);
  if (events.length === 0) return null;
  const recordedSince = dayOf(events[0].at);
  const changesAfter = release.startDate ?? recordedSince;
  const isChange = (event: ReleaseEvent): boolean => event.kind !== 'baseline' && affectsScope(event.kind) && dayOf(event.at) > changesAfter;

  const members = new Map<string, Member>();
  const changes: ScopeChange[] = [];
  let start: Amount = { tickets: 0, points: 0 };
  const startMembers = new Map<string, Member>();
  const apply = (target: Map<string, Member>, event: ReleaseEvent): Member | undefined => {
    const before = target.get(event.storyId);
    switch (event.kind) {
      case 'baseline':
      case 'added':
        target.set(event.storyId, { points: event.points, done: event.done });
        break;
      case 'removed':
        target.delete(event.storyId);
        break;
      case 'points':
        if (before) target.set(event.storyId, { ...before, points: event.points });
        break;
      case 'done':
      case 'reopened':
        if (before) target.set(event.storyId, { ...before, done: event.kind === 'done' });
        break;
    }
    return before;
  };

  const lastDay = today < recordedSince ? recordedSince : today;
  const days: ScopeDay[] = [];
  const byDay = new Map<string, ReleaseEvent[]>();
  for (const event of events) byDay.set(dayOf(event.at), [...(byDay.get(dayOf(event.at)) ?? []), event]);

  for (let day = recordedSince; day <= lastDay; day = addDays(day, 1)) {
    const change: Amount = { tickets: 0, points: 0 };
    for (const event of byDay.get(day) ?? []) {
      const before = apply(members, event);
      if (affectsScope(event.kind) && !isChange(event)) apply(startMembers, event);
      if (!isChange(event)) continue;
      const entry: ScopeChange = { at: event.at, day, storyId: event.storyId, code: event.code, kind: event.kind as ScopeChange['kind'], tickets: 0, points: 0, pointsFrom: before?.points ?? event.points, pointsTo: event.points };
      if (event.kind === 'added') {
        entry.tickets = 1;
        entry.points = event.points;
      } else if (event.kind === 'removed') {
        entry.tickets = -1;
        entry.points = -(before?.points ?? event.points);
        entry.pointsFrom = before?.points ?? event.points;
        entry.pointsTo = 0;
      } else {
        entry.points = event.points - (before?.points ?? event.points);
      }
      changes.push(entry);
      change.tickets += entry.tickets;
      change.points += entry.points;
    }
    days.push({ day, ...totals(members), change });
  }
  start = totals(startMembers).scope;

  const increase: Amount = { tickets: 0, points: 0 };
  const decrease: Amount = { tickets: 0, points: 0 };
  for (const change of changes) {
    if (change.tickets > 0) increase.tickets += change.tickets;
    if (change.tickets < 0) decrease.tickets -= change.tickets;
    if (change.points > 0) increase.points += change.points;
    if (change.points < 0) decrease.points -= change.points;
  }
  const last = days[days.length - 1];
  return { recordedSince, changesAfter, start, increase, decrease, now: last.scope, nowDone: last.done, days, changes };
}

/** The net change of the scope since the start, for the release card. */
export function netChange(report: ScopeReport): Amount {
  return { tickets: report.increase.tickets - report.decrease.tickets, points: report.increase.points - report.decrease.points };
}
