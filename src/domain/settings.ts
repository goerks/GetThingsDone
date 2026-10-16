import { EMPTY_DEFINITIONS, normalizeDefinitions } from './definitions';
import type { FeatureKey, Features, MapRows, Settings } from './types';

export const MAP_ROWS: readonly MapRows[] = ['sprints', 'releases'];

/** The features with a toggle, in the order of the settings page. */
export const FEATURE_KEYS: readonly FeatureKey[] = ['releases', 'team'];

/** Releases are on until the team switches them off; the team (#18) is off until the team switches it on. The demo data switch it on. */
export const DEFAULT_FEATURES: Features = { releases: true, team: false };

export const DEFAULT_SETTINGS: Settings = { mapRows: 'sprints', features: DEFAULT_FEATURES, definitions: EMPTY_DEFINITIONS };

const isOff = (value: unknown): boolean => value === false || value === 'false' || value === '0';
const isOn = (value: unknown): boolean => value === true || value === 'true' || value === '1';

/** Settings from stored data; a missing or unknown value gets its default. */
export function normalizeSettings(stored: { mapRows?: unknown; features?: Partial<Record<FeatureKey, unknown>> | null; definitions?: unknown } | null | undefined): Settings {
  const mapRows = MAP_ROWS.find((rows) => rows === stored?.mapRows);
  const features = { ...DEFAULT_FEATURES };
  for (const key of FEATURE_KEYS) {
    const value = stored?.features?.[key];
    // A missing or unknown value gives the default of the feature.
    if (DEFAULT_FEATURES[key] ? isOff(value) : isOn(value)) features[key] = !DEFAULT_FEATURES[key];
  }
  return { mapRows: mapRows ?? DEFAULT_SETTINGS.mapRows, features, definitions: normalizeDefinitions(stored?.definitions) };
}

/** Whether a feature is switched on. */
export function featureOn(settings: Settings, key: FeatureKey): boolean {
  return settings.features[key];
}

/** What the rows of the story map really are: releases only while the releases feature is on. */
export function effectiveMapRows(settings: Settings): MapRows {
  return featureOn(settings, 'releases') ? settings.mapRows : 'sprints';
}
