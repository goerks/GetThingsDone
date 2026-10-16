import { normalizeColorKey } from './epics';
import { missingBuiltins } from './fields';
import { normalizeSettings } from './settings';
import { isDoneIn, normalizeStatuses } from './statuses';
import { settleSprints, type StoredSprint } from './sprintLife';
import { addDays, SPRINT_LENGTH_DAYS } from './sprints';
import { EPIC_SIZES, type Epic, type EpicSize, type FieldAssignment, FieldDefinition, Release, ReleaseEvent, Settings, Snapshot, StatusValue, Story } from './types';

/**
 * Snapshot as stored by an older release. Release 0.1: one fixed sprint, stories with `inSprint`, epics without
 * a position. Before configurable fields (#4): no field library, no values, and every story has an epic.
 * Before release planning (#10): no releases, no release on stories and no settings.
 * Before configurable status values (#5): no status values, so the four defaults apply.
 * Before starting and completing sprints (#17): sprints without a state.
 * Before the definitions (#26): no definitions in the settings, and stories without checks.
 * Before estimating with cards (#54): stories without `special` and `reference`, epics without `size`. Every new
 * story used to get 3 points; such a story is migrated to "not estimated" because the default cannot be told from
 * a deliberate 3.
 */
interface StoredSnapshot {
  epics?: Array<Omit<Epic, 'position' | 'colorKey' | 'values' | 'size'> & { position?: number; colorKey: string; values?: Epic['values']; size?: string | null }>;
  sprints?: StoredSprint[];
  releases?: Release[];
  events?: ReleaseEvent[];
  stories?: Array<
    Omit<Story, 'sprintId' | 'values' | 'releaseId' | 'checks' | 'doneItems' | 'points' | 'special' | 'reference'> & {
      points: number | null;
      special?: Story['special'];
      reference?: boolean;
      sprintId?: string | null;
      releaseId?: string | null;
      inSprint?: boolean;
      values?: Story['values'];
      checks?: Story['checks'];
      doneItems?: Story['doneItems'];
    }
  >;
  fields?: Array<Omit<FieldDefinition, 'defaultValue'> & { defaultValue?: FieldDefinition['defaultValue'] }>;
  assignments?: FieldAssignment[];
  settings?: Partial<Settings>;
  statuses?: Array<Partial<StatusValue>>;
}

const DEFAULT_POINTS_BEFORE_CARDS = 3;

export const MIGRATED_SPRINT_ID = 'sprint-1';

/**
 * Brings a stored snapshot to the current shape. Release 0.1 had one fixed "Sprint 1": it becomes a real sprint
 * running from today for two weeks, and stories marked `inSprint` are planned in it. Sprints without a state get
 * one by their dates (#17).
 */
export function migrateSnapshot(stored: StoredSnapshot, today: string): Snapshot {
  const epics: Epic[] = (stored.epics ?? []).map((epic, index) => ({
    id: epic.id,
    name: epic.name,
    colorKey: normalizeColorKey(epic.colorKey),
    position: epic.position ?? index,
    size: (EPIC_SIZES as readonly string[]).includes(epic.size ?? '') ? (epic.size as EpicSize) : null,
    values: epic.values ?? {}
  }));
  const rawStories = stored.stories ?? [];
  let sprints: StoredSprint[] = stored.sprints ?? [];
  const needsSprint = stored.sprints === undefined && rawStories.some((story) => story.inSprint);
  if (needsSprint) {
    sprints = [
      { id: MIGRATED_SPRINT_ID, name: 'Sprint 1', startDate: today, endDate: addDays(today, SPRINT_LENGTH_DAYS - 1) }
    ];
  }
  const stories: Story[] = rawStories.map(({ inSprint, sprintId, ...story }) => ({
    ...story,
    // A story stored before the cards (no `special`) with the old default of 3 points is migrated to "not estimated".
    points: story.special === undefined && story.points === DEFAULT_POINTS_BEFORE_CARDS ? null : story.points,
    special: story.special ?? null,
    reference: story.reference ?? false,
    epicId: story.epicId || null,
    sprintId: sprintId !== undefined ? sprintId : inSprint && needsSprint ? MIGRATED_SPRINT_ID : null,
    releaseId: story.releaseId ?? null,
    values: story.values ?? {},
    checks: story.checks ?? {},
    // Stories done before the definitions existed are never marked.
    doneItems: story.doneItems ?? null
  }));
  const fields: FieldDefinition[] = (stored.fields ?? []).map((field) => ({ ...field, defaultValue: field.defaultValue ?? null }));
  const assignments = stored.assignments ?? [];
  const missing = missingBuiltins(fields, assignments);
  const statuses = normalizeStatuses(stored.statuses);
  const settled = settleSprints(sprints, stories, isDoneIn(statuses), today);
  return {
    epics,
    sprints: settled.sprints,
    releases: stored.releases ?? [],
    events: stored.events ?? [],
    settings: normalizeSettings(stored.settings),
    stories: settled.stories,
    statuses,
    fields: [...fields, ...missing.fields],
    assignments: [...assignments, ...missing.assignments]
  };
}
