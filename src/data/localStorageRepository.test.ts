import { describe, expect, it } from 'vitest';
import { LocalStorageRepository } from './localStorageRepository';
import { seedSnapshot } from './seed';
import { EMPTY_DEFINITIONS } from '../domain/definitions';


describe('LocalStorageRepository change log (#23)', () => {
  it('AC5.1 keeps the versions after a reload and applies writes', async () => {
    // Given the demo data with its demo history
    const repository = new LocalStorageRepository();
    const seeded = seedSnapshot('2026-10-11');
    await repository.replaceAll(seeded);
    const [first, second] = seeded.changeLog.filter((version) => version.itemId === 'story-3');
    // When a version is removed and one is replaced
    await repository.applyChangeLog({ upsert: [{ ...first, keys: ['title'] }], remove: [second.id] });
    // Then a new repository reads the result
    const loaded = (await new LocalStorageRepository().load()).changeLog;
    expect(loaded.some((version) => version.id === second.id)).toBe(false);
    expect(loaded.find((version) => version.id === first.id)?.keys).toEqual(['title']);
    expect(loaded).toHaveLength(seeded.changeLog.length - 1);
  });
});

describe('LocalStorageRepository', () => {
  it('never deletes a system or built-in field', async () => {
    const repository = new LocalStorageRepository();
    const seeded = await repository.load();
    const points = seeded.fields.find((field) => field.builtinKey === 'points');
    if (!points) throw new Error('points field missing');
    // A renamed field shows whether it was deleted and added back with its default label on load.
    await repository.saveField({ ...points, label: 'Effort' });
    const before = await repository.load();
    const locked = before.fields.filter((field) => field.kind !== 'custom');
    expect(locked.length).toBeGreaterThan(0);
    for (const field of locked) {
      await repository.deleteField(field.id);
    }
    const after = await repository.load();
    expect(after.fields).toEqual(before.fields);
    expect(after.assignments).toEqual(before.assignments);
  });

  it('deletes a custom field with its assignments and values', async () => {
    const repository = new LocalStorageRepository();
    await repository.deleteField('field-demo-priority');
    const after = await repository.load();
    expect(after.fields.some((field) => field.id === 'field-demo-priority')).toBe(false);
    expect(after.assignments.some((item) => item.fieldId === 'field-demo-priority')).toBe(false);
    expect([...after.stories, ...after.epics].every((item) => item.values['field-demo-priority'] === undefined)).toBe(true);
  });

  it('keeps a renamed and hidden built-in field', async () => {
    const repository = new LocalStorageRepository();
    const before = await repository.load();
    const points = before.fields.find((field) => field.builtinKey === 'points');
    if (!points) throw new Error('points field missing');
    await repository.saveField({ ...points, label: 'Effort' });
    await repository.saveAssignments(
      points.id,
      before.assignments.filter((item) => item.fieldId === points.id).map((item) => ({ ...item, hidden: true }))
    );
    const after = await new LocalStorageRepository().load();
    expect(after.fields.find((field) => field.id === points.id)?.label).toBe('Effort');
    expect(after.assignments.find((item) => item.fieldId === points.id)?.hidden).toBe(true);
  });

  it('stores releases, assigns stories and frees them when a release is deleted', async () => {
    const repository = new LocalStorageRepository();
    await repository.replaceAll(seedSnapshot('2026-10-12'));
    await repository.addRelease({ id: 'r3', title: 'Release 1.2', description: '', startDate: null, endDate: null });
    const story = (await repository.load()).stories[0];
    await repository.updateStory({ ...story, releaseId: 'r3' });
    expect((await new LocalStorageRepository().load()).stories[0].releaseId).toBe('r3');
    await repository.updateRelease({ id: 'r3', title: 'Release 1.2 – Fixes', description: 'x', startDate: '2026-12-01', endDate: null });
    expect((await repository.load()).releases.find((release) => release.id === 'r3')?.title).toBe('Release 1.2 – Fixes');
    await repository.deleteRelease('r3');
    const after = await repository.load();
    expect(after.releases.some((release) => release.id === 'r3')).toBe(false);
    expect(after.stories[0].releaseId).toBeNull();
    expect(after.stories).toHaveLength(seedSnapshot('2026-10-12').stories.length);
  });

  it('migrates browser data without releases', async () => {
    window.localStorage.setItem(
      'getitdone.snapshot.v1',
      JSON.stringify({ epics: [], sprints: [], stories: [{ id: 's1', code: 'S-1', title: 'A', description: '', epicId: null, points: 1, status: 'todo', sprintId: null, rank: 0, criteria: [], values: {} }], fields: [], assignments: [] })
    );
    const snapshot = await new LocalStorageRepository().load();
    expect(snapshot.releases).toEqual([]);
    expect(snapshot.stories[0].releaseId).toBeNull();
    expect(snapshot.assignments.some((item) => item.itemType === 'release')).toBe(true);
  });

  it('keeps the settings and the release of a moved story', async () => {
    const repository = new LocalStorageRepository();
    await repository.replaceAll(seedSnapshot('2026-10-12'));
    await repository.saveSettings({ mapRows: 'releases', features: { releases: true, team: false, github: false }, github: { repo: '', lastSyncAt: null, write: false, conflict: 'remote', ignored: [] }, definitions: EMPTY_DEFINITIONS });
    const story = (await repository.load()).stories.find((item) => item.id === 'story-7');
    if (!story) throw new Error('story missing');
    await repository.savePositions([{ ...story, releaseId: 'release-beta' }]);
    const after = await new LocalStorageRepository().load();
    expect(after.settings).toEqual({ mapRows: 'releases', features: { releases: true, team: false, github: false }, github: { repo: '', lastSyncAt: null, write: false, conflict: 'remote', ignored: [] }, definitions: EMPTY_DEFINITIONS });
    expect(after.stories.find((item) => item.id === 'story-7')?.releaseId).toBe('release-beta');
  });

  it('appends history entries, keeps them after a reload and drops them with the release', async () => {
    const repository = new LocalStorageRepository();
    await repository.replaceAll(seedSnapshot('2026-10-12'));
    await repository.addReleaseEvents([{ id: 'e1', at: '2026-10-12T10:00:00.000Z', releaseId: 'release-map', storyId: 's', code: 'S-9', kind: 'added', points: 2, done: false }]);
    expect((await new LocalStorageRepository().load()).events.at(-1)?.id).toBe('e1');
    await repository.deleteRelease('release-map');
    expect((await repository.load()).events.some((event) => event.releaseId === 'release-map')).toBe(false);
  });

  it('migrates browser data without a history', async () => {
    window.localStorage.setItem('getitdone.snapshot.v1', JSON.stringify({ epics: [], sprints: [], stories: [], fields: [], assignments: [] }));
    expect((await new LocalStorageRepository().load()).events).toEqual([]);
  });

  it('AC5.1 gives an older snapshot the default status values and stores changed ones', async () => {
    const { statuses: _statuses, ...older } = seedSnapshot('2026-10-12');
    window.localStorage.setItem('getitdone.snapshot.v1', JSON.stringify(older));
    const repository = new LocalStorageRepository();
    expect((await repository.load()).statuses.map((status) => status.id)).toEqual(['todo', 'in_progress', 'review', 'done']);
    await repository.saveStatuses([
      { id: 'todo', label: 'Backlog', category: 'not_started' },
      { id: 'done', label: null, category: 'done' }
    ]);
    expect((await new LocalStorageRepository().load()).statuses).toEqual([
      { id: 'todo', label: 'Backlog', category: 'not_started' },
      { id: 'done', label: null, category: 'done' }
    ]);
  });

  it('AC1.1 stores the definitions with the settings and the states of a story with the story', async () => {
    // Given the demo data
    const repository = new LocalStorageRepository();
    await repository.replaceAll(seedSnapshot('2026-10-12'));
    const { settings } = await repository.load();
    // When a list is changed and a story gets states
    const definitions = { ...settings.definitions, done: { enforce: false, groups: [{ id: 'g1', name: '', items: [{ id: 'i1', text: 'Reviewed', rule: null, mayBeIrrelevant: false }] }] } };
    await repository.saveSettings({ ...settings, definitions });
    await repository.saveStoryChecks('story-1', { i1: 'checked' }, ['i1']);
    // Then both survive a reload
    const loaded = await repository.load();
    expect(loaded.settings.definitions).toEqual(definitions);
    expect(loaded.stories.find((story) => story.id === 'story-1')).toMatchObject({ checks: { i1: 'checked' }, doneItems: ['i1'] });
  });

  it('gives browser data of an earlier version stories without states', async () => {
    window.localStorage.setItem(
      'getitdone.snapshot.v1',
      JSON.stringify({ epics: [], sprints: [], stories: [{ id: 's1', code: 'S-1', title: 'A', description: '', epicId: null, points: 1, status: 'done', sprintId: null, rank: 0, criteria: [], values: {} }], fields: [], assignments: [] })
    );
    const snapshot = await new LocalStorageRepository().load();
    expect(snapshot.stories[0]).toMatchObject({ checks: {}, doneItems: null });
    expect(snapshot.settings.definitions).toEqual(EMPTY_DEFINITIONS);
  });

  it('AC5.4 saving positions with whole stories does not overwrite their states', async () => {
    // Given a story with states and a Done snapshot
    const repository = new LocalStorageRepository();
    await repository.replaceAll(seedSnapshot('2026-10-12'));
    const before = (await repository.load()).stories.find((item) => item.id === 'story-1');
    if (!before) throw new Error('story missing');
    await repository.saveStoryChecks('story-1', { i1: 'checked' }, ['i1']);
    // When positions are saved from a whole, older copy of the story, and the story is updated from it
    await repository.savePositions([{ ...before, rank: 9 }]);
    await repository.updateStory({ ...before, rank: 9, title: 'Renamed' });
    // Then the position and the title changed, the states did not
    const after = (await repository.load()).stories.find((item) => item.id === 'story-1');
    expect(after).toMatchObject({ rank: 9, title: 'Renamed', checks: { i1: 'checked' }, doneItems: ['i1'] });
  });
});
