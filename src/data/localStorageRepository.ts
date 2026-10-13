import { dropRemovedOptions, setItemValue, withoutField } from '../domain/fields';
import { migrateSnapshot } from '../domain/migrate';
import { todayIso } from '../domain/sprints';
import type { Criterion, Epic, FieldAssignment, FieldDefinition, FieldValue, Release, ReleaseEvent, Settings, Snapshot, Sprint, StatusValue, Story } from '../domain/types';
import type { Repository, StoryPosition } from './repository';

const KEY = 'getitdone.snapshot.v1';

/**
 * Browser fallback and test double. Keeps the data in localStorage.
 * The desktop app uses SqliteRepository instead.
 */
export class LocalStorageRepository implements Repository {
  private read(): Snapshot {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const stored = JSON.parse(raw) as Parameters<typeof migrateSnapshot>[0];
        const snapshot = migrateSnapshot(stored, todayIso());
        // Store a migrated snapshot right away, so a migrated sprint keeps the dates it got today.
        if (stored.sprints === undefined || stored.fields === undefined || stored.releases === undefined || stored.settings === undefined || stored.events === undefined || stored.statuses === undefined) this.write(snapshot);
        return snapshot;
      }
    } catch {
      // fall through to an empty snapshot
    }
    return migrateSnapshot({ sprints: [] }, todayIso());
  }

  private write(snapshot: Snapshot): void {
    window.localStorage.setItem(KEY, JSON.stringify(snapshot));
  }

  private changeStories(change: (stories: Story[]) => Story[]): void {
    const snapshot = this.read();
    snapshot.stories = change(snapshot.stories);
    this.write(snapshot);
  }

  private changeCriteria(change: (criteria: Criterion[], story: Story) => Criterion[]): void {
    this.changeStories((stories) => stories.map((story) => ({ ...story, criteria: change(story.criteria, story) })));
  }

  private changeEpics(change: (epics: Epic[]) => Epic[]): void {
    const snapshot = this.read();
    snapshot.epics = change(snapshot.epics);
    this.write(snapshot);
  }

  async load(): Promise<Snapshot> {
    return this.read();
  }

  async replaceAll(snapshot: Snapshot): Promise<void> {
    this.write(snapshot);
  }

  async savePositions(positions: readonly StoryPosition[]): Promise<void> {
    const byId = new Map(positions.map((position) => [position.id, position]));
    this.changeStories((stories) =>
      stories.map((story) => {
        const position = byId.get(story.id);
        return position ? { ...story, ...position } : story;
      })
    );
  }

  async addStory(story: Story): Promise<void> {
    this.changeStories((stories) => [...stories, story]);
  }

  async updateStory(story: Story): Promise<void> {
    this.changeStories((stories) =>
      stories.map((item) => (item.id === story.id ? { ...story, criteria: item.criteria, values: item.values } : item))
    );
  }

  async deleteStory(storyId: string): Promise<void> {
    this.changeStories((stories) => stories.filter((story) => story.id !== storyId));
  }

  async addCriterion(storyId: string, criterion: Criterion, position: number): Promise<void> {
    this.changeCriteria((criteria, story) => {
      if (story.id !== storyId) return criteria;
      const list = [...criteria];
      list.splice(position, 0, criterion);
      return list;
    });
  }

  async setCriterionDone(criterionId: string, done: boolean): Promise<void> {
    this.changeCriteria((criteria) => criteria.map((item) => (item.id === criterionId ? { ...item, done } : item)));
  }

  async setCriterionText(criterionId: string, text: string): Promise<void> {
    this.changeCriteria((criteria) => criteria.map((item) => (item.id === criterionId ? { ...item, text } : item)));
  }

  async deleteCriterion(criterionId: string): Promise<void> {
    this.changeCriteria((criteria) => criteria.filter((item) => item.id !== criterionId));
  }

  async saveCriteriaOrder(storyId: string, criterionIds: readonly string[]): Promise<void> {
    const order = new Map(criterionIds.map((id, index) => [id, index]));
    this.changeCriteria((criteria, story) =>
      story.id !== storyId ? criteria : [...criteria].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    );
  }

  async addEpic(epic: Epic): Promise<void> {
    this.changeEpics((epics) => [...epics, epic]);
  }

  async updateEpic(epic: Epic): Promise<void> {
    this.changeEpics((epics) => epics.map((item) => (item.id === epic.id ? { ...epic, values: item.values } : item)));
  }

  async deleteEpic(epicId: string): Promise<void> {
    this.changeEpics((epics) => epics.filter((epic) => epic.id !== epicId));
  }

  private changeSprints(change: (sprints: Sprint[]) => Sprint[]): void {
    const snapshot = this.read();
    snapshot.sprints = change(snapshot.sprints);
    this.write(snapshot);
  }

  async addSprint(sprint: Sprint): Promise<void> {
    this.changeSprints((sprints) => [...sprints, sprint]);
  }

  async updateSprint(sprint: Sprint): Promise<void> {
    this.changeSprints((sprints) => sprints.map((item) => (item.id === sprint.id ? sprint : item)));
  }

  private changeReleases(change: (snapshot: Snapshot) => Snapshot): void {
    this.write(change(this.read()));
  }

  async addRelease(release: Release): Promise<void> {
    this.changeReleases((snapshot) => ({ ...snapshot, releases: [...snapshot.releases, release] }));
  }

  async updateRelease(release: Release): Promise<void> {
    this.changeReleases((snapshot) => ({
      ...snapshot,
      releases: snapshot.releases.map((item) => (item.id === release.id ? release : item))
    }));
  }

  async deleteRelease(releaseId: string): Promise<void> {
    this.changeReleases((snapshot) => ({
      ...snapshot,
      releases: snapshot.releases.filter((release) => release.id !== releaseId),
      events: snapshot.events.filter((event) => event.releaseId !== releaseId),
      stories: snapshot.stories.map((story) => (story.releaseId === releaseId ? { ...story, releaseId: null } : story))
    }));
  }

  async addReleaseEvents(events: readonly ReleaseEvent[]): Promise<void> {
    this.changeReleases((snapshot) => ({ ...snapshot, events: [...snapshot.events, ...events] }));
  }

  async saveStatuses(statuses: readonly StatusValue[]): Promise<void> {
    this.changeReleases((snapshot) => ({ ...snapshot, statuses: [...statuses] }));
  }

  async saveSettings(settings: Settings): Promise<void> {
    this.changeReleases((snapshot) => ({ ...snapshot, settings }));
  }

  private changeFields(change: (snapshot: Snapshot) => Snapshot): void {
    this.write(change(this.read()));
  }

  async saveField(field: FieldDefinition): Promise<void> {
    this.changeFields((snapshot) => ({
      ...snapshot,
      fields: snapshot.fields.some((item) => item.id === field.id)
        ? snapshot.fields.map((item) => (item.id === field.id ? field : item))
        : [...snapshot.fields, field],
      stories: dropRemovedOptions(snapshot.stories, field),
      epics: dropRemovedOptions(snapshot.epics, field)
    }));
  }

  /** Deletes a custom field with everything that belongs to it. System and built-in fields are never deleted. */
  async deleteField(fieldId: string): Promise<void> {
    this.changeFields((snapshot) => {
      if (snapshot.fields.find((field) => field.id === fieldId)?.kind !== 'custom') return snapshot;
      return {
        ...snapshot,
        fields: snapshot.fields.filter((field) => field.id !== fieldId),
        assignments: snapshot.assignments.filter((item) => item.fieldId !== fieldId),
        stories: withoutField(snapshot.stories, fieldId),
        epics: withoutField(snapshot.epics, fieldId)
      };
    });
  }

  async saveAssignments(fieldId: string, assignments: readonly FieldAssignment[]): Promise<void> {
    this.changeFields((snapshot) => ({
      ...snapshot,
      assignments: [...snapshot.assignments.filter((item) => item.fieldId !== fieldId), ...assignments]
    }));
  }

  async setFieldValue(itemId: string, fieldId: string, value: FieldValue | null): Promise<void> {
    this.changeFields((snapshot) => ({
      ...snapshot,
      stories: setItemValue(snapshot.stories, itemId, fieldId, value),
      epics: setItemValue(snapshot.epics, itemId, fieldId, value)
    }));
  }
}

