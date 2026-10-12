// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { builtinFieldId, convertValue } from '../domain/fields';
import type { CustomDataType, FieldDefinition } from '../domain/types';
import { seedSnapshot } from './seed';
import { SqliteRepository, type SqlDatabase } from './sqliteRepository';

const MIGRATIONS = ['001_init.sql', '002_epic_palette.sql', '003_sprints.sql', '004_custom_fields.sql', '005_field_defaults.sql', '006_more_field_types.sql', '007_releases.sql', '008_settings.sql', '009_release_events.sql'];

function migration(name: string): string {
  return readFileSync(new URL(`../../src-tauri/migrations/${name}`, import.meta.url), 'utf8');
}

/** Runs a migration the way the Tauri SQL plugin does: in a transaction, with foreign keys on. */
function migrate(db: DatabaseSync, names: readonly string[]): void {
  for (const name of names) {
    db.exec('BEGIN');
    db.exec(migration(name));
    db.exec('COMMIT');
  }
}

/** The Tauri SQL plugin numbers parameters as $1, $2; node:sqlite binds them as ?1, ?2. */
class NodeDatabase implements SqlDatabase {
  constructor(private readonly db: DatabaseSync) {}

  private prepare(query: string) {
    return this.db.prepare(query.replace(/\$(\d+)/g, '?$1'));
  }

  async select<T>(query: string, bindValues: unknown[] = []): Promise<T> {
    return this.prepare(query).all(...(bindValues as never[])) as T;
  }

  async execute(query: string, bindValues: unknown[] = []): Promise<unknown> {
    return this.prepare(query).run(...(bindValues as never[]));
  }
}

function openDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

async function freshRepository(): Promise<{ db: DatabaseSync; repository: SqliteRepository }> {
  const db = openDatabase();
  migrate(db, MIGRATIONS);
  const repository = new SqliteRepository(new NodeDatabase(db));
  await repository.replaceAll(seedSnapshot('2026-10-11'));
  return { db, repository };
}

describe('migration 004', () => {
  it('keeps every story and criterion of release 0.1 and lets a story lose its epic', () => {
    const db = openDatabase();
    migrate(db, MIGRATIONS.slice(0, 2));
    db.exec(`
      INSERT INTO epics (id, name, color_key) VALUES ('e1', 'Boards', 'boards');
      INSERT INTO stories (id, code, title, description, epic_id, points, status, in_sprint, rank)
        VALUES ('s1', 'S-1', 'First', 'Text', 'e1', 3, 'todo', 1, 0), ('s2', 'S-2', 'Second', '', 'e1', 5, 'done', 0, 1);
      INSERT INTO criteria (id, story_id, text, done, position)
        VALUES ('c1', 's1', 'One', 1, 0), ('c2', 's1', 'Two', 0, 1), ('c3', 's2', 'Three', 0, 0);
    `);

    migrate(db, MIGRATIONS.slice(2));

    expect(db.prepare('SELECT id, epic_id, points, sprint_id, rank FROM stories ORDER BY rank').all()).toEqual([
      { id: 's1', epic_id: 'e1', points: 3, sprint_id: 'sprint-1', rank: 0 },
      { id: 's2', epic_id: 'e1', points: 5, sprint_id: null, rank: 1 }
    ]);
    expect(db.prepare("SELECT name FROM pragma_table_info('stories') WHERE name = 'in_sprint'").all()).toEqual([]);
    expect(db.prepare('SELECT id, story_id, done FROM criteria ORDER BY id').all()).toEqual([
      { id: 'c1', story_id: 's1', done: 1 },
      { id: 'c2', story_id: 's1', done: 0 },
      { id: 'c3', story_id: 's2', done: 0 }
    ]);
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);

    db.exec("UPDATE stories SET epic_id = NULL WHERE id = 's2'");
    db.exec("DELETE FROM stories WHERE id = 's2'");
    expect(db.prepare("SELECT COUNT(*) AS count FROM criteria WHERE story_id = 's2'").get()).toEqual({ count: 0 });
  });
});

describe('migration 007', () => {
  it('keeps every story and gives it no release', () => {
    const db = openDatabase();
    migrate(db, MIGRATIONS.slice(0, 6));
    db.exec(`
      INSERT INTO stories (id, code, title, description, epic_id, points, status, rank)
        VALUES ('s1', 'S-1', 'First', '', NULL, 3, 'todo', 0), ('s2', 'S-2', 'Second', '', NULL, 5, 'done', 1);
    `);

    migrate(db, MIGRATIONS.slice(6));

    expect(db.prepare('SELECT id, points, release_id FROM stories ORDER BY rank').all()).toEqual([
      { id: 's1', points: 3, release_id: null },
      { id: 's2', points: 5, release_id: null }
    ]);
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('refuses a story that points to a release that does not exist', () => {
    const db = openDatabase();
    migrate(db, MIGRATIONS);
    expect(() =>
      db.exec("INSERT INTO stories (id, code, title, description, points, status, rank, release_id) VALUES ('s1', 'S-1', 'A', '', 1, 'todo', 0, 'nope')")
    ).toThrow();
  });
});

describe('settings', () => {
  it('starts with the default and keeps the rows of the story map', async () => {
    const { repository } = await freshRepository();
    expect((await repository.load()).settings).toEqual({ mapRows: 'sprints' });
    await repository.saveSettings({ mapRows: 'releases' });
    expect((await repository.load()).settings).toEqual({ mapRows: 'releases' });
    await repository.saveSettings({ mapRows: 'sprints' });
    expect((await repository.load()).settings.mapRows).toBe('sprints');
  });

  it('falls back to the default for a value it does not know', async () => {
    const { db, repository } = await freshRepository();
    db.exec("INSERT INTO settings (key, value) VALUES ('map_rows', 'nonsense') ON CONFLICT (key) DO UPDATE SET value = 'nonsense'");
    expect((await repository.load()).settings.mapRows).toBe('sprints');
  });

  it('saves the release of a story that was moved on the map', async () => {
    const { repository } = await freshRepository();
    const story = (await repository.load()).stories.find((item) => item.id === 'story-7');
    if (!story) throw new Error('story missing');
    await repository.savePositions([{ ...story, releaseId: 'release-beta' }]);
    expect((await repository.load()).stories.find((item) => item.id === 'story-7')?.releaseId).toBe('release-beta');
  });
});

describe('releases', () => {
  it('stores the demo releases with the release of each story', async () => {
    const { repository } = await freshRepository();
    const snapshot = await repository.load();
    expect(snapshot.releases.map((release) => release.id)).toEqual(['release-beta', 'release-map']);
    expect(snapshot.releases[1]).toMatchObject({ startDate: null, endDate: null });
    expect(snapshot.stories.find((story) => story.id === 'story-1')?.releaseId).toBe('release-beta');
    expect(snapshot.stories.find((story) => story.id === 'story-7')?.releaseId).toBe('release-map');
  });

  it('adds, changes and keeps a release with and without dates', async () => {
    const { repository } = await freshRepository();
    await repository.addRelease({ id: 'r3', title: 'Release 1.2', description: '', startDate: '2026-12-01', endDate: null });
    await repository.updateRelease({ id: 'r3', title: 'Release 1.2 – Fixes', description: 'Text', startDate: null, endDate: '2026-12-31' });
    const release = (await repository.load()).releases.find((item) => item.id === 'r3');
    expect(release).toEqual({ id: 'r3', title: 'Release 1.2 – Fixes', description: 'Text', startDate: null, endDate: '2026-12-31' });
  });

  it('saves the release of a story and clears it', async () => {
    const { repository } = await freshRepository();
    const story = (await repository.load()).stories.find((item) => item.id === 'story-7');
    if (!story) throw new Error('story missing');
    await repository.updateStory({ ...story, releaseId: 'release-beta' });
    expect((await repository.load()).stories.find((item) => item.id === 'story-7')?.releaseId).toBe('release-beta');
    await repository.updateStory({ ...story, releaseId: null });
    expect((await repository.load()).stories.find((item) => item.id === 'story-7')?.releaseId).toBeNull();
  });

  it('deletes a release and keeps its stories without a release', async () => {
    const { db, repository } = await freshRepository();
    const before = await repository.load();
    const inRelease = before.stories.filter((story) => story.releaseId === 'release-beta').length;
    expect(inRelease).toBeGreaterThan(0);
    await repository.deleteRelease('release-beta');
    const after = await repository.load();
    expect(after.releases.map((release) => release.id)).toEqual(['release-map']);
    expect(after.stories).toHaveLength(before.stories.length);
    expect(after.stories.filter((story) => story.releaseId === 'release-beta')).toEqual([]);
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('adds the title and description of releases to a library of release 0.2', async () => {
    const { db, repository } = await freshRepository();
    db.exec("DELETE FROM field_assignments WHERE item_type = 'release'");
    const snapshot = await repository.load();
    const releaseFields = snapshot.assignments.filter((item) => item.itemType === 'release').map((item) => item.fieldId);
    expect(releaseFields.sort()).toEqual(['field-description', 'field-end', 'field-start', 'field-title']);
  });
});

describe('migrations 005 and 006', () => {
  it('keep custom fields and their values of stage 1 and 2', () => {
    const db = openDatabase();
    migrate(db, MIGRATIONS.slice(0, 4));
    db.exec(`
      INSERT INTO epics (id, name, color_key) VALUES ('e1', 'Boards', 'boards');
      INSERT INTO stories (id, code, title, description, epic_id, points, status, rank)
        VALUES ('s1', 'S-1', 'First', '', 'e1', 3, 'todo', 0);
      INSERT INTO field_definitions (id, builtin_key, kind, data_type, label) VALUES
        ('risk', NULL, 'custom', 'single_select', 'Risk'),
        ('note', NULL, 'custom', 'text', 'Note'),
        ('value', NULL, 'custom', 'number', 'Value');
      INSERT INTO field_options (id, field_id, label, color_key, position) VALUES ('high', 'risk', 'High', 'rose', 0);
      INSERT INTO field_assignments (item_type, field_id, position) VALUES ('story', 'risk', 10), ('epic', 'risk', 10), ('story', 'note', 11);
      INSERT INTO field_values (item_id, field_id, text_value, number_value, option_id) VALUES
        ('s1', 'risk', NULL, NULL, 'high'),
        ('s1', 'note', 'Keep me', NULL, NULL),
        ('s1', 'value', NULL, 8, NULL),
        ('e1', 'risk', NULL, NULL, 'high');
    `);

    migrate(db, MIGRATIONS.slice(4));

    expect(db.prepare('SELECT id, default_value FROM field_definitions ORDER BY id').all()).toEqual([
      { id: 'note', default_value: null },
      { id: 'risk', default_value: null },
      { id: 'value', default_value: null }
    ]);
    expect(db.prepare('SELECT item_id, field_id, text_value, number_value, option_id, date_value FROM field_values ORDER BY item_id, field_id').all()).toEqual([
      { item_id: 'e1', field_id: 'risk', text_value: null, number_value: null, option_id: 'high', date_value: null },
      { item_id: 's1', field_id: 'note', text_value: 'Keep me', number_value: null, option_id: null, date_value: null },
      { item_id: 's1', field_id: 'risk', text_value: null, number_value: null, option_id: 'high', date_value: null },
      { item_id: 's1', field_id: 'value', text_value: null, number_value: 8, option_id: null, date_value: null }
    ]);
    expect(db.prepare('SELECT COUNT(*) AS count FROM field_assignments').get()).toEqual({ count: 3 });
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('let the repository read the values of an upgraded database', async () => {
    const db = openDatabase();
    migrate(db, MIGRATIONS.slice(0, 4));
    db.exec(`
      INSERT INTO stories (id, code, title, description, epic_id, points, status, rank) VALUES ('s1', 'S-1', 'First', '', NULL, 3, 'todo', 0);
      INSERT INTO field_definitions (id, builtin_key, kind, data_type, label) VALUES ('value', NULL, 'custom', 'number', 'Value');
      INSERT INTO field_assignments (item_type, field_id, position) VALUES ('story', 'value', 10);
      INSERT INTO field_values (item_id, field_id, number_value) VALUES ('s1', 'value', 8);
    `);
    migrate(db, MIGRATIONS.slice(4));
    const snapshot = await new SqliteRepository(new NodeDatabase(db)).load();
    expect(snapshot.stories[0].values).toEqual({ value: 8 });
    expect(snapshot.fields.find((field) => field.id === 'value')?.defaultValue).toBeNull();
    expect(snapshot.fields.some((field) => field.builtinKey === 'points')).toBe(true);
  });
});

describe('SqliteRepository', () => {
  it('stores the demo data with its fields and values', async () => {
    const { repository } = await freshRepository();
    const snapshot = await repository.load();
    const seed = seedSnapshot('2026-10-11');
    expect(snapshot.fields).toEqual(seed.fields);
    expect(snapshot.assignments.sort((a, b) => a.fieldId.localeCompare(b.fieldId) || a.itemType.localeCompare(b.itemType))).toEqual(
      seed.assignments.sort((a, b) => a.fieldId.localeCompare(b.fieldId) || a.itemType.localeCompare(b.itemType))
    );
    expect(snapshot.stories.find((story) => story.id === 'story-1')?.values).toEqual({
      'field-demo-priority': 'opt-must',
      'field-demo-value': 8,
      'field-demo-labels': ['opt-ui'],
      'field-demo-spec': 'https://github.com/goerks/GetThingsDone/issues/4'
    });
    expect(snapshot.stories.find((story) => story.id === 'story-6')?.values['field-demo-labels']).toEqual(['opt-ui', 'opt-a11y']);
  });

  it('adds missing built-in fields when loading an existing database', async () => {
    const db = openDatabase();
    migrate(db, MIGRATIONS);
    const repository = new SqliteRepository(new NodeDatabase(db));
    const snapshot = await repository.load();
    expect(snapshot.fields.map((field) => field.id)).toContain(builtinFieldId('points'));
    expect(db.prepare('SELECT COUNT(*) AS count FROM field_definitions').get()).toEqual({ count: snapshot.fields.length });
    expect((await repository.load()).fields).toEqual(snapshot.fields);
  });

  it('saves a story without an epic', async () => {
    const { repository } = await freshRepository();
    const story = (await repository.load()).stories[0];
    await repository.updateStory({ ...story, epicId: null });
    expect((await repository.load()).stories[0].epicId).toBeNull();
  });

  it('sets, changes and clears values of every type', async () => {
    const { repository } = await freshRepository();
    await repository.saveField({ id: 'notes', builtinKey: null, kind: 'custom', dataType: 'long_text', label: 'Notes', options: [], defaultValue: null });
    await repository.setFieldValue('story-7', 'notes', 'Line one\nLine two');
    await repository.setFieldValue('story-7', 'field-demo-value', 2.5);
    await repository.setFieldValue('story-7', 'field-demo-priority', 'opt-could');
    expect((await repository.load()).stories.find((story) => story.id === 'story-7')?.values).toEqual({
      notes: 'Line one\nLine two',
      'field-demo-value': 2.5,
      'field-demo-priority': 'opt-could'
    });
    await repository.setFieldValue('story-7', 'field-demo-value', null);
    await repository.setFieldValue('story-7', 'notes', 'Changed');
    expect((await repository.load()).stories.find((story) => story.id === 'story-7')?.values).toEqual({
      notes: 'Changed',
      'field-demo-priority': 'opt-could'
    });
  });

  it('renames options and deletes the values of removed options', async () => {
    const { repository } = await freshRepository();
    const priority = (await repository.load()).fields.find((field) => field.id === 'field-demo-priority');
    if (!priority) throw new Error('demo field missing');
    await repository.saveField({
      ...priority,
      label: 'Importance',
      options: [
        { id: 'opt-should', label: 'Should have', colorKey: 'amber' },
        { id: 'opt-must', label: 'Must have', colorKey: 'rose' }
      ]
    });
    const snapshot = await repository.load();
    const saved = snapshot.fields.find((field) => field.id === 'field-demo-priority');
    expect(saved?.label).toBe('Importance');
    expect(saved?.options.map((option) => option.label)).toEqual(['Should have', 'Must have']);
    expect(snapshot.stories.find((story) => story.id === 'story-6')?.values).toEqual({
      'field-demo-value': 2,
      'field-demo-labels': ['opt-ui', 'opt-a11y']
    });
    expect(snapshot.stories.find((story) => story.id === 'story-1')?.values['field-demo-priority']).toBe('opt-must');
  });

  it('stores dates, checkboxes, links and multi selects and clears them', async () => {
    const { repository } = await freshRepository();
    await repository.saveField({ id: 'due', builtinKey: null, kind: 'custom', dataType: 'date', label: 'Due', options: [], defaultValue: null });
    await repository.saveField({ id: 'ok', builtinKey: null, kind: 'custom', dataType: 'checkbox', label: 'OK', options: [], defaultValue: true });
    await repository.setFieldValue('story-7', 'due', '2026-12-24');
    await repository.setFieldValue('story-7', 'ok', true);
    await repository.setFieldValue('story-7', 'field-demo-labels', ['opt-a11y', 'opt-ui']);
    await repository.setFieldValue('story-7', 'field-demo-spec', 'https://example.com/');
    let values = (await repository.load()).stories.find((story) => story.id === 'story-7')?.values;
    // Options come back in the order of the field's options.
    expect(values).toEqual({ due: '2026-12-24', ok: true, 'field-demo-labels': ['opt-ui', 'opt-a11y'], 'field-demo-spec': 'https://example.com/' });
    expect((await repository.load()).fields.find((field) => field.id === 'ok')?.defaultValue).toBe(true);

    await repository.setFieldValue('story-7', 'field-demo-labels', ['opt-data']);
    await repository.setFieldValue('story-7', 'ok', null);
    values = (await repository.load()).stories.find((story) => story.id === 'story-7')?.values;
    expect(values).toEqual({ due: '2026-12-24', 'field-demo-labels': ['opt-data'], 'field-demo-spec': 'https://example.com/' });
  });

  it('moves values to the storage of their new type when a field changes type', async () => {
    const { repository } = await freshRepository();
    const priority = (await repository.load()).fields.find((field) => field.id === 'field-demo-priority');
    if (!priority) throw new Error('demo field missing');
    await repository.saveField({ ...priority, dataType: 'multi_select' });
    await repository.setFieldValue('story-1', 'field-demo-priority', ['opt-must']);
    const snapshot = await repository.load();
    expect(snapshot.fields.find((field) => field.id === 'field-demo-priority')?.dataType).toBe('multi_select');
    expect(snapshot.stories.find((story) => story.id === 'story-1')?.values['field-demo-priority']).toEqual(['opt-must']);
  });

  it('keeps every value for each allowed type change', async () => {
    const { repository } = await freshRepository();
    const field = (id: string, dataType: CustomDataType): FieldDefinition => ({ id, builtinKey: null, kind: 'custom', dataType, label: id, options: [], defaultValue: null });
    await repository.saveField(field('note', 'text'));
    await repository.saveField(field('num', 'number'));
    await repository.saveField(field('due', 'date'));
    await repository.saveField(field('link', 'url'));
    await repository.setFieldValue('story-7', 'note', 'Line');
    await repository.setFieldValue('story-7', 'num', 2.5);
    await repository.setFieldValue('story-7', 'due', '2026-12-24');
    await repository.setFieldValue('story-7', 'link', 'https://example.com/');

    // The app saves the field, then writes each converted value so it moves to the storage of the new type.
    const changes: Array<[string, CustomDataType]> = [['note', 'long_text'], ['num', 'text'], ['due', 'text'], ['link', 'text']];
    const story = (await repository.load()).stories.find((item) => item.id === 'story-7');
    for (const [id, dataType] of changes) {
      await repository.saveField(field(id, dataType));
      await repository.setFieldValue('story-7', id, convertValue(story?.values[id] ?? '', dataType));
    }

    const snapshot = await repository.load();
    expect(snapshot.stories.find((story) => story.id === 'story-7')?.values).toMatchObject({
      note: 'Line',
      num: '2.5',
      due: '2026-12-24',
      link: 'https://example.com/'
    });
    expect(snapshot.fields.filter((item) => ['note', 'num', 'due', 'link'].includes(item.id)).map((item) => item.dataType)).toEqual([
      'long_text',
      'text',
      'text',
      'text'
    ]);
  });

  it('never deletes a system or built-in field', async () => {
    const { db, repository } = await freshRepository();
    const before = await repository.load();
    const points = before.fields.find((field) => field.builtinKey === 'points');
    if (!points) throw new Error('points field missing');
    await repository.saveField({ ...points, label: 'Effort' });
    for (const field of before.fields.filter((item) => item.kind !== 'custom')) {
      await repository.deleteField(field.id);
    }
    expect(db.prepare("SELECT COUNT(*) AS count FROM field_definitions WHERE kind <> 'custom'").get()).toEqual({
      count: before.fields.filter((item) => item.kind !== 'custom').length
    });
    const after = await repository.load();
    expect(after.fields.find((field) => field.id === points.id)?.label).toBe('Effort');
    const lockedIds = new Set(before.fields.filter((item) => item.kind !== 'custom').map((item) => item.id));
    const locked = (snapshot: typeof before) => snapshot.assignments.filter((item) => lockedIds.has(item.fieldId));
    expect(locked(after)).toEqual(locked(before));
  });

  it('stores default values of fields', async () => {
    const { repository } = await freshRepository();
    await repository.saveField({ id: 'n', builtinKey: null, kind: 'custom', dataType: 'number', label: 'N', options: [], defaultValue: 2.5 });
    await repository.saveField({ id: 't', builtinKey: null, kind: 'custom', dataType: 'text', label: 'T', options: [], defaultValue: 'ACME' });
    const fields = (await repository.load()).fields;
    expect(fields.find((field) => field.id === 'n')?.defaultValue).toBe(2.5);
    expect(fields.find((field) => field.id === 't')?.defaultValue).toBe('ACME');
    expect(fields.find((field) => field.id === 'field-demo-priority')?.defaultValue).toBe('opt-should');
    expect(fields.find((field) => field.builtinKey === 'title')?.defaultValue).toBeNull();
  });

  it('replaces the assignments of a field', async () => {
    const { repository } = await freshRepository();
    await repository.saveAssignments('field-demo-value', []);
    const snapshot = await repository.load();
    expect(snapshot.assignments.some((item) => item.fieldId === 'field-demo-value')).toBe(false);
    expect(snapshot.stories.find((story) => story.id === 'story-1')?.values['field-demo-value']).toBe(8);
  });

  it('keeps the label and hidden state of a built-in field', async () => {
    const { repository } = await freshRepository();
    const before = await repository.load();
    const points = before.fields.find((field) => field.builtinKey === 'points');
    if (!points) throw new Error('points field missing');
    await repository.saveField({ ...points, label: 'Effort' });
    await repository.saveAssignments(
      points.id,
      before.assignments.filter((item) => item.fieldId === points.id).map((item) => ({ ...item, hidden: true }))
    );
    const after = await repository.load();
    expect(after.fields.find((field) => field.id === points.id)?.label).toBe('Effort');
    expect(after.assignments.find((item) => item.fieldId === points.id && item.itemType === 'story')?.hidden).toBe(true);
    expect(after.stories.find((story) => story.id === 'story-1')?.points).toBe(before.stories.find((story) => story.id === 'story-1')?.points);
  });

  it('deletes a field with its options, assignments and values', async () => {
    const { db, repository } = await freshRepository();
    await repository.deleteField('field-demo-priority');
    const snapshot = await repository.load();
    expect(snapshot.fields.some((field) => field.id === 'field-demo-priority')).toBe(false);
    expect(snapshot.stories.every((story) => story.values['field-demo-priority'] === undefined)).toBe(true);
    expect(db.prepare("SELECT COUNT(*) AS count FROM field_options WHERE field_id = 'field-demo-priority'").get()).toEqual({ count: 0 });
  });

  it('stores values of epics and deletes them with the epic', async () => {
    const { db, repository } = await freshRepository();
    expect((await repository.load()).epics.find((epic) => epic.id === 'epic-boards')?.values).toEqual({
      'field-demo-priority': 'opt-must'
    });
    await repository.addEpic({ id: 'epic-empty', name: 'Empty', colorKey: 'cyan', position: 4, values: { 'field-demo-priority': 'opt-should' } });
    await repository.setFieldValue('epic-empty', 'field-demo-priority', 'opt-could');
    expect((await repository.load()).epics.find((epic) => epic.id === 'epic-empty')?.values).toEqual({
      'field-demo-priority': 'opt-could'
    });
    await repository.deleteEpic('epic-empty');
    expect(db.prepare("SELECT COUNT(*) AS count FROM field_values WHERE item_id = 'epic-empty'").get()).toEqual({ count: 0 });
  });

  it('deletes the values of a deleted story', async () => {
    const { db, repository } = await freshRepository();
    await repository.deleteStory('story-1');
    expect(db.prepare("SELECT COUNT(*) AS count FROM field_values WHERE item_id = 'story-1'").get()).toEqual({ count: 0 });
  });
});

describe('history of releases', () => {
  it('migration 009 keeps the releases and stories and starts without a history', () => {
    const db = openDatabase();
    migrate(db, MIGRATIONS.slice(0, 8));
    db.exec("INSERT INTO releases (id, title, description) VALUES ('r1', 'One', '')");
    db.exec("INSERT INTO stories (id, code, title, description, points, status, rank, release_id) VALUES ('s1', 'S-1', 'A', '', 3, 'todo', 0, 'r1')");
    migrate(db, MIGRATIONS.slice(8));
    expect(db.prepare('SELECT release_id FROM stories').all()).toEqual([{ release_id: 'r1' }]);
    expect(db.prepare('SELECT COUNT(*) AS count FROM release_events').get()).toEqual({ count: 0 });
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('stores the demo history and returns it in order', async () => {
    const { repository } = await freshRepository();
    const events = (await repository.load()).events;
    expect(events.filter((event) => event.releaseId === 'release-beta')).toHaveLength(10);
    expect(events.map((event) => event.at)).toEqual([...events.map((event) => event.at)].sort());
    expect(events.find((event) => event.id === 'event-demo-7')).toMatchObject({ kind: 'done', storyId: 'story-5', code: 'S-5', points: 3, done: true });
  });

  it('appends entries and keeps one for a story that no longer exists', async () => {
    const { repository } = await freshRepository();
    await repository.addReleaseEvents([
      { id: 'e1', at: '2099-01-01T10:00:00.000Z', releaseId: 'release-map', storyId: 'gone', code: 'S-99', kind: 'removed', points: 5, done: false }
    ]);
    const added = (await repository.load()).events.find((event) => event.id === 'e1');
    expect(added).toMatchObject({ storyId: 'gone', code: 'S-99', done: false });
  });

  it('deletes the history of a release with the release', async () => {
    const { db, repository } = await freshRepository();
    await repository.deleteRelease('release-beta');
    expect((await repository.load()).events.every((event) => event.releaseId !== 'release-beta')).toBe(true);
    expect(db.prepare("SELECT COUNT(*) AS count FROM release_events WHERE release_id = 'release-beta'").get()).toEqual({ count: 0 });
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('refuses an entry for a release that does not exist', async () => {
    const { repository } = await freshRepository();
    await expect(
      repository.addReleaseEvents([{ id: 'e2', at: '2099-01-01T10:00:00.000Z', releaseId: 'nope', storyId: 's', code: 'S-1', kind: 'added', points: 1, done: false }])
    ).rejects.toThrow();
  });
});
