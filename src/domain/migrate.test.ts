import { describe, expect, it } from 'vitest';
import { MIGRATED_SPRINT_ID, migrateSnapshot } from './migrate';

const story = (id: string, inSprint: boolean) => ({
  id,
  code: id,
  title: id,
  description: '',
  epicId: 'e1',
  points: 1,
  status: 'todo' as const,
  inSprint,
  rank: 0,
  criteria: []
});

describe('migrating a snapshot of release 0.1', () => {
  const old = {
    epics: [
      { id: 'e1', name: 'Boards', colorKey: 'boards' },
      { id: 'e2', name: 'Storage', colorKey: 'storage' }
    ],
    stories: [story('a', true), story('b', false)]
  };

  it('turns the fixed sprint into a real sprint running from today for two weeks', () => {
    const snapshot = migrateSnapshot(old, '2026-10-11');
    expect(snapshot.sprints).toEqual([
      { id: MIGRATED_SPRINT_ID, name: 'Sprint 1', startDate: '2026-10-11', endDate: '2026-10-24' }
    ]);
    expect(snapshot.stories.map((s) => [s.id, s.sprintId])).toEqual([
      ['a', MIGRATED_SPRINT_ID],
      ['b', null]
    ]);
    expect(snapshot.stories[0]).not.toHaveProperty('inSprint');
  });

  it('gives epics their list order as position and maps old colour keys', () => {
    const snapshot = migrateSnapshot(old, '2026-10-11');
    expect(snapshot.epics).toEqual([
      { id: 'e1', name: 'Boards', colorKey: 'blue', position: 0, values: {} },
      { id: 'e2', name: 'Storage', colorKey: 'teal', position: 1, values: {} }
    ]);
  });

  it('creates no sprint when no story was in the sprint', () => {
    expect(migrateSnapshot({ epics: [], stories: [story('b', false)] }, '2026-10-11').sprints).toEqual([]);
  });

  it('leaves a current snapshot unchanged', () => {
    const current = {
      epics: [{ id: 'e1', name: 'Boards', colorKey: 'rose', position: 3 }],
      sprints: [{ id: 's9', name: 'Sprint 9', startDate: '2026-10-01', endDate: '2026-10-14' }],
      stories: [{ ...story('a', false), inSprint: undefined, sprintId: 's9' }]
    };
    const snapshot = migrateSnapshot(current, '2026-10-11');
    expect(snapshot.sprints).toEqual(current.sprints);
    expect(snapshot.epics[0]).toEqual({ id: 'e1', name: 'Boards', colorKey: 'rose', position: 3, values: {} });
    expect(snapshot.stories[0].sprintId).toBe('s9');
  });
});
