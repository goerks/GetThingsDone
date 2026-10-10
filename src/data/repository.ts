import type { Criterion, Snapshot, Story } from '../domain/types';

/**
 * Storage boundary of the app (see ADR 0001). The desktop app uses SQLite through Tauri,
 * the browser build uses a local fallback. Both implement this interface.
 */
export interface Repository {
  load(): Promise<Snapshot>;
  /** Replaces everything. Used for the demo data on first start. */
  replaceAll(snapshot: Snapshot): Promise<void>;
  savePositions(positions: ReadonlyArray<Pick<Story, 'id' | 'status' | 'rank'>>): Promise<void>;
  setCriterionDone(criterionId: string, done: boolean): Promise<void>;
  addCriterion(storyId: string, criterion: Criterion, position: number): Promise<void>;
  setInSprint(storyId: string, value: boolean): Promise<void>;
  addStory(story: Story): Promise<void>;
}
