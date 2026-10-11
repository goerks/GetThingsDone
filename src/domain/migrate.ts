import { normalizeColorKey } from './epics';
import { addDays, SPRINT_LENGTH_DAYS } from './sprints';
import type { Epic, Snapshot, Sprint, Story } from './types';

/** Snapshot as stored by release 0.1: one fixed sprint, stories with `inSprint`, epics without a position. */
interface StoredSnapshot {
  epics?: Array<Omit<Epic, 'position' | 'colorKey'> & { position?: number; colorKey: string }>;
  sprints?: Sprint[];
  stories?: Array<Omit<Story, 'sprintId'> & { sprintId?: string | null; inSprint?: boolean }>;
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
    sprintId: sprintId !== undefined ? sprintId : inSprint && needsSprint ? MIGRATED_SPRINT_ID : null
  }));
  return { epics, sprints, stories };
}
