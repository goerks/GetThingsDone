import { EMPTY_DEFINITIONS, normalizeDefinitions } from './definitions';
import type { FeatureKey, Features, GithubSettings, MapRows, Settings } from './types';

export const MAP_ROWS: readonly MapRows[] = ['sprints', 'releases'];

/** The features with a toggle, in the order of the settings page. */
export const FEATURE_KEYS: readonly FeatureKey[] = ['releases', 'github'];

/** Features that are off until the team switches them on: the ones that reach out of the app (#30). The others are on until switched off. */
const OFF_BY_DEFAULT: readonly FeatureKey[] = ['github'];

export const DEFAULT_FEATURES: Features = { releases: true, github: false };

export const DEFAULT_GITHUB: GithubSettings = { repo: '', lastSyncAt: null };

export const DEFAULT_SETTINGS: Settings = { mapRows: 'sprints', features: DEFAULT_FEATURES, github: DEFAULT_GITHUB, definitions: EMPTY_DEFINITIONS };

const isOff = (value: unknown): boolean => value === false || value === 'false' || value === '0';
const isOn = (value: unknown): boolean => value === true || value === 'true' || value === '1';

interface StoredSettings {
  mapRows?: unknown;
  features?: Partial<Record<FeatureKey, unknown>> | null;
  github?: { repo?: unknown; lastSyncAt?: unknown } | null;
  definitions?: unknown;
}

/** Settings from stored data; a missing or unknown value gets its default. */
export function normalizeSettings(stored: StoredSettings | null | undefined): Settings {
  const mapRows = MAP_ROWS.find((rows) => rows === stored?.mapRows);
  const features = { ...DEFAULT_FEATURES };
  for (const key of FEATURE_KEYS) {
    const value = stored?.features?.[key];
    if (OFF_BY_DEFAULT.includes(key)) features[key] = isOn(value);
    else if (isOff(value)) features[key] = false;
  }
  const repo = typeof stored?.github?.repo === 'string' ? stored.github.repo.trim() : '';
  const lastSyncAt = typeof stored?.github?.lastSyncAt === 'string' && stored.github.lastSyncAt ? stored.github.lastSyncAt : null;
  return { mapRows: mapRows ?? DEFAULT_SETTINGS.mapRows, features, github: { repo, lastSyncAt }, definitions: normalizeDefinitions(stored?.definitions) };
}

/** Whether a feature is switched on. */
export function featureOn(settings: Settings, key: FeatureKey): boolean {
  return settings.features[key];
}

/** What the rows of the story map really are: releases only while the releases feature is on. */
export function effectiveMapRows(settings: Settings): MapRows {
  return featureOn(settings, 'releases') ? settings.mapRows : 'sprints';
}
