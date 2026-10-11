// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { builtinFieldId } from '../domain/fields';
import { seedSnapshot } from './seed';
import { SqliteRepository, type SqlDatabase } from './sqliteRepository';

const MIGRATIONS = ['001_init.sql', '002_epic_palette.sql', '003_sprints.sql', '004_custom_fields.sql', '005_field_defaults.sql', '006_more_field_types.sql'];

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
