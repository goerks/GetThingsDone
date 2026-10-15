import { describe, expect, it } from 'vitest';
import { seedSnapshot } from '../data/seed';
import { BACKUP_VERSION, backupFileName, countsOf, parseBackup, serializeBackup } from './backup';

const TODAY = '2026-10-15';
const NOW = '2026-10-15T08:00:00.000Z';

describe('backup file (#16)', () => {
  it('AC1.2 names the file after the day', () => {
    // Given the day of the export
    // When the file name is made
    // Then it is getitdone-<day>.json
    expect(backupFileName(TODAY)).toBe('getitdone-2026-10-15.json');
  });

  it('AC1.3 writes readable text with a format and a version', () => {
    // Given the demo data
    const snapshot = seedSnapshot(TODAY);
    // When it is serialized
    const text = serializeBackup(snapshot, NOW);
    // Then it is indented JSON with the format, the version and the data
    expect(text).toContain('\n  "format": "getitdone-backup"');
    expect(JSON.parse(text)).toMatchObject({ format: 'getitdone-backup', version: BACKUP_VERSION, exportedAt: NOW });
    expect(Object.keys(JSON.parse(text).data)).toEqual(
      expect.arrayContaining(['epics', 'sprints', 'releases', 'events', 'stories', 'statuses', 'fields', 'assignments', 'settings'])
    );
  });

  it('AC1.4 exports an empty project', () => {
    // Given a snapshot without stories and epics
    const empty = { ...seedSnapshot(TODAY), stories: [], epics: [] };
    // When it is serialized and read again
    const parsed = parseBackup(serializeBackup(empty, NOW), TODAY);
    // Then it is valid and counts zero stories and epics
    expect(parsed.ok && parsed.counts).toMatchObject({ stories: 0, epics: 0 });
  });

  it('AC3.2 gives back the same data after a round trip', () => {
    // Given the demo data
    const snapshot = seedSnapshot(TODAY);
    // When it is exported and read again
    const parsed = parseBackup(serializeBackup(snapshot, NOW), TODAY);
    // Then every part is the same, and the counts and the date of the export are known
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.snapshot).toEqual(snapshot);
    expect(parsed.counts).toEqual(countsOf(snapshot));
    expect(parsed.exportedAt).toBe(NOW);
  });

  it('AC4.1 refuses a plain text file', () => {
    // Given a text file
    // When it is read
    // Then it is not an export
    expect(parseBackup('Hallo', TODAY)).toEqual({ ok: false, problem: 'notBackup' });
  });

  it('AC4.2 refuses JSON of another program', () => {
    expect(parseBackup('{"a": 1}', TODAY)).toEqual({ ok: false, problem: 'notBackup' });
    expect(parseBackup('[1, 2]', TODAY)).toEqual({ ok: false, problem: 'notBackup' });
    expect(parseBackup('"text"', TODAY)).toEqual({ ok: false, problem: 'notBackup' });
  });

  it('AC4.3 refuses a file of a newer format and names its version', () => {
    // Given an export with format version 99
    const text = JSON.stringify({ format: 'getitdone-backup', version: 99, exportedAt: NOW, data: {} });
    // When it is read
    // Then it is refused as newer
    expect(parseBackup(text, TODAY)).toEqual({ ok: false, problem: 'newer', version: 99 });
  });

  it('AC4.4 refuses an export that is cut off, and an empty file', () => {
    // Given an export of which the second half is missing
    const text = serializeBackup(seedSnapshot(TODAY), NOW);
    // When it is read
    // Then it is damaged
    expect(parseBackup(text.slice(0, text.length / 2), TODAY)).toMatchObject({ ok: false, problem: 'damaged' });
    // And an empty or blank file is empty
    expect(parseBackup('', TODAY)).toEqual({ ok: false, problem: 'empty' });
    expect(parseBackup(' \n ', TODAY)).toEqual({ ok: false, problem: 'empty' });
  });

  it('AC4.4 refuses data that do not fit', () => {
    const wrap = (data: unknown, version: unknown = 1) => JSON.stringify({ format: 'getitdone-backup', version, exportedAt: NOW, data });
    // Given exports whose data are not a list of stories, a story without a title, or a version that is not a number
    // When they are read
    // Then each is damaged
    expect(parseBackup(wrap(null), TODAY)).toMatchObject({ ok: false, problem: 'damaged' });
    expect(parseBackup(wrap({ epics: [], stories: 'x' }), TODAY)).toMatchObject({ ok: false, problem: 'damaged' });
    expect(parseBackup(wrap({ epics: [], stories: [{ id: 's1' }] }), TODAY)).toMatchObject({ ok: false, problem: 'damaged' });
    expect(parseBackup(wrap({ epics: [], stories: [] }, 'one'), TODAY)).toMatchObject({ ok: false, problem: 'damaged' });
  });

  it('AC3.1 reads an older file without parts that were added later', () => {
    // Given an export that has only epics and stories
    const text = JSON.stringify({ format: 'getitdone-backup', version: 1, exportedAt: NOW, data: { epics: [], stories: [] } });
    // When it is read
    const parsed = parseBackup(text, TODAY);
    // Then the missing parts get their defaults
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.snapshot.statuses.length).toBeGreaterThan(0);
  });
});
