import type { MapRows, Settings } from './types';

export const MAP_ROWS: readonly MapRows[] = ['sprints', 'releases'];

export const DEFAULT_SETTINGS: Settings = { mapRows: 'sprints', releasesEnabled: true };

/** Settings from stored data; a missing or unknown value gets its default. */
export function normalizeSettings(stored: Partial<Record<keyof Settings, unknown>> | null | undefined): Settings {
  const mapRows = MAP_ROWS.find((rows) => rows === stored?.mapRows);
  const enabled = stored?.releasesEnabled;
  return {
    mapRows: mapRows ?? DEFAULT_SETTINGS.mapRows,
    releasesEnabled: enabled === false || enabled === 'false' || enabled === '0' ? false : DEFAULT_SETTINGS.releasesEnabled
  };
}

/** What the rows of the story map really are: releases only while releases are switched on. */
export function effectiveMapRows(settings: Settings): MapRows {
  return settings.releasesEnabled ? settings.mapRows : 'sprints';
}
