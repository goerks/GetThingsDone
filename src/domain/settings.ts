import type { MapRows, Settings } from './types';

export const MAP_ROWS: readonly MapRows[] = ['sprints', 'releases'];

export const DEFAULT_SETTINGS: Settings = { mapRows: 'sprints' };

/** Settings from stored data; a missing or unknown value gets its default. */
export function normalizeSettings(stored: Partial<Record<keyof Settings, unknown>> | null | undefined): Settings {
  const mapRows = MAP_ROWS.find((rows) => rows === stored?.mapRows);
  return { mapRows: mapRows ?? DEFAULT_SETTINGS.mapRows };
}
