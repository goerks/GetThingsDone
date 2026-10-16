import { migrateSnapshot } from './migrate';
import type { Snapshot } from './types';

/** Marks a file as an export of Get It Done (#16). */
export const BACKUP_FORMAT = 'getitdone-backup';
/**
 * Version of the file format. Raise it when an export can no longer be read by an older app. A newer app still reads
 * older files: `parseBackup` brings their data to the current shape (see `migrateSnapshot`).
 */
export const BACKUP_VERSION = 1;

/** The export file: a readable JSON document with the whole snapshot under `data`. */
export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  data: Snapshot;
}

/** How many of each kind of item a snapshot holds, for the messages and the confirmation. */
export interface BackupCounts {
  stories: number;
  epics: number;
  sprints: number;
  releases: number;
}

export function countsOf(snapshot: Pick<Snapshot, 'stories' | 'epics' | 'sprints' | 'releases'>): BackupCounts {
  return { stories: snapshot.stories.length, epics: snapshot.epics.length, sprints: snapshot.sprints.length, releases: snapshot.releases.length };
}

/** `getitdone-2026-10-15.json` for the given day. */
export function backupFileName(today: string): string {
  return `getitdone-${today}.json`;
}

export function serializeBackup(snapshot: Snapshot, exportedAt: string): string {
  const file: BackupFile = { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt, data: snapshot };
  return JSON.stringify(file, null, 2);
}

/** Why a file cannot be imported. */
export type BackupProblem =
  /** No content. */
  | 'empty'
  /** Not an export of Get It Done: another kind of file, or JSON of another program. */
  | 'notBackup'
  /** An export of Get It Done that is cut off or whose data do not fit. */
  | 'damaged'
  /** Written by a newer version of the app, which this one cannot read. */
  | 'newer';

export type ParsedBackup =
  | { ok: true; snapshot: Snapshot; exportedAt: string | null; counts: BackupCounts }
  | { ok: false; problem: BackupProblem; version?: number };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string';
const records = (value: unknown, keys: readonly string[]): boolean =>
  Array.isArray(value) && value.every((item) => isRecord(item) && keys.every((key) => isText(item[key])));

/** Checks the shape of what the import would store, so a broken file never reaches the storage. */
function dataFits(data: Record<string, unknown>): boolean {
  const optionalList = (key: string, keys: readonly string[]): boolean => data[key] === undefined || records(data[key], keys);
  if (!records(data.stories, ['id', 'title', 'status']) || !records(data.epics, ['id', 'name'])) return false;
  const storiesFit = (data.stories as Record<string, unknown>[]).every(
    (story) => story.criteria === undefined || records(story.criteria, ['id', 'text'])
  );
  return (
    storiesFit &&
    optionalList('sprints', ['id', 'name', 'startDate', 'endDate']) &&
    optionalList('releases', ['id', 'title']) &&
    optionalList('events', ['id']) &&
    optionalList('changeLog', ['id', 'itemType', 'itemId', 'at']) &&
    optionalList('statuses', ['id']) &&
    optionalList('fields', ['id']) &&
    optionalList('assignments', []) &&
    (data.settings === undefined || isRecord(data.settings))
  );
}

/**
 * Reads the text of an export file. Gives the snapshot in the current shape, or the reason why the file cannot be
 * imported. Nothing is stored here.
 */
export function parseBackup(text: string, today: string): ParsedBackup {
  const trimmed = text.replace(/^﻿/, '').trim();
  if (trimmed === '') return { ok: false, problem: 'empty' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // A file that starts like JSON but stops in the middle is probably an export that was cut off.
    return { ok: false, problem: trimmed.startsWith('{') && trimmed.includes(BACKUP_FORMAT) ? 'damaged' : 'notBackup' };
  }
  if (!isRecord(parsed) || parsed.format !== BACKUP_FORMAT) return { ok: false, problem: 'notBackup' };
  const version = parsed.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return { ok: false, problem: 'damaged' };
  if (version > BACKUP_VERSION) return { ok: false, problem: 'newer', version };
  if (!isRecord(parsed.data) || !dataFits(parsed.data)) return { ok: false, problem: 'damaged', version };
  try {
    const snapshot = migrateSnapshot(parsed.data as Parameters<typeof migrateSnapshot>[0], today);
    return { ok: true, snapshot, exportedAt: isText(parsed.exportedAt) ? parsed.exportedAt : null, counts: countsOf(snapshot) };
  } catch {
    return { ok: false, problem: 'damaged', version };
  }
}
