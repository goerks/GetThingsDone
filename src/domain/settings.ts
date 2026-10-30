import { normalizeLog } from './syncLog';
import { EMPTY_DEFINITIONS, normalizeDefinitions } from './definitions';
import type { ConflictRule, FeatureKey, Features, MapRows, ServiceKind, Settings, SyncSettings } from './types';

export const MAP_ROWS: readonly MapRows[] = ['sprints', 'releases'];

/** The features with a toggle, in the order of the settings page. */
export const FEATURE_KEYS: readonly FeatureKey[] = ['releases', 'team', 'sync'];

/** Releases are on until the team switches them off; the team (#18) and the synchronisation (#30, #66) are off until the team switches them on. The demo data switch the team on. */
export const DEFAULT_FEATURES: Features = { releases: true, team: false, sync: false };

/** The services in the order of the settings. Those that have a connector can be chosen, the others are planned (ADR 0007). */
export const SERVICE_KINDS: readonly ServiceKind[] = ['github', 'jira', 'gitlab'];

export const DEFAULT_SYNC: SyncSettings = { service: 'github', connection: {}, lastSyncAt: null, write: false, conflict: 'remote', ignored: [], managed: { labels: [], milestones: [] }, auto: false, log: [] };

export const DEFAULT_SETTINGS: Settings = { mapRows: 'sprints', features: DEFAULT_FEATURES, sync: DEFAULT_SYNC, definitions: EMPTY_DEFINITIONS };

const isOff = (value: unknown): boolean => value === false || value === 'false' || value === '0';
const isOn = (value: unknown): boolean => value === true || value === 'true' || value === '1';

interface StoredSync {
  service?: unknown;
  connection?: unknown;
  repo?: unknown;
  lastSyncAt?: unknown;
  write?: unknown;
  conflict?: unknown;
  ignored?: unknown;
  managed?: unknown;
  auto?: unknown;
  log?: unknown;
}

export interface StoredSettings {
  mapRows?: unknown;
  features?: (Partial<Record<FeatureKey, unknown>> & { github?: unknown }) | null;
  sync?: StoredSync | null;
  /** Before the generalisation (#66) the GitHub connection had its own key; it is read as the synchronisation with GitHub. */
  github?: StoredSync | null;
  definitions?: unknown;
}

const names = (value: unknown): string[] => (Array.isArray(value) ? (value as unknown[]).filter((item): item is string => typeof item === 'string') : []);

/** The connection of the chosen service as text values; whatever is not a text is dropped. */
function normalizeConnection(stored: StoredSync): Record<string, string> {
  const connection: Record<string, string> = {};
  if (typeof stored.connection === 'object' && stored.connection !== null) {
    for (const [key, value] of Object.entries(stored.connection as Record<string, unknown>)) if (typeof value === 'string' && value.trim() !== '') connection[key] = value.trim();
  }
  // The GitHub settings of before the generalisation held the repository directly.
  if (connection.repo === undefined && typeof stored.repo === 'string' && stored.repo.trim() !== '') connection.repo = stored.repo.trim();
  return connection;
}

function normalizeSync(stored: StoredSync | null | undefined): SyncSettings {
  const source: StoredSync = stored ?? {};
  const service = SERVICE_KINDS.find((kind) => kind === source.service) ?? DEFAULT_SYNC.service;
  const conflict: ConflictRule = source.conflict === 'local' || source.conflict === 'ask' ? source.conflict : 'remote';
  const storedManaged = (typeof source.managed === 'object' && source.managed !== null ? source.managed : {}) as { labels?: unknown; milestones?: unknown };
  return {
    service,
    connection: normalizeConnection(source),
    lastSyncAt: typeof source.lastSyncAt === 'string' && source.lastSyncAt ? source.lastSyncAt : null,
    write: isOn(source.write),
    conflict,
    ignored: names(source.ignored),
    managed: { labels: names(storedManaged.labels), milestones: names(storedManaged.milestones) },
    auto: isOn(source.auto),
    log: normalizeLog(source.log)
  };
}

/** Settings from stored data; a missing or unknown value gets its default. */
export function normalizeSettings(stored: StoredSettings | null | undefined): Settings {
  const mapRows = MAP_ROWS.find((rows) => rows === stored?.mapRows);
  const features = { ...DEFAULT_FEATURES };
  // The synchronisation was the feature "github" before the generalisation (#66).
  const storedFeatures: Partial<Record<FeatureKey, unknown>> = { ...stored?.features, sync: stored?.features?.sync ?? stored?.features?.github };
  for (const key of FEATURE_KEYS) {
    const value = storedFeatures[key];
    // A missing or unknown value gives the default of the feature.
    if (DEFAULT_FEATURES[key] ? isOff(value) : isOn(value)) features[key] = !DEFAULT_FEATURES[key];
  }
  return { mapRows: mapRows ?? DEFAULT_SETTINGS.mapRows, features, sync: normalizeSync(stored?.sync ?? stored?.github), definitions: normalizeDefinitions(stored?.definitions) };
}

/** Whether a feature is switched on. */
export function featureOn(settings: Settings, key: FeatureKey): boolean {
  return settings.features[key];
}

/** What the rows of the story map really are: releases only while the releases feature is on. */
export function effectiveMapRows(settings: Settings): MapRows {
  return featureOn(settings, 'releases') ? settings.mapRows : 'sprints';
}
