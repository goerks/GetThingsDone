import { EMPTY_DEFINITIONS, normalizeDefinitions } from './definitions';
import type { ConflictRule, FeatureKey, Features, GithubSettings, MapRows, Settings } from './types';

export const MAP_ROWS: readonly MapRows[] = ['sprints', 'releases'];

/** The features with a toggle, in the order of the settings page. */
export const FEATURE_KEYS: readonly FeatureKey[] = ['releases', 'team', 'github'];

/** Releases are on until the team switches them off; the team (#18) and the GitHub connection (#30) are off until the team switches them on. The demo data switch the team on. */
export const DEFAULT_FEATURES: Features = { releases: true, team: false, github: false };

export const DEFAULT_GITHUB: GithubSettings = { repo: '', lastSyncAt: null, write: false, conflict: 'remote', ignored: [] };

export const DEFAULT_SETTINGS: Settings = { mapRows: 'sprints', features: DEFAULT_FEATURES, github: DEFAULT_GITHUB, definitions: EMPTY_DEFINITIONS };

const isOff = (value: unknown): boolean => value === false || value === 'false' || value === '0';
const isOn = (value: unknown): boolean => value === true || value === 'true' || value === '1';

interface StoredSettings {
  mapRows?: unknown;
  features?: Partial<Record<FeatureKey, unknown>> | null;
  github?: { repo?: unknown; lastSyncAt?: unknown; write?: unknown; conflict?: unknown; ignored?: unknown } | null;
  definitions?: unknown;
}

/** Settings from stored data; a missing or unknown value gets its default. */
export function normalizeSettings(stored: StoredSettings | null | undefined): Settings {
  const mapRows = MAP_ROWS.find((rows) => rows === stored?.mapRows);
  const features = { ...DEFAULT_FEATURES };
  for (const key of FEATURE_KEYS) {
    const value = stored?.features?.[key];
    // A missing or unknown value gives the default of the feature.
    if (DEFAULT_FEATURES[key] ? isOff(value) : isOn(value)) features[key] = !DEFAULT_FEATURES[key];
  }
  const repo = typeof stored?.github?.repo === 'string' ? stored.github.repo.trim() : '';
  const write = isOn(stored?.github?.write);
  const conflict: ConflictRule = stored?.github?.conflict === 'local' || stored?.github?.conflict === 'ask' ? stored.github.conflict : 'remote';
  const ignored = Array.isArray(stored?.github?.ignored) ? (stored.github.ignored as unknown[]).filter((item): item is string => typeof item === 'string') : [];
  const lastSyncAt = typeof stored?.github?.lastSyncAt === 'string' && stored.github.lastSyncAt ? stored.github.lastSyncAt : null;
  return { mapRows: mapRows ?? DEFAULT_SETTINGS.mapRows, features, github: { repo, lastSyncAt, write, conflict, ignored }, definitions: normalizeDefinitions(stored?.definitions) };
}

/** Whether a feature is switched on. */
export function featureOn(settings: Settings, key: FeatureKey): boolean {
  return settings.features[key];
}

/** What the rows of the story map really are: releases only while the releases feature is on. */
export function effectiveMapRows(settings: Settings): MapRows {
  return featureOn(settings, 'releases') ? settings.mapRows : 'sprints';
}
