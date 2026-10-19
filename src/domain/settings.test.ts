import { describe, expect, it } from 'vitest';
import { EMPTY_DEFINITIONS } from './definitions';
import { migrateSnapshot } from './migrate';
import { DEFAULT_SETTINGS, normalizeSettings } from './settings';

describe('settings', () => {
  it('shows sprints as the rows of the story map by default', () => {
    expect(DEFAULT_SETTINGS).toEqual({ mapRows: 'sprints', features: { releases: true, team: false, github: false }, github: { repo: '', lastSyncAt: null, write: false, conflict: 'remote', ignored: [] }, definitions: EMPTY_DEFINITIONS });
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps a known choice and replaces an unknown one', () => {
    expect(normalizeSettings({ mapRows: 'releases' })).toEqual({ mapRows: 'releases', features: { releases: true, team: false, github: false }, github: { repo: '', lastSyncAt: null, write: false, conflict: 'remote', ignored: [] }, definitions: EMPTY_DEFINITIONS });
    expect(normalizeSettings({ mapRows: 'weeks' })).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ mapRows: 3 })).toEqual(DEFAULT_SETTINGS);
  });

  it('gives data of earlier versions the default and keeps stored settings', () => {
    expect(migrateSnapshot({}, '2026-10-12').settings).toEqual(DEFAULT_SETTINGS);
    expect(migrateSnapshot({ settings: { mapRows: 'releases', features: { releases: true, team: false, github: false }, github: { repo: '', lastSyncAt: null, write: false, conflict: 'remote', ignored: [] }, definitions: EMPTY_DEFINITIONS } }, '2026-10-12').settings).toEqual({ mapRows: 'releases', features: { releases: true, team: false, github: false }, github: { repo: '', lastSyncAt: null, write: false, conflict: 'remote', ignored: [] }, definitions: EMPTY_DEFINITIONS });
  });
});
