import type { SyncLogEntry, SyncTrigger } from './types';
import { isEmptySummary, type SyncSummary } from './sync';

/** The log keeps the last 100 entries of the last 90 days (#30). */
export const LOG_MAX_ENTRIES = 100;
export const LOG_MAX_DAYS = 90;

/** How often the automatic sync runs while the app is open, in milliseconds. */
export const AUTO_INTERVAL_MS = 15 * 60 * 1000;

/** Whether a run changed nothing and had no error: such runs are folded in the log. */
export const isQuiet = (entry: Pick<SyncLogEntry, 'error' | 'summary'>): boolean =>
  entry.error === null && entry.summary !== null && isEmptySummary(entry.summary) && entry.summary.pending === 0;

/** The log with a new run at the front. A quiet run after a quiet run joins it; old entries fall out. */
export function appendLog(log: readonly SyncLogEntry[], entry: SyncLogEntry, now: Date): SyncLogEntry[] {
  const [latest, ...older] = log;
  const joined = latest && isQuiet(latest) && isQuiet(entry) ? [{ ...latest, at: entry.at, runs: latest.runs + entry.runs, trigger: entry.trigger }, ...older] : [entry, ...log];
  const oldest = now.getTime() - LOG_MAX_DAYS * 24 * 60 * 60 * 1000;
  return joined.filter((item) => Date.parse(item.at) >= oldest).slice(0, LOG_MAX_ENTRIES);
}

/** An entry of the summary as an earlier version stored it: the issue number instead of the key, and the side "github". */
type StoredEntry = { key?: string; number?: number; side?: string };

const keyOf = (entry: StoredEntry): string => entry.key ?? (entry.number !== undefined ? `#${entry.number}` : '');

/** A summary stored before the generalisation (#66) names issues by `number` and the side of the service `github`; it is read with `key` and `remote`. */
function upgradeSummary(summary: SyncSummary): SyncSummary {
  const upgrade = <T extends object>(entries: readonly T[] | undefined): T[] => (entries ?? []).map((entry) => ({ ...entry, key: keyOf(entry as StoredEntry) }));
  return {
    ...summary,
    created: upgrade(summary.created),
    closed: upgrade(summary.closed),
    updated: upgrade(summary.updated),
    published: upgrade(summary.published),
    overwritten: upgrade(summary.overwritten).map((entry) => ({ ...entry, side: (entry as StoredEntry).side === 'github' ? ('remote' as const) : entry.side })),
    conflicts: upgrade(summary.conflicts),
    multipleEpics: upgrade(summary.multipleEpics)
  };
}

const TRIGGERS: readonly SyncTrigger[] = ['start', 'auto', 'manual'];

/** Log entries from stored data; whatever is not an entry is dropped. */
export function normalizeLog(value: unknown): SyncLogEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: SyncLogEntry[] = [];
  for (const item of value as Array<Partial<SyncLogEntry> | null>) {
    if (!item || typeof item.id !== 'string' || typeof item.at !== 'string' || Number.isNaN(Date.parse(item.at))) continue;
    const trigger = TRIGGERS.find((name) => name === item.trigger) ?? 'manual';
    entries.push({
      id: item.id,
      at: item.at,
      runs: typeof item.runs === 'number' && item.runs >= 1 ? item.runs : 1,
      trigger,
      error: typeof item.error === 'string' ? item.error : null,
      summary: item.summary && typeof item.summary === 'object' ? upgradeSummary(item.summary as SyncSummary) : null
    });
  }
  return entries;
}

export type LogFilter = 'all' | 'changes' | 'errors';

/** The entries a filter of the log shows. */
export function filterLog(log: readonly SyncLogEntry[], filter: LogFilter): SyncLogEntry[] {
  if (filter === 'errors') return log.filter((entry) => entry.error !== null);
  if (filter === 'changes') return log.filter((entry) => !isQuiet(entry));
  return [...log];
}

/** The state of the timer of the automatic sync: when the next run is due, and whether one waits for a quiet moment. */
export interface AutoState {
  nextAt: number;
  due: boolean;
}

export interface AutoContext {
  now: number;
  /** No dialog is open and nobody is typing. */
  idle: boolean;
  online: boolean;
  /** Paused after three errors in a row. */
  paused: boolean;
}

/** One look of the timer: whether a run starts now, and the new state. A run that is due waits for a quiet moment. */
export function autoTick(state: AutoState, context: AutoContext): { run: boolean; state: AutoState } {
  const due = state.due || context.now >= state.nextAt;
  if (!due || context.paused || !context.online || !context.idle) return { run: false, state: { ...state, due } };
  return { run: true, state: { nextAt: context.now + AUTO_INTERVAL_MS, due: false } };
}

/** Errors in a row after which the automatic sync pauses. */
export const AUTO_PAUSE_AFTER = 3;
