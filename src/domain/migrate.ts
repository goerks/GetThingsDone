import type { ChangeVersion } from './changeLog';
import { normalizeColorKey } from './epics';
import { missingBuiltins } from './fields';
import { normalizeSettings } from './settings';
import { isDoneIn, normalizeStatuses } from './statuses';
import { settleSprints, type StoredSprint } from './sprintLife';
import { addDays, SPRINT_LENGTH_DAYS } from './sprints';
import type { Epic, FieldAssignment, FieldDefinition, Release, ReleaseEvent, Settings, Snapshot, StatusValue, Story } from './types';

/**
 * Snapshot as stored by an older release. Release 0.1: one fixed sprint, stories with `inSprint`, epics without
 * a position. Before configurable fields (#4): no field library, no values, and every story has an epic.
 * Before release planning (#10): no releases, no release on stories and no settings.
 * Before configurable status values (#5): no status values, so the four defaults apply.
 * Before starting and completing sprints (#17): sprints without a state.
 * Before the definitions (#26): no definitions in the settings, and stories without checks.
 * Before the change log (#23): no versions.
 */
interface StoredSnapshot {
  epics?: Array<Omit<Epic, 'position' | 'colorKey' | 'values'> & { position?: number; colorKey: string; values?: Epic['values'] }>;
  sprints?: StoredSprint[];
  releases?: Release[];
  events?: ReleaseEvent[];
  changeLog?: ChangeVersion[];
  stories?: Array<
    Omit<Story, 'sprintId' | 'values' | 'releaseId' | 'checks' | 'doneItems'> & {
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
    changeLog: stored.changeLog ?? [],
    settings: normalizeSettings(stored.settings),
    stories: settled.stories,
    statuses,
    fields: [...fields, ...missing.fields],
    assignments: [...assignments, ...missing.assignments]
  };
}
