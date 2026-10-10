import Database from '@tauri-apps/plugin-sql';
import type { Criterion, Epic, EpicColorKey, Snapshot, Status, Story } from '../domain/types';
import type { Repository } from './repository';

interface EpicRow {
  id: string;
  name: string;
  color_key: string;
}

interface StoryRow {
  id: string;
  code: string;
  title: string;
  description: string;
  epic_id: string;
  points: number;
  status: string;
  in_sprint: number;
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
    const epicRows = await this.db.select<EpicRow[]>('SELECT id, name, color_key FROM epics ORDER BY name');
    const storyRows = await this.db.select<StoryRow[]>(
      'SELECT id, code, title, description, epic_id, points, status, in_sprint, rank FROM stories ORDER BY rank'
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

    const epics: Epic[] = epicRows.map((row) => ({ id: row.id, name: row.name, colorKey: row.color_key as EpicColorKey }));
    const stories: Story[] = storyRows.map((row) => ({
      id: row.id,
      code: row.code,
      title: row.title,
      description: row.description,
      epicId: row.epic_id,
      points: row.points,
      status: row.status as Status,
      inSprint: row.in_sprint === 1,
      rank: row.rank,
      criteria: criteriaByStory.get(row.id) ?? []
    }));
    return { epics, stories };
  }

  async replaceAll(snapshot: Snapshot): Promise<void> {
    await this.db.execute('DELETE FROM criteria');
    await this.db.execute('DELETE FROM stories');
    await this.db.execute('DELETE FROM epics');
    for (const epic of snapshot.epics) {
      await this.db.execute('INSERT INTO epics (id, name, color_key) VALUES ($1, $2, $3)', [epic.id, epic.name, epic.colorKey]);
    }
    for (const story of snapshot.stories) {
      await this.addStory(story);
    }
  }

  async savePositions(positions: ReadonlyArray<Pick<Story, 'id' | 'status' | 'rank'>>): Promise<void> {
    for (const position of positions) {
      await this.db.execute('UPDATE stories SET status = $1, rank = $2 WHERE id = $3', [
        position.status,
        position.rank,
        position.id
      ]);
    }
  }

  async setCriterionDone(criterionId: string, done: boolean): Promise<void> {
    await this.db.execute('UPDATE criteria SET done = $1 WHERE id = $2', [done ? 1 : 0, criterionId]);
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

  async setInSprint(storyId: string, value: boolean): Promise<void> {
    await this.db.execute('UPDATE stories SET in_sprint = $1 WHERE id = $2', [value ? 1 : 0, storyId]);
  }

  async addStory(story: Story): Promise<void> {
    await this.db.execute(
      'INSERT INTO stories (id, code, title, description, epic_id, points, status, in_sprint, rank) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [story.id, story.code, story.title, story.description, story.epicId, story.points, story.status, story.inSprint ? 1 : 0, story.rank]
    );
    for (const [position, criterion] of story.criteria.entries()) {
      await this.addCriterion(story.id, criterion, position);
    }
  }
}
