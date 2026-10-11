import Database from '@tauri-apps/plugin-sql';
import { normalizeColorKey } from '../domain/epics';
import type { Criterion, Epic, Snapshot, Sprint, Status, Story } from '../domain/types';
import type { Repository, StoryPosition } from './repository';

interface EpicRow {
  id: string;
  name: string;
  color_key: string;
  position: number;
}

interface SprintRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

interface StoryRow {
  id: string;
  code: string;
  title: string;
  description: string;
  epic_id: string;
  points: number;
  status: string;
  sprint_id: string | null;
  rank: number;
}

interface CriterionRow {
  id: string;
  story_id: string;
  text: string;
  done: number;
}

/**
 * Desktop storage: a SQLite file managed by the Tauri SQL plugin.
 * The schema is created by the migration in src-tauri/migrations.
 */
export class SqliteRepository implements Repository {
  private constructor(private readonly db: Database) {}

  static async open(): Promise<SqliteRepository> {
    const db = await Database.load('sqlite:getitdone.db');
    return new SqliteRepository(db);
  }

  async load(): Promise<Snapshot> {
    const epicRows = await this.db.select<EpicRow[]>('SELECT id, name, color_key, position FROM epics ORDER BY position, name');
    const sprintRows = await this.db.select<SprintRow[]>(
      'SELECT id, name, start_date, end_date FROM sprints ORDER BY start_date, name'
    );
    const storyRows = await this.db.select<StoryRow[]>(
      'SELECT id, code, title, description, epic_id, points, status, sprint_id, rank FROM stories ORDER BY rank'
    );
    const criterionRows = await this.db.select<CriterionRow[]>(
      'SELECT id, story_id, text, done FROM criteria ORDER BY story_id, position'
    );

    const criteriaByStory = new Map<string, Criterion[]>();
    for (const row of criterionRows) {
      const list = criteriaByStory.get(row.story_id) ?? [];
      list.push({ id: row.id, text: row.text, done: row.done === 1 });
      criteriaByStory.set(row.story_id, list);
    }

    const epics: Epic[] = epicRows.map((row) => ({
      id: row.id,
      name: row.name,
      colorKey: normalizeColorKey(row.color_key),
      position: row.position
    }));
    const sprints: Sprint[] = sprintRows.map((row) => ({
      id: row.id,
      name: row.name,
      startDate: row.start_date,
      endDate: row.end_date
    }));
    const stories: Story[] = storyRows.map((row) => ({
      id: row.id,
      code: row.code,
      title: row.title,
      description: row.description,
      epicId: row.epic_id,
      points: row.points,
      status: row.status as Status,
      sprintId: row.sprint_id,
      rank: row.rank,
      criteria: criteriaByStory.get(row.id) ?? []
    }));
    return { epics, sprints, stories };
  }

  async replaceAll(snapshot: Snapshot): Promise<void> {
    await this.db.execute('DELETE FROM criteria');
    await this.db.execute('DELETE FROM stories');
    await this.db.execute('DELETE FROM sprints');
    await this.db.execute('DELETE FROM epics');
    for (const epic of snapshot.epics) {
      await this.addEpic(epic);
    }
    for (const sprint of snapshot.sprints) {
      await this.addSprint(sprint);
    }
    for (const story of snapshot.stories) {
      await this.addStory(story);
    }
  }

  async savePositions(positions: readonly StoryPosition[]): Promise<void> {
    for (const position of positions) {
      await this.db.execute('UPDATE stories SET status = $1, rank = $2, sprint_id = $3, epic_id = $4 WHERE id = $5', [
        position.status,
        position.rank,
        position.sprintId,
        position.epicId,
        position.id
      ]);
    }
  }

  async addStory(story: Story): Promise<void> {
    await this.db.execute(
      'INSERT INTO stories (id, code, title, description, epic_id, points, status, in_sprint, sprint_id, rank) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [
        story.id,
        story.code,
        story.title,
        story.description,
        story.epicId,
        story.points,
        story.status,
        story.sprintId ? 1 : 0,
        story.sprintId,
        story.rank
      ]
    );
    for (const [position, criterion] of story.criteria.entries()) {
      await this.addCriterion(story.id, criterion, position);
    }
  }

  async updateStory(story: Story): Promise<void> {
    await this.db.execute(
      'UPDATE stories SET title = $1, description = $2, epic_id = $3, points = $4, status = $5, sprint_id = $6, rank = $7 WHERE id = $8',
      [story.title, story.description, story.epicId, story.points, story.status, story.sprintId, story.rank, story.id]
    );
  }

  async deleteStory(storyId: string): Promise<void> {
    await this.db.execute('DELETE FROM criteria WHERE story_id = $1', [storyId]);
    await this.db.execute('DELETE FROM stories WHERE id = $1', [storyId]);
  }

  async addCriterion(storyId: string, criterion: Criterion, position: number): Promise<void> {
    await this.db.execute('INSERT INTO criteria (id, story_id, text, done, position) VALUES ($1, $2, $3, $4, $5)', [
      criterion.id,
      storyId,
      criterion.text,
      criterion.done ? 1 : 0,
      position
    ]);
  }

  async setCriterionDone(criterionId: string, done: boolean): Promise<void> {
    await this.db.execute('UPDATE criteria SET done = $1 WHERE id = $2', [done ? 1 : 0, criterionId]);
  }

  async setCriterionText(criterionId: string, text: string): Promise<void> {
    await this.db.execute('UPDATE criteria SET text = $1 WHERE id = $2', [text, criterionId]);
  }

  async deleteCriterion(criterionId: string): Promise<void> {
    await this.db.execute('DELETE FROM criteria WHERE id = $1', [criterionId]);
  }

  async saveCriteriaOrder(storyId: string, criterionIds: readonly string[]): Promise<void> {
    for (const [position, id] of criterionIds.entries()) {
      await this.db.execute('UPDATE criteria SET position = $1 WHERE id = $2 AND story_id = $3', [position, id, storyId]);
    }
  }

  async addEpic(epic: Epic): Promise<void> {
    await this.db.execute('INSERT INTO epics (id, name, color_key, position) VALUES ($1, $2, $3, $4)', [
      epic.id,
      epic.name,
      epic.colorKey,
      epic.position
    ]);
  }

  async updateEpic(epic: Epic): Promise<void> {
    await this.db.execute('UPDATE epics SET name = $1, color_key = $2, position = $3 WHERE id = $4', [
      epic.name,
      epic.colorKey,
      epic.position,
      epic.id
    ]);
  }

  async deleteEpic(epicId: string): Promise<void> {
    await this.db.execute('DELETE FROM epics WHERE id = $1', [epicId]);
  }

  async addSprint(sprint: Sprint): Promise<void> {
    await this.db.execute('INSERT INTO sprints (id, name, start_date, end_date) VALUES ($1, $2, $3, $4)', [
      sprint.id,
      sprint.name,
      sprint.startDate,
      sprint.endDate
    ]);
  }

  async updateSprint(sprint: Sprint): Promise<void> {
    await this.db.execute('UPDATE sprints SET name = $1, start_date = $2, end_date = $3 WHERE id = $4', [
      sprint.name,
      sprint.startDate,
      sprint.endDate,
      sprint.id
    ]);
  }
}
