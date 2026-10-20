import Database from '@tauri-apps/plugin-sql';
import { normalizeColorKey } from '../domain/epics';
import { missingBuiltins } from '../domain/fields';
import { FEATURE_KEYS, normalizeSettings } from '../domain/settings';
import { isDoneIn, normalizeStatuses } from '../domain/statuses';
import { changedPositions } from '../domain/board';
import type { ChangeVersion, ItemState, LogWrites, VersionOrigin } from '../domain/changeLog';
import { settleSprints, type StoredSprint } from '../domain/sprintLife';
import { todayIso } from '../domain/sprints';
import type {
  BuiltinKey,
  Criterion,
  Epic,
  Member,
  ExternalFields,
  FieldAssignment,
  FieldDataType,
  FieldDefinition,
  FieldKind,
  FieldOption,
  FieldValue,
  ItemType,
  Release,
  ReleaseEvent,
  Settings,
  Snapshot,
  Sprint,
  Status,
  StatusCategory,
  StatusValue,
  Story
} from '../domain/types';
import type { Repository, StoryPosition } from './repository';

/** The part of the Tauri SQL plugin's `Database` the repository uses. Tests pass an in-memory SQLite. */
export interface SqlDatabase {
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
  execute(query: string, bindValues?: unknown[]): Promise<unknown>;
}

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
  /** NULL for a sprint of an earlier version; the app settles it when it loads. */
  state: string | null;
  start_items: string | null;
  result: string | null;
}

interface ChangeLogRow {
  id: string;
  at: string;
  item_type: string;
  item_id: string;
  version: number;
  origin: string;
  keys: string;
  state: string;
}

const json = (value: unknown): string | null => (value === null ? null : JSON.stringify(value));

function parseJson<T>(text: string | null): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

interface ReleaseRow {
  id: string;
  title: string;
  description: string;
  start_date: string | null;
  end_date: string | null;
}

interface EventRow {
  id: string;
  at: string;
  release_id: string;
  story_id: string;
  code: string;
  kind: string;
  points: number;
  done: number;
}

interface MemberRow {
  id: string;
  name: string;
  initials: string;
}

interface StoryRow {
  id: string;
  code: string;
  title: string;
  description: string;
  epic_id: string | null;
  points: number;
  status: string;
  sprint_id: string | null;
  release_id: string | null;
  assignee_id: string | null;
  rank: number;
  checks: string | null;
  done_items: string | null;
  github_url: string | null;
  github_state: string | null;
  github_base: string | null;
}

interface CriterionRow {
  id: string;
  story_id: string;
  text: string;
  done: number;
}

interface FieldRow {
  id: string;
  builtin_key: string | null;
  kind: string;
  data_type: string;
  label: string | null;
  default_value: string | null;
}

interface OptionRow {
  id: string;
  field_id: string;
  label: string;
  color_key: string;
}

interface AssignmentRow {
  item_type: string;
  field_id: string;
  position: number;
  required: number;
  hidden: number;
  on_card: number;
  in_create: number;
}

interface ValueRow {
  item_id: string;
  field_id: string;
  data_type: string;
  text_value: string | null;
  number_value: number | null;
  date_value: string | null;
  option_id: string | null;
}

interface ValueOptionRow {
  item_id: string;
  field_id: string;
  option_id: string;
}

type ValueColumns = { text: string | null; number: number | null; date: string | null; option: string | null };

/** A stored value goes into the column that matches its type. Multi select values live in `field_value_options`. */
function valueColumns(dataType: FieldDataType, value: FieldValue): ValueColumns {
  const columns: ValueColumns = { text: null, number: null, date: null, option: null };
  if (dataType === 'single_select') columns.option = String(value);
  else if (dataType === 'checkbox') columns.number = value === true ? 1 : 0;
  else if (dataType === 'date') columns.date = String(value);
  else if (typeof value === 'number') columns.number = value;
  else columns.text = String(value);
  return columns;
}

/** Reads a stored value back by the field's type. */
function rowValue(row: ValueRow): FieldValue | null {
  if (row.data_type === 'checkbox') return row.number_value === 1 ? true : null;
  return row.option_id ?? row.date_value ?? row.number_value ?? row.text_value;
}

/**
 * Desktop storage: a SQLite file managed by the Tauri SQL plugin.
 * The schema is created by the migration in src-tauri/migrations.
 */
export class SqliteRepository implements Repository {
  constructor(private readonly db: SqlDatabase) {}

  static async open(): Promise<SqliteRepository> {
    const db = await Database.load('sqlite:getitdone.db');
    return new SqliteRepository(db);
  }

  async load(): Promise<Snapshot> {
    const epicRows = await this.db.select<EpicRow[]>('SELECT id, name, color_key, position FROM epics ORDER BY position, name');
    const sprintRows = await this.db.select<SprintRow[]>(
      'SELECT id, name, start_date, end_date, state, start_items, result FROM sprints ORDER BY start_date, name'
    );
    const releaseRows = await this.db.select<ReleaseRow[]>(
      'SELECT id, title, description, start_date, end_date FROM releases ORDER BY rowid'
    );
    const memberRows = await this.db.select<MemberRow[]>('SELECT id, name, initials FROM members ORDER BY position, rowid');
    const changeLogRows = await this.db.select<ChangeLogRow[]>(
      'SELECT id, at, item_type, item_id, version, origin, keys, state FROM change_log ORDER BY at, rowid'
    );
    const storyRows = await this.db.select<StoryRow[]>(
      'SELECT id, code, title, description, epic_id, points, status, sprint_id, release_id, assignee_id, rank, checks, done_items, github_url, github_state, github_base FROM stories ORDER BY rank'
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

    const valueRows = await this.db.select<ValueRow[]>(
      `SELECT v.item_id, v.field_id, d.data_type, v.text_value, v.number_value, v.date_value, v.option_id
       FROM field_values v JOIN field_definitions d ON d.id = v.field_id`
    );
    const optionRows = await this.db.select<ValueOptionRow[]>(
      `SELECT v.item_id, v.field_id, v.option_id
       FROM field_value_options v JOIN field_options o ON o.id = v.option_id
       ORDER BY o.position`
    );
    const valuesByItem = new Map<string, Record<string, FieldValue>>();
    const valuesOf = (itemId: string): Record<string, FieldValue> => {
      const values = valuesByItem.get(itemId) ?? {};
      valuesByItem.set(itemId, values);
      return values;
    };
    for (const row of valueRows) {
      const value = rowValue(row);
      if (value !== null) valuesOf(row.item_id)[row.field_id] = value;
    }
    for (const row of optionRows) {
      const values = valuesOf(row.item_id);
      const current = values[row.field_id];
      values[row.field_id] = Array.isArray(current) ? [...current, row.option_id] : [row.option_id];
    }

    const epics: Epic[] = epicRows.map((row) => ({
      id: row.id,
      name: row.name,
      colorKey: normalizeColorKey(row.color_key),
      position: row.position,
      values: valuesByItem.get(row.id) ?? {}
    }));
    const storedSprints: StoredSprint[] = sprintRows.map((row) => ({
      id: row.id,
      name: row.name,
      startDate: row.start_date,
      endDate: row.end_date,
      state: (row.state ?? undefined) as Sprint['state'] | undefined,
      startItems: parseJson<Sprint['startItems']>(row.start_items),
      result: parseJson<Sprint['result']>(row.result)
    }));
    const eventRows = await this.db.select<EventRow[]>(
      'SELECT id, at, release_id, story_id, code, kind, points, done FROM release_events ORDER BY at, rowid'
    );
    const events: ReleaseEvent[] = eventRows.map((row) => ({
      id: row.id,
      at: row.at,
      releaseId: row.release_id,
      storyId: row.story_id,
      code: row.code,
      kind: row.kind as ReleaseEvent['kind'],
      points: row.points,
      done: row.done === 1
    }));
    const releases: Release[] = releaseRows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
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
      releaseId: row.release_id,
      ...(row.assignee_id ? { assigneeId: row.assignee_id } : {}),
      rank: row.rank,
      criteria: criteriaByStory.get(row.id) ?? [],
      values: valuesByItem.get(row.id) ?? {},
      checks: parseJson<Story['checks']>(row.checks) ?? {},
      doneItems: parseJson<string[]>(row.done_items),
      ...(row.github_url
        ? {
            github: {
              url: row.github_url,
              state: row.github_state === 'closed' ? ('closed' as const) : ('open' as const),
              ...(row.github_base ? { base: parseJson<ExternalFields>(row.github_base) ?? undefined } : {})
            }
          }
        : {})
    }));

    let { fields, assignments } = await this.loadFields();
    const missing = missingBuiltins(fields, assignments);
    for (const field of missing.fields) await this.saveField(field);
    for (const item of missing.assignments) await this.insertAssignment(item);
    fields = [...fields, ...missing.fields];
    assignments = [...assignments, ...missing.assignments];
    const settingRows = await this.db.select<{ key: string; value: string }[]>('SELECT key, value FROM settings');
    const settings = normalizeSettings({
      mapRows: settingRows.find((row) => row.key === 'map_rows')?.value,
      features: Object.fromEntries(FEATURE_KEYS.map((key) => [key, settingRows.find((row) => row.key === `feature_${key}`)?.value])),
      definitions: parseJson<unknown>(settingRows.find((row) => row.key === 'definitions')?.value ?? null),
      github: {
        repo: settingRows.find((row) => row.key === 'github_repo')?.value,
        lastSyncAt: settingRows.find((row) => row.key === 'github_last_sync')?.value,
        write: settingRows.find((row) => row.key === 'github_write')?.value,
        conflict: settingRows.find((row) => row.key === 'github_conflict')?.value,
        ignored: parseJson<unknown>(settingRows.find((row) => row.key === 'github_ignored')?.value ?? null),
        managed: parseJson<unknown>(settingRows.find((row) => row.key === 'github_managed')?.value ?? null)
      }
    });
    const statusRows = await this.db.select<{ id: string; label: string | null; category: string }[]>(
      'SELECT id, label, category FROM status_values ORDER BY position'
    );
    const statuses = normalizeStatuses(statusRows.map((row) => ({ id: row.id, label: row.label, category: row.category as StatusCategory })));
    // Sprints of an earlier version get their state by their dates; what that changes is stored right away.
    const settled = settleSprints(storedSprints, stories, isDoneIn(statuses), todayIso());
    if (storedSprints.some((sprint) => sprint.state === undefined)) {
      for (const sprint of settled.sprints) await this.updateSprint(sprint);
      const moved = changedPositions(stories, settled.stories);
      if (moved.length > 0) await this.savePositions(moved);
    }
    const changeLog: ChangeVersion[] = changeLogRows.map((row) => ({
      id: row.id,
      at: row.at,
      itemType: row.item_type,
      itemId: row.item_id,
      version: row.version,
      origin: row.origin as VersionOrigin,
      keys: parseJson<string[]>(row.keys) ?? [],
      state: parseJson<ItemState>(row.state) ?? {}
    }));
    const members: Member[] = memberRows.map((row) => ({ id: row.id, name: row.name, initials: row.initials }));
    return { epics, sprints: settled.sprints, releases, members, events, changeLog, stories: settled.stories, statuses, fields, assignments, settings };
  }

  private async loadFields(): Promise<{ fields: FieldDefinition[]; assignments: FieldAssignment[] }> {
    const fieldRows = await this.db.select<FieldRow[]>('SELECT id, builtin_key, kind, data_type, label, default_value FROM field_definitions ORDER BY rowid');
    const optionRows = await this.db.select<OptionRow[]>(
      'SELECT id, field_id, label, color_key FROM field_options ORDER BY field_id, position'
    );
    const assignmentRows = await this.db.select<AssignmentRow[]>(
      'SELECT item_type, field_id, position, required, hidden, on_card, in_create FROM field_assignments ORDER BY item_type, position'
    );
    const optionsByField = new Map<string, FieldOption[]>();
    for (const row of optionRows) {
      const list = optionsByField.get(row.field_id) ?? [];
      list.push({ id: row.id, label: row.label, colorKey: normalizeColorKey(row.color_key) });
      optionsByField.set(row.field_id, list);
    }
    const fields: FieldDefinition[] = fieldRows.map((row) => ({
      id: row.id,
      builtinKey: row.builtin_key as BuiltinKey | null,
      kind: row.kind as FieldKind,
      dataType: row.data_type as FieldDataType,
      label: row.label,
      options: optionsByField.get(row.id) ?? [],
      defaultValue: row.default_value === null ? null : (JSON.parse(row.default_value) as FieldValue)
    }));
    const assignments: FieldAssignment[] = assignmentRows.map((row) => ({
      itemType: row.item_type as ItemType,
      fieldId: row.field_id,
      position: row.position,
      required: row.required === 1,
      hidden: row.hidden === 1,
      onCard: row.on_card === 1,
      inCreate: row.in_create === 1
    }));
    return { fields, assignments };
  }

  async replaceAll(snapshot: Snapshot): Promise<void> {
    await this.db.execute('DELETE FROM settings');
    await this.db.execute('DELETE FROM field_value_options');
    await this.db.execute('DELETE FROM field_values');
    await this.db.execute('DELETE FROM field_assignments');
    await this.db.execute('DELETE FROM field_options');
    await this.db.execute('DELETE FROM field_definitions');
    await this.db.execute('DELETE FROM criteria');
    await this.db.execute('DELETE FROM stories');
    await this.db.execute('DELETE FROM release_events');
    await this.db.execute('DELETE FROM change_log');
    await this.db.execute('DELETE FROM releases');
    await this.db.execute('DELETE FROM sprints');
    await this.db.execute('DELETE FROM epics');
    await this.db.execute('DELETE FROM members');
    for (const field of snapshot.fields) {
      await this.saveField(field);
    }
    for (const item of snapshot.assignments) {
      await this.insertAssignment(item);
    }
    for (const epic of snapshot.epics) {
      await this.addEpic(epic);
    }
    for (const member of snapshot.members) {
      await this.addMember(member);
    }
    for (const sprint of snapshot.sprints) {
      await this.addSprint(sprint);
    }
    await this.saveSettings(snapshot.settings);
    await this.saveStatuses(snapshot.statuses);
    for (const release of snapshot.releases) {
      await this.addRelease(release);
    }
    await this.addReleaseEvents(snapshot.events);
    for (const story of snapshot.stories) {
      await this.addStory(story);
    }
    await this.applyChangeLog({ upsert: snapshot.changeLog, remove: [] });
  }

  async savePositions(positions: readonly StoryPosition[]): Promise<void> {
    for (const position of positions) {
      await this.db.execute('UPDATE stories SET status = $1, rank = $2, sprint_id = $3, epic_id = $4, release_id = $5 WHERE id = $6', [
        position.status,
        position.rank,
        position.sprintId,
        position.epicId,
        position.releaseId,
        position.id
      ]);
    }
  }

  async addStory(story: Story): Promise<void> {
    await this.db.execute(
      'INSERT INTO stories (id, code, title, description, epic_id, points, status, sprint_id, release_id, assignee_id, rank, checks, done_items, github_url, github_state, github_base) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)',
      [story.id, story.code, story.title, story.description, story.epicId, story.points, story.status, story.sprintId, story.releaseId, story.assigneeId ?? null, story.rank, JSON.stringify(story.checks), json(story.doneItems), story.github?.url ?? null, story.github?.state ?? null, json(story.github?.base ?? null)]
    );
    for (const [position, criterion] of story.criteria.entries()) {
      await this.addCriterion(story.id, criterion, position);
    }
    for (const [fieldId, value] of Object.entries(story.values)) {
      await this.setFieldValue(story.id, fieldId, value);
    }
  }

  async updateStory(story: Story): Promise<void> {
    await this.db.execute(
      'UPDATE stories SET title = $1, description = $2, epic_id = $3, points = $4, status = $5, sprint_id = $6, release_id = $7, assignee_id = $8, rank = $9, github_url = $10, github_state = $11, github_base = $12 WHERE id = $13',
      [story.title, story.description, story.epicId, story.points, story.status, story.sprintId, story.releaseId, story.assigneeId ?? null, story.rank, story.github?.url ?? null, story.github?.state ?? null, json(story.github?.base ?? null), story.id]
    );
  }

  async saveStoryChecks(storyId: string, checks: Story['checks'], doneItems: Story['doneItems']): Promise<void> {
    await this.db.execute('UPDATE stories SET checks = $1, done_items = $2 WHERE id = $3', [JSON.stringify(checks), json(doneItems), storyId]);
  }

  async deleteStory(storyId: string): Promise<void> {
    await this.db.execute('DELETE FROM field_value_options WHERE item_id = $1', [storyId]);
    await this.db.execute('DELETE FROM field_values WHERE item_id = $1', [storyId]);
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
    for (const [fieldId, value] of Object.entries(epic.values)) {
      await this.setFieldValue(epic.id, fieldId, value);
    }
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
    await this.db.execute('DELETE FROM field_value_options WHERE item_id = $1', [epicId]);
    await this.db.execute('DELETE FROM field_values WHERE item_id = $1', [epicId]);
    await this.db.execute('DELETE FROM epics WHERE id = $1', [epicId]);
  }

  async addSprint(sprint: Sprint): Promise<void> {
    await this.db.execute(
      'INSERT INTO sprints (id, name, start_date, end_date, state, start_items, result) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [sprint.id, sprint.name, sprint.startDate, sprint.endDate, sprint.state, json(sprint.startItems), json(sprint.result)]
    );
  }

  async updateSprint(sprint: Sprint): Promise<void> {
    await this.db.execute('UPDATE sprints SET name = $1, start_date = $2, end_date = $3, state = $4, start_items = $5, result = $6 WHERE id = $7', [
      sprint.name,
      sprint.startDate,
      sprint.endDate,
      sprint.state,
      json(sprint.startItems),
      json(sprint.result),
      sprint.id
    ]);
  }

  async addReleaseEvents(events: readonly ReleaseEvent[]): Promise<void> {
    for (const event of events) {
      await this.db.execute(
        'INSERT INTO release_events (id, at, release_id, story_id, code, kind, points, done) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [event.id, event.at, event.releaseId, event.storyId, event.code, event.kind, event.points, event.done ? 1 : 0]
      );
    }
  }

  async applyChangeLog(writes: LogWrites): Promise<void> {
    for (const id of writes.remove) await this.db.execute('DELETE FROM change_log WHERE id = $1', [id]);
    for (const version of writes.upsert) {
      await this.db.execute(
        `INSERT OR REPLACE INTO change_log (id, at, item_type, item_id, version, origin, keys, state)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [version.id, version.at, version.itemType, version.itemId, version.version, version.origin, JSON.stringify(version.keys), JSON.stringify(version.state)]
      );
    }
  }

  async saveStatuses(statuses: readonly StatusValue[]): Promise<void> {
    await this.db.execute('DELETE FROM status_values');
    for (const [position, status] of statuses.entries()) {
      await this.db.execute('INSERT INTO status_values (id, label, category, position) VALUES ($1, $2, $3, $4)', [
        status.id,
        status.label,
        status.category,
        position
      ]);
    }
  }

  async saveSettings(settings: Settings): Promise<void> {
    const upsert = 'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = excluded.value';
    await this.db.execute(upsert, ['map_rows', settings.mapRows]);
    for (const key of FEATURE_KEYS) await this.db.execute(upsert, [`feature_${key}`, settings.features[key] ? '1' : '0']);
    await this.db.execute(upsert, ['definitions', JSON.stringify(settings.definitions)]);
    await this.db.execute(upsert, ['github_repo', settings.github.repo]);
    await this.db.execute(upsert, ['github_write', settings.github.write ? '1' : '0']);
    await this.db.execute(upsert, ['github_conflict', settings.github.conflict]);
    await this.db.execute(upsert, ['github_ignored', JSON.stringify(settings.github.ignored)]);
    await this.db.execute(upsert, ['github_managed', JSON.stringify(settings.github.managed)]);
    if (settings.github.lastSyncAt) await this.db.execute(upsert, ['github_last_sync', settings.github.lastSyncAt]);
    else await this.db.execute('DELETE FROM settings WHERE key = $1', ['github_last_sync']);
  }

  async addRelease(release: Release): Promise<void> {
    await this.db.execute('INSERT INTO releases (id, title, description, start_date, end_date) VALUES ($1, $2, $3, $4, $5)', [
      release.id,
      release.title,
      release.description,
      release.startDate,
      release.endDate
    ]);
  }

  async updateRelease(release: Release): Promise<void> {
    await this.db.execute('UPDATE releases SET title = $1, description = $2, start_date = $3, end_date = $4 WHERE id = $5', [
      release.title,
      release.description,
      release.startDate,
      release.endDate,
      release.id
    ]);
  }

  async addMember(member: Member): Promise<void> {
    const next = await this.db.select<{ position: number | null }[]>('SELECT MAX(position) AS position FROM members');
    await this.db.execute('INSERT INTO members (id, name, initials, position) VALUES ($1, $2, $3, $4)', [member.id, member.name, member.initials, (next[0]?.position ?? -1) + 1]);
  }

  async updateMember(member: Member): Promise<void> {
    await this.db.execute('UPDATE members SET name = $1, initials = $2 WHERE id = $3', [member.name, member.initials, member.id]);
  }

  async deleteMember(memberId: string): Promise<void> {
    await this.db.execute('UPDATE stories SET assignee_id = NULL WHERE assignee_id = $1', [memberId]);
    await this.db.execute('DELETE FROM members WHERE id = $1', [memberId]);
  }

  async deleteRelease(releaseId: string): Promise<void> {
    await this.db.execute('UPDATE stories SET release_id = NULL WHERE release_id = $1', [releaseId]);
    await this.db.execute('DELETE FROM release_events WHERE release_id = $1', [releaseId]);
    await this.db.execute('DELETE FROM releases WHERE id = $1', [releaseId]);
  }

  async saveField(field: FieldDefinition): Promise<void> {
    await this.db.execute(
      `INSERT INTO field_definitions (id, builtin_key, kind, data_type, label, default_value) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET label = excluded.label, data_type = excluded.data_type, default_value = excluded.default_value`,
      [field.id, field.builtinKey, field.kind, field.dataType, field.label, field.defaultValue === null ? null : JSON.stringify(field.defaultValue)]
    );
    const keep = field.options.map((option) => option.id);
    const stored = await this.db.select<{ id: string }[]>('SELECT id FROM field_options WHERE field_id = $1', [field.id]);
    for (const row of stored) {
      // Deleting an option also deletes the values that use it (ON DELETE CASCADE).
      if (!keep.includes(row.id)) await this.db.execute('DELETE FROM field_options WHERE id = $1', [row.id]);
    }
    for (const [position, option] of field.options.entries()) {
      await this.db.execute(
        `INSERT INTO field_options (id, field_id, label, color_key, position) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET label = excluded.label, color_key = excluded.color_key, position = excluded.position`,
        [option.id, field.id, option.label, option.colorKey, position]
      );
    }
  }

  /** Deletes a custom field with everything that belongs to it. System and built-in fields are never deleted. */
  async deleteField(fieldId: string): Promise<void> {
    const rows = await this.db.select<{ kind: string }[]>('SELECT kind FROM field_definitions WHERE id = $1', [fieldId]);
    if (rows[0]?.kind !== 'custom') return;
    await this.db.execute('DELETE FROM field_value_options WHERE field_id = $1', [fieldId]);
    await this.db.execute('DELETE FROM field_values WHERE field_id = $1', [fieldId]);
    await this.db.execute('DELETE FROM field_assignments WHERE field_id = $1', [fieldId]);
    await this.db.execute('DELETE FROM field_options WHERE field_id = $1', [fieldId]);
    await this.db.execute('DELETE FROM field_definitions WHERE id = $1', [fieldId]);
  }

  async saveAssignments(fieldId: string, assignments: readonly FieldAssignment[]): Promise<void> {
    await this.db.execute('DELETE FROM field_assignments WHERE field_id = $1', [fieldId]);
    for (const item of assignments) {
      await this.insertAssignment(item);
    }
  }

  private async insertAssignment(item: FieldAssignment): Promise<void> {
    await this.db.execute(
      'INSERT INTO field_assignments (item_type, field_id, position, required, hidden, on_card, in_create) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [item.itemType, item.fieldId, item.position, item.required ? 1 : 0, item.hidden ? 1 : 0, item.onCard ? 1 : 0, item.inCreate ? 1 : 0]
    );
  }

  async setFieldValue(itemId: string, fieldId: string, value: FieldValue | null): Promise<void> {
    // A value lives in exactly one place, so both are cleared first; this also covers a changed data type.
    await this.db.execute('DELETE FROM field_value_options WHERE item_id = $1 AND field_id = $2', [itemId, fieldId]);
    if (value === null) {
      await this.db.execute('DELETE FROM field_values WHERE item_id = $1 AND field_id = $2', [itemId, fieldId]);
      return;
    }
    if (Array.isArray(value)) {
      await this.db.execute('DELETE FROM field_values WHERE item_id = $1 AND field_id = $2', [itemId, fieldId]);
      for (const optionId of value) {
        await this.db.execute('INSERT INTO field_value_options (item_id, field_id, option_id) VALUES ($1, $2, $3)', [itemId, fieldId, optionId]);
      }
      return;
    }
    const columns = valueColumns(await this.fieldType(fieldId), value);
    await this.db.execute(
      `INSERT INTO field_values (item_id, field_id, text_value, number_value, date_value, option_id) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (item_id, field_id) DO UPDATE SET text_value = excluded.text_value, number_value = excluded.number_value,
         date_value = excluded.date_value, option_id = excluded.option_id`,
      [itemId, fieldId, columns.text, columns.number, columns.date, columns.option]
    );
  }

  private async fieldType(fieldId: string): Promise<FieldDataType> {
    const rows = await this.db.select<{ data_type: string }[]>('SELECT data_type FROM field_definitions WHERE id = $1', [fieldId]);
    return (rows[0]?.data_type ?? 'text') as FieldDataType;
  }
}
