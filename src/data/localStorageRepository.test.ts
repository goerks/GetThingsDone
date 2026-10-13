import { describe, expect, it } from 'vitest';
import { LocalStorageRepository } from './localStorageRepository';
import { seedSnapshot } from './seed';

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
    await repository.saveSettings({ mapRows: 'releases', features: { releases: true } });
    const story = (await repository.load()).stories.find((item) => item.id === 'story-7');
    if (!story) throw new Error('story missing');
    await repository.savePositions([{ ...story, releaseId: 'release-beta' }]);
    const after = await new LocalStorageRepository().load();
    expect(after.settings).toEqual({ mapRows: 'releases', features: { releases: true } });
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
});
