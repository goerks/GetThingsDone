import { normalizeColorKey } from './epics';
import { missingBuiltins } from './fields';
import { addDays, SPRINT_LENGTH_DAYS } from './sprints';
import type { Epic, FieldAssignment, FieldDefinition, Snapshot, Sprint, Story } from './types';

/**
 * Snapshot as stored by an older release. Release 0.1: one fixed sprint, stories with `inSprint`, epics without
 * a position. Before configurable fields (#4): no field library, no values, and every story has an epic.
 */
interface StoredSnapshot {
  epics?: Array<Omit<Epic, 'position' | 'colorKey'> & { position?: number; colorKey: string }>;
  sprints?: Sprint[];
  stories?: Array<
    Omit<Story, 'sprintId' | 'values'> & { sprintId?: string | null; inSprint?: boolean; values?: Story['values'] }
  >;
  fields?: FieldDefinition[];
  assignments?: FieldAssignment[];
}

export const MIGRATED_SPRINT_ID = 'sprint-1';

/**
 * Brings a stored snapshot to the current shape. Release 0.1 had one fixed "Sprint 1": it becomes a real sprint
 * running from today for two weeks, and stories marked `inSprint` are planned in it.
 */
export function migrateSnapshot(stored: StoredSnapshot, today: string): Snapshot {
  const epics: Epic[] = (stored.epics ?? []).map((epic, index) => ({
    id: epic.id,
    name: epic.name,
    colorKey: normalizeColorKey(epic.colorKey),
    position: epic.position ?? index
  }));
  const rawStories = stored.stories ?? [];
  let sprints: Sprint[] = stored.sprints ?? [];
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
    values: story.values ?? {}
  }));
  const fields = stored.fields ?? [];
  const assignments = stored.assignments ?? [];
  const missing = missingBuiltins(fields, assignments);
  return {
    epics,
    sprints,
    stories,
    fields: [...fields, ...missing.fields],
    assignments: [...assignments, ...missing.assignments]
  };
}
