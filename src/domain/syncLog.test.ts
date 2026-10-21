import { describe, expect, it } from 'vitest';
import { emptySummary } from './github';
import { AUTO_INTERVAL_MS, LOG_MAX_ENTRIES, appendLog, autoTick, filterLog, normalizeLog } from './syncLog';
import type { SyncLogEntry } from './types';

const NOW = new Date('2026-10-21T10:00:00.000Z');

const quiet = (id: string, at = NOW.toISOString()): SyncLogEntry => ({ id, at, runs: 1, trigger: 'auto', error: null, summary: emptySummary() });
const changed = (id: string, at = NOW.toISOString()): SyncLogEntry => ({ id, at, runs: 1, trigger: 'manual', error: null, summary: { ...emptySummary(), updated: [{ storyId: 's1', number: 31, code: 'G-31', title: 'Login', changes: [{ kind: 'title', from: 'a', to: 'b' }] }] } });
const failed = (id: string): SyncLogEntry => ({ id, at: NOW.toISOString(), runs: 1, trigger: 'auto', error: 'network', summary: null });

describe('the timer of the automatic sync', () => {
  const state = { nextAt: 1000 + AUTO_INTERVAL_MS, due: false };
  const ready = { idle: true, online: true, paused: false };

  it('AC18.3 is due after 15 minutes', () => {
    // Given a run at second 1
    // When less than 15 minutes have passed
    expect(autoTick(state, { ...ready, now: 1000 + AUTO_INTERVAL_MS - 1 }).run).toBe(false);
    // Then nothing runs; at 15 minutes a run starts and the next one is 15 minutes later
    const result = autoTick(state, { ...ready, now: 1000 + AUTO_INTERVAL_MS });
    expect(result.run).toBe(true);
    expect(result.state).toEqual({ nextAt: 1000 + 2 * AUTO_INTERVAL_MS, due: false });
  });

  it('AC18.5 waits while a dialog is open or someone types, and while offline', () => {
    const due = { nextAt: 0, due: true };
    // Given a run that is due
    for (const blocked of [{ idle: false }, { online: false }, { paused: true }]) {
      // When the PO is typing, the network is gone or the sync paused, Then it waits and stays due
      const result = autoTick(due, { now: 5000, ...ready, ...blocked });
      expect(result.run).toBe(false);
      expect(result.state.due).toBe(true);
    }
    // And when the moment is quiet, it runs
    expect(autoTick(due, { now: 5000, ...ready }).run).toBe(true);
  });
});

describe('the sync log', () => {
  it('AC20.3 folds runs without changes and filters the log', () => {
    // Given three quiet runs after a run with changes
    let log = appendLog([], changed('a'), NOW);
    for (const id of ['b', 'c', 'd']) log = appendLog(log, quiet(id), NOW);
    // Then the quiet runs are one entry that counts them
    expect(log.map((entry) => [entry.id, entry.runs])).toEqual([['b', 3], ['a', 1]]);
    // And an error is its own entry and ends the folding
    log = appendLog(log, failed('e'), NOW);
    log = appendLog(log, quiet('f'), NOW);
    expect(log.map((entry) => entry.id)).toEqual(['f', 'e', 'b', 'a']);
    // And the filters show what they say
    expect(filterLog(log, 'errors').map((entry) => entry.id)).toEqual(['e']);
    expect(filterLog(log, 'changes').map((entry) => entry.id)).toEqual(['e', 'a']);
    expect(filterLog(log, 'all')).toHaveLength(4);
  });

  it('AC20.4 keeps at most 100 runs of 90 days', () => {
    // Given 105 runs with changes
    let log: SyncLogEntry[] = [];
    for (let index = 0; index < 105; index += 1) log = appendLog(log, changed(`run-${index}`), NOW);
    // Then only the newest 100 stay
    expect(log).toHaveLength(LOG_MAX_ENTRIES);
    expect(log[0].id).toBe('run-104');
    // And a run older than 90 days falls out
    const old = changed('old', '2026-07-01T10:00:00.000Z');
    expect(appendLog([old], changed('new'), NOW).map((entry) => entry.id)).toEqual(['new']);
    // And stored data that is not a log gives an empty one
    expect(normalizeLog('nonsense')).toEqual([]);
    expect(normalizeLog([{ id: 'x', at: NOW.toISOString(), trigger: 'start', summary: null }, { nope: true }]).map((entry) => [entry.id, entry.runs, entry.trigger])).toEqual([['x', 1, 'start']]);
  });
});
