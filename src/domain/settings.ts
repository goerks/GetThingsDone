import type { FeatureKey, Features, MapRows, Settings } from './types';

export const MAP_ROWS: readonly MapRows[] = ['sprints', 'releases'];

/** The features with a toggle, in the order of the settings page. Every feature is on until the team switches it off. */
export const FEATURE_KEYS: readonly FeatureKey[] = ['releases'];

export const DEFAULT_FEATURES: Features = { releases: true };

export const DEFAULT_SETTINGS: Settings = { mapRows: 'sprints', features: DEFAULT_FEATURES };

const isOff = (value: unknown): boolean => value === false || value === 'false' || value === '0';

/** Settings from stored data; a missing or unknown value gets its default. */
export function normalizeSettings(stored: { mapRows?: unknown; features?: Partial<Record<FeatureKey, unknown>> | null } | null | undefined): Settings {
  const mapRows = MAP_ROWS.find((rows) => rows === stored?.mapRows);
  const features = { ...DEFAULT_FEATURES };
  for (const key of FEATURE_KEYS) if (isOff(stored?.features?.[key])) features[key] = false;
  return { mapRows: mapRows ?? DEFAULT_SETTINGS.mapRows, features };
}

/** Whether a feature is switched on. */
export function featureOn(settings: Settings, key: FeatureKey): boolean {
  return settings.features[key];
}

/** What the rows of the story map really are: releases only while the releases feature is on. */
export function effectiveMapRows(settings: Settings): MapRows {
  return featureOn(settings, 'releases') ? settings.mapRows : 'sprints';
}
