import { describe, expect, it } from 'vitest';
import { migrateSnapshot } from './migrate';
import { DEFAULT_SETTINGS, normalizeSettings } from './settings';

describe('settings', () => {
  it('shows sprints as the rows of the story map by default', () => {
    expect(DEFAULT_SETTINGS).toEqual({ mapRows: 'sprints', features: { releases: true, github: false }, github: { repo: '', lastSyncAt: null } });
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps a known choice and replaces an unknown one', () => {
    expect(normalizeSettings({ mapRows: 'releases' })).toEqual({ mapRows: 'releases', features: { releases: true, github: false }, github: { repo: '', lastSyncAt: null } });
    expect(normalizeSettings({ mapRows: 'weeks' })).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ mapRows: 3 })).toEqual(DEFAULT_SETTINGS);
  });

  it('gives data of earlier versions the default and keeps stored settings', () => {
    expect(migrateSnapshot({}, '2026-10-12').settings).toEqual(DEFAULT_SETTINGS);
    expect(migrateSnapshot({ settings: { mapRows: 'releases', features: { releases: true, github: false }, github: { repo: '', lastSyncAt: null } } }, '2026-10-12').settings).toEqual({ mapRows: 'releases', features: { releases: true, github: false }, github: { repo: '', lastSyncAt: null } });
  });
});
