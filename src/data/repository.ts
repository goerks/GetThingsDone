import type { LogWrites } from '../domain/changeLog';
import type { Criterion, Epic, FieldAssignment, FieldDefinition, FieldValue, Member, Release, ReleaseEvent, Settings, Snapshot, Sprint, StatusValue, Story } from '../domain/types';

export type StoryPosition = Pick<Story, 'id' | 'status' | 'rank' | 'sprintId' | 'epicId' | 'releaseId'>;

/**
 * Storage boundary of the app (see ADR 0001). The desktop app uses SQLite through Tauri,
 * the browser build uses a local fallback. Both implement this interface.
 */
export interface Repository {
  /** Loads everything. System and built-in fields that are missing are added and saved. */
  load(): Promise<Snapshot>;
  /** Replaces everything. Used for the demo data on first start. */
  replaceAll(snapshot: Snapshot): Promise<void>;
  savePositions(positions: readonly StoryPosition[]): Promise<void>;
  addStory(story: Story): Promise<void>;
  /** Saves the fields of a story. Criteria are saved through their own methods. */
  updateStory(story: Story): Promise<void>;
  /** Deletes a story with its criteria. */
  deleteStory(storyId: string): Promise<void>;
  /** Saves the manual states of the definitions (#26) and the Done snapshot of a story. */
  saveStoryChecks(storyId: string, checks: Story['checks'], doneItems: Story['doneItems']): Promise<void>;
  addCriterion(storyId: string, criterion: Criterion, position: number): Promise<void>;
  setCriterionDone(criterionId: string, done: boolean): Promise<void>;
  setCriterionText(criterionId: string, text: string): Promise<void>;
  deleteCriterion(criterionId: string): Promise<void>;
  /** Stores the order of the criteria of one story. */
  saveCriteriaOrder(storyId: string, criterionIds: readonly string[]): Promise<void>;
  addEpic(epic: Epic): Promise<void>;
  updateEpic(epic: Epic): Promise<void>;
  /** Deletes an epic. Callers make sure no story uses it. */
  deleteEpic(epicId: string): Promise<void>;
  /** Adds a team member at the end of the list (#18). */
  addMember(member: Member): Promise<void>;
  updateMember(member: Member): Promise<void>;
  /** Deletes a team member. The stories assigned to them stay and are not assigned any more. */
  deleteMember(memberId: string): Promise<void>;
  addSprint(sprint: Sprint): Promise<void>;
  updateSprint(sprint: Sprint): Promise<void>;
  addRelease(release: Release): Promise<void>;
  updateRelease(release: Release): Promise<void>;
  /** Deletes a release with its history. Its stories stay and lose their release. */
  deleteRelease(releaseId: string): Promise<void>;
  /** Appends entries to the history of the releases. */
  addReleaseEvents(events: readonly ReleaseEvent[]): Promise<void>;
  /** Stores versions of the change log (#23): inserts or replaces the given versions and deletes the removed ones. */
  applyChangeLog(writes: LogWrites): Promise<void>;
  /** Replaces the status values (#5) with the given list, in board order. Stories are saved separately. */
  saveStatuses(statuses: readonly StatusValue[]): Promise<void>;
  /** Stores the settings of the workspace. */
  saveSettings(settings: Settings): Promise<void>;
  /** Adds or changes a field with its options. Values of removed options are deleted. */
  saveField(field: FieldDefinition): Promise<void>;
  /** Deletes a field with its options, assignments and values. */
  deleteField(fieldId: string): Promise<void>;
  /** Replaces the assignments of one field. */
  saveAssignments(fieldId: string, assignments: readonly FieldAssignment[]): Promise<void>;
  /** Sets the value of a field on an item, or removes it when the value is null. */
  setFieldValue(itemId: string, fieldId: string, value: FieldValue | null): Promise<void>;
}
