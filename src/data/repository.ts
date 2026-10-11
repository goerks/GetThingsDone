import type { Criterion, Epic, Snapshot, Sprint, Story } from '../domain/types';

export type StoryPosition = Pick<Story, 'id' | 'status' | 'rank' | 'sprintId' | 'epicId'>;

/**
 * Storage boundary of the app (see ADR 0001). The desktop app uses SQLite through Tauri,
 * the browser build uses a local fallback. Both implement this interface.
 */
export interface Repository {
  load(): Promise<Snapshot>;
  /** Replaces everything. Used for the demo data on first start. */
  replaceAll(snapshot: Snapshot): Promise<void>;
  savePositions(positions: readonly StoryPosition[]): Promise<void>;
  addStory(story: Story): Promise<void>;
  /** Saves the fields of a story. Criteria are saved through their own methods. */
  updateStory(story: Story): Promise<void>;
  /** Deletes a story with its criteria. */
  deleteStory(storyId: string): Promise<void>;
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
  addSprint(sprint: Sprint): Promise<void>;
  updateSprint(sprint: Sprint): Promise<void>;
}
