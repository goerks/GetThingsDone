import type { Criterion, Snapshot, Story } from '../domain/types';
import type { Repository } from './repository';

const KEY = 'getitdone.snapshot.v1';

/**
 * Browser fallback and test double. Keeps the data in localStorage.
 * The desktop app uses SqliteRepository instead.
 */
export class LocalStorageRepository implements Repository {
  private read(): Snapshot {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as Snapshot;
    } catch {
      // fall through to an empty snapshot
    }
    return { epics: [], stories: [] };
  }

  private write(snapshot: Snapshot): void {
    window.localStorage.setItem(KEY, JSON.stringify(snapshot));
  }

  async load(): Promise<Snapshot> {
    return this.read();
  }

  async replaceAll(snapshot: Snapshot): Promise<void> {
    this.write(snapshot);
  }

  async savePositions(positions: ReadonlyArray<Pick<Story, 'id' | 'status' | 'rank'>>): Promise<void> {
    const snapshot = this.read();
    const byId = new Map(positions.map((position) => [position.id, position]));
    snapshot.stories = snapshot.stories.map((story) => {
      const position = byId.get(story.id);
      return position ? { ...story, status: position.status, rank: position.rank } : story;
    });
    this.write(snapshot);
  }

  async setCriterionDone(criterionId: string, done: boolean): Promise<void> {
    const snapshot = this.read();
    snapshot.stories = snapshot.stories.map((story) => ({
      ...story,
      criteria: story.criteria.map((criterion) => (criterion.id === criterionId ? { ...criterion, done } : criterion))
    }));
    this.write(snapshot);
  }

  async addCriterion(storyId: string, criterion: Criterion, position: number): Promise<void> {
    const snapshot = this.read();
    snapshot.stories = snapshot.stories.map((story) => {
      if (story.id !== storyId) return story;
      const criteria = [...story.criteria];
      criteria.splice(position, 0, criterion);
      return { ...story, criteria };
    });
    this.write(snapshot);
  }

  async setInSprint(storyId: string, value: boolean): Promise<void> {
    const snapshot = this.read();
    snapshot.stories = snapshot.stories.map((story) => (story.id === storyId ? { ...story, inSprint: value } : story));
    this.write(snapshot);
  }

  async addStory(story: Story): Promise<void> {
    const snapshot = this.read();
    snapshot.stories = [...snapshot.stories, story];
    this.write(snapshot);
  }
}
