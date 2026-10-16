import { describe, expect, it } from 'vitest';
import {
  applyWrites,
  baselineWrites,
  changedKeys,
  compareStates,
  diffStates,
  recordStates,
  recordWorld,
  sameValue,
  statesOf,
  versionsOf,
  type ChangeVersion,
  type ItemState,
  type TrackedItem,
  type World
} from './changeLog';
import { seedSnapshot } from '../data/seed';
import { parseBackup, serializeBackup } from './backup';
import type { Epic, Release, Sprint, Story } from './types';

let counter = 0;
const newId = (): string => `v-${(counter += 1)}`;

const story = (id: string, overrides: Partial<Story> = {}): Story => ({
  id,
  code: id.toUpperCase(),
  title: `Story ${id}`,
  description: '',
  epicId: null,
  points: 3,
  status: 'todo',
  sprintId: null,
  releaseId: null,
  rank: 0,
  criteria: [],
  values: {},
  checks: {},
  doneItems: null,
  ...overrides
});
const epic = (id: string, overrides: Partial<Epic> = {}): Epic => ({ id, name: `Epic ${id}`, colorKey: 'blue', position: 0, values: {}, ...overrides });
const sprint = (id: string, overrides: Partial<Sprint> = {}): Sprint => ({
  id,
  name: `Sprint ${id}`,
  startDate: '2026-10-05',
  endDate: '2026-10-16',
  state: 'planned',
  startItems: null,
  result: null,
  ...overrides
});
const release = (id: string, overrides: Partial<Release> = {}): Release => ({ id, title: `Release ${id}`, description: '', startDate: null, endDate: null, ...overrides });
const world = (parts: Partial<World> = {}): World => ({ stories: [], epics: [], sprints: [], releases: [], ...parts });

/** Records the change from one world to the next at a time and applies it to the log. */
function step(log: ChangeVersion[], before: World, after: World, at: string): ChangeVersion[] {
  return applyWrites(log, recordWorld(log, before, after, at, newId));
}

const T0 = '2026-10-13T10:00:00.000Z';
const minutes = (n: number): string => new Date(Date.parse(T0) + n * 60_000).toISOString();

describe('change log: recording', () => {
  it('AC2.3 starts the history of a new story with a created version', () => {
    // Given no story
    // When a story is created
    const log = step([], world(), world({ stories: [story('s3', { title: 'Login-Seite' })] }), T0);
    // Then the story has one version, marked as created, holding its state
    const versions = versionsOf(log, 'story', 's3');
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ version: 1, origin: 'created', keys: [], at: T0 });
    expect(versions[0].state.title).toBe('Login-Seite');
  });

  it('AC1.3 records several changes of one save as one version', () => {
    // Given a story with a history
    const before = world({ stories: [story('s3', { title: 'Login-Seite', points: 3 })] });
    let log = step([], world(), before, T0);
    // When title and points change in one save
    const after = world({ stories: [story('s3', { title: 'Login-Seite mit Passwort-Reset', points: 5 })] });
    log = step(log, before, after, minutes(10));
    // Then there is one new version holding both changes
    const versions = versionsOf(log, 'story', 's3');
    expect(versions.map((v) => v.version)).toEqual([1, 2]);
    expect(versions[1].origin).toBe('changed');
    expect(versions[1].keys).toEqual(['title', 'points']);
  });

  it('AC2.1 records title, description, status, points, epic, sprint, release and custom fields of a story', () => {
    // Given a story
    const base = world({
      stories: [story('s3')],
      epics: [epic('e1', { name: 'Benutzerkonto' })],
      sprints: [sprint('sp5')],
      releases: [release('r1', { title: 'Version 1.0' })]
    });
    let log = step([], world({ epics: base.epics, sprints: base.sprints, releases: base.releases }), base, T0);
    // When every tracked field changes
    const changed = {
      ...base,
      stories: [
        story('s3', {
          title: 'Neu',
          description: 'Beschreibung',
          status: 'review',
          points: 5,
          epicId: 'e1',
          sprintId: 'sp5',
          releaseId: 'r1',
          values: { prio: 'high' }
        })
      ]
    };
    log = step(log, base, changed, minutes(30));
    // Then each change shows in the version, with old and new value
    const [first, second] = versionsOf(log, 'story', 's3');
    const changes = diffStates(first.state, second.state);
    expect(changes.map((change) => change.key)).toEqual(['title', 'status', 'points', 'epic', 'sprint', 'release', 'description', 'field:prio']);
    expect(changes.find((change) => change.key === 'epic')).toMatchObject({ kind: 'value', before: null, after: { id: 'e1', label: 'Benutzerkonto' } });
    expect(changes.find((change) => change.key === 'status')).toMatchObject({ before: 'todo', after: 'review' });
  });

  it('AC2.2 records criteria that are added, ticked and removed', () => {
    // Given a story with two criteria
    const one = { id: 'c1', text: 'Fehlermeldung bei falschem Passwort', done: false };
    const two = { id: 'c2', text: 'Passwort-Stärke-Anzeige', done: false };
    const before = world({ stories: [story('s3', { criteria: [one, two] })] });
    let log = step([], world(), before, T0);
    // When one is added, one is ticked and one is removed
    const after = world({ stories: [story('s3', { criteria: [{ ...one, done: true }, { id: 'c3', text: 'Passwort-Reset per E-Mail', done: false }] })] });
    log = step(log, before, after, minutes(5));
    // Then the version tells what happened to each
    const [v1, v2] = versionsOf(log, 'story', 's3');
    const [change] = diffStates(v1.state, v2.state);
    expect(change).toMatchObject({ key: 'criteria', kind: 'list' });
    if (change.kind !== 'list') throw new Error('list expected');
    expect(change.added.map((entry) => entry.text)).toEqual(['Passwort-Reset per E-Mail']);
    expect(change.ticked.map((entry) => entry.id)).toEqual(['c1']);
    expect(change.removed.map((entry) => entry.id)).toEqual(['c2']);
  });

  it('AC2.4 records the name and colour of an epic', () => {
    // Given an epic
    const before = world({ epics: [epic('e1', { name: 'Benutzerkonto', colorKey: 'blue' })] });
    let log = step([], world(), before, T0);
    // When it is renamed and gets another colour
    log = step(log, before, world({ epics: [epic('e1', { name: 'Konto', colorKey: 'teal' })] }), minutes(1));
    // Then both are in the new version
    const versions = versionsOf(log, 'epic', 'e1');
    expect(versions[1].keys).toEqual(['title', 'color']);
  });

  it('AC2.5 records the stories that join and leave a sprint, and the dates and state of the sprint', () => {
    // Given a planned sprint and a story outside of it
    const plain = world({ stories: [story('s3', { points: 5 })], sprints: [sprint('sp5')] });
    let log = step([], world(), plain, T0);
    // When the story is planned in the sprint
    const planned = world({ stories: [story('s3', { points: 5, sprintId: 'sp5' })], sprints: [sprint('sp5')] });
    log = step(log, plain, planned, minutes(60));
    // Then the sprint has a version that lists the story, and the story one that names the sprint
    const sprintVersions = versionsOf(log, 'sprint', 'sp5');
    expect(sprintVersions).toHaveLength(2);
    const [change] = diffStates(sprintVersions[0].state, sprintVersions[1].state);
    expect(change).toMatchObject({ key: 'stories', kind: 'list' });
    if (change.kind !== 'list') throw new Error('list expected');
    expect(change.added).toEqual([{ id: 's3', text: 'S3', points: 5 }]);
    expect(versionsOf(log, 'story', 's3')[1].keys).toEqual(['sprint']);
    // When the end date moves and the sprint is started
    const running = world({ stories: planned.stories, sprints: [sprint('sp5', { endDate: '2026-10-17', state: 'running' })] });
    log = step(log, planned, running, minutes(120));
    expect(versionsOf(log, 'sprint', 'sp5')[2].keys).toEqual(['end', 'state']);
    // When the story leaves the sprint again
    const left = world({ stories: [story('s3', { points: 5, sprintId: null })], sprints: running.sprints });
    log = step(log, running, left, minutes(180));
    const last = versionsOf(log, 'sprint', 'sp5')[3];
    const removal = diffStates(versionsOf(log, 'sprint', 'sp5')[2].state, last.state)[0];
    expect(removal).toMatchObject({ key: 'stories', kind: 'list' });
    if (removal.kind !== 'list') throw new Error('list expected');
    expect(removal.removed.map((entry) => entry.text)).toEqual(['S3']);
  });

  it('AC2.6 records title, description and dates of a release', () => {
    // Given a release
    const before = world({ releases: [release('r1', { title: 'Version 1.0' })] });
    let log = step([], world(), before, T0);
    // When title, description and end date change
    log = step(log, before, world({ releases: [release('r1', { title: 'Version 1.1', description: 'Neu', endDate: '2026-12-01' })] }), minutes(1));
    // Then the version names the three fields
    expect(versionsOf(log, 'release', 'r1')[1].keys).toEqual(['title', 'description', 'end']);
  });

  it('AC3.3 does not record a pure reordering', () => {
    // Given two stories in one column and a story with two criteria
    const c1 = { id: 'c1', text: 'a', done: false };
    const c2 = { id: 'c2', text: 'b', done: false };
    const before = world({ stories: [story('s3', { rank: 0, criteria: [c1, c2] }), story('s4', { rank: 1 })] });
    let log = step([], world(), before, T0);
    // When the story moves below the other one and the criteria swap places
    const after = world({ stories: [story('s3', { rank: 1, criteria: [c2, c1] }), story('s4', { rank: 0 })] });
    log = step(log, before, after, minutes(5));
    // Then no new version exists
    expect(versionsOf(log, 'story', 's3')).toHaveLength(1);
    expect(versionsOf(log, 'story', 's4')).toHaveLength(1);
  });

  it('AC3.1 records a move to another status as a status change', () => {
    // Given a story in progress
    const before = world({ stories: [story('s3', { status: 'in_progress' })] });
    let log = step([], world(), before, T0);
    // When it moves to review
    log = step(log, before, world({ stories: [story('s3', { status: 'review' })] }), minutes(2));
    // Then the version is a change of the status
    const versions = versionsOf(log, 'story', 's3');
    expect(versions[1].keys).toEqual(['status']);
  });

  it('AC3.4 merges quick edits of the same field into one version', () => {
    // Given a story that was changed a while ago
    const a = world({ stories: [story('s3', { title: 'Alt' })] });
    let log = step([], world(), a, T0);
    const b = world({ stories: [story('s3', { title: 'Login' })] });
    log = step(log, a, b, minutes(10));
    // When the title is typed on within a minute
    const c = world({ stories: [story('s3', { title: 'Login-Seite neu' })] });
    log = step(log, b, c, new Date(Date.parse(minutes(10)) + 30_000).toISOString());
    // Then there is still one version for the edit, from the old to the final title
    const versions = versionsOf(log, 'story', 's3');
    expect(versions).toHaveLength(2);
    expect(versions[1].state.title).toBe('Login-Seite neu');
    expect(versions[1].keys).toEqual(['title']);
  });

  it('AC3.4 starts a new version after a minute, or for another field', () => {
    // Given a change of the title
    const a = world({ stories: [story('s3', { title: 'Alt', points: 3 })] });
    let log = step([], world(), a, T0);
    const b = world({ stories: [story('s3', { title: 'Neu', points: 3 })] });
    log = step(log, a, b, minutes(10));
    // When the title changes again after a minute, and the points a few seconds later
    const c = world({ stories: [story('s3', { title: 'Neuer', points: 3 })] });
    log = step(log, b, c, new Date(Date.parse(minutes(10)) + 61_000).toISOString());
    const d = world({ stories: [story('s3', { title: 'Neuer', points: 5 })] });
    log = step(log, c, d, new Date(Date.parse(minutes(10)) + 65_000).toISOString());
    // Then each is its own version
    expect(versionsOf(log, 'story', 's3').map((v) => v.keys)).toEqual([[], ['title'], ['title'], ['points']]);
  });

  it('AC3.4 drops a version when quick edits end where they started', () => {
    // Given a story and a change of the title
    const a = world({ stories: [story('s3', { title: 'Alt' })] });
    let log = step([], world(), a, T0);
    const b = world({ stories: [story('s3', { title: 'Neu' })] });
    log = step(log, a, b, minutes(10));
    // When the title is set back within a minute
    log = step(log, b, a, new Date(Date.parse(minutes(10)) + 20_000).toISOString());
    // Then the change is gone from the history
    expect(versionsOf(log, 'story', 's3')).toHaveLength(1);
  });

  it('AC5.3 deletes the history of a deleted item and keeps the entry of the sprint', () => {
    // Given a story in a sprint
    const before = world({ stories: [story('s9', { sprintId: 'sp5' })], sprints: [sprint('sp5')] });
    let log = step([], world(), before, T0);
    // When the story is deleted
    log = step(log, before, world({ sprints: [sprint('sp5')] }), minutes(5));
    // Then its versions are gone and the sprint names it as removed
    expect(versionsOf(log, 'story', 's9')).toHaveLength(0);
    const sprintVersions = versionsOf(log, 'sprint', 'sp5');
    expect(sprintVersions).toHaveLength(2);
    const [change] = diffStates(sprintVersions[0].state, sprintVersions[1].state);
    expect(change).toMatchObject({ key: 'stories', kind: 'list' });
    expect(sprintVersions[0].state.stories).toEqual([{ id: 's9', text: 'S9', points: 3 }]);
  });

  it('records nothing for changes of fields that are not tracked', () => {
    // Given a story
    const before = world({ stories: [story('s3')] });
    let log = step([], world(), before, T0);
    // When only rank, checks and done items change
    log = step(log, before, world({ stories: [story('s3', { rank: 4, checks: { x: 'checked' }, doneItems: ['x'] })] }), minutes(1));
    // Then there is no new version
    expect(versionsOf(log, 'story', 's3')).toHaveLength(1);
  });

  it('gives items older than the history a baseline version, once', () => {
    // Given a world without a log
    const items = statesOf(world({ stories: [story('s3')], epics: [epic('e1')] }));
    // When the baseline is written
    const writes = baselineWrites([], items, T0, newId);
    // Then each item has a baseline version
    expect(writes.upsert.map((v) => [v.itemType, v.origin, v.version])).toEqual([
      ['story', 'baseline', 1],
      ['epic', 'baseline', 1]
    ]);
    // And a second run adds nothing
    expect(baselineWrites(applyWrites([], writes), items, T0, newId).upsert).toHaveLength(0);
  });
});

describe('change log: any item type', () => {
  it('AC6.1 records and compares an item type the log knows nothing about', () => {
    // Given a made-up item type "initiative" with two fields, described only by its states
    const initiative = (title: string, owner: string | null): Map<string, TrackedItem> =>
      new Map([['initiative:i1', { itemType: 'initiative', itemId: 'i1', state: { title, 'field:owner': owner } as ItemState }]]);
    let log: ChangeVersion[] = [];
    log = applyWrites(log, recordStates(log, new Map(), initiative('Wachstum', null), T0, newId));
    // When a field changes and the change is recorded
    log = applyWrites(log, recordStates(log, initiative('Wachstum', null), initiative('Wachstum', 'Ana'), minutes(5), newId));
    // Then the history and the comparison work as for a story
    const [first, second] = versionsOf(log, 'initiative', 'i1');
    expect(second.keys).toEqual(['field:owner']);
    const rows = compareStates(first.state, second.state);
    expect(rows.map((row) => [row.key, row.same])).toEqual([
      ['title', true],
      ['field:owner', false]
    ]);
  });
});

describe('change log: comparing', () => {
  it('AC8.1 compares two states field by field in a fixed order', () => {
    // Given the state at V6 and the current state of a story
    const v6 = statesOf(world({ stories: [story('s3', { title: 'Login-Seite', status: 'in_progress', points: 3 })] })).get('story:s3')!.state;
    const now = statesOf(world({ stories: [story('s3', { title: 'Login-Seite mit Passwort-Reset', status: 'review', points: 5 })] })).get('story:s3')!.state;
    // When they are compared
    const rows = compareStates(v6, now);
    // Then changed and unchanged fields are told apart, in the order of the dialog
    expect(rows.filter((row) => !row.same).map((row) => row.key)).toEqual(['title', 'status', 'points']);
    expect(rows.filter((row) => row.same).map((row) => row.key)).toEqual(['epic', 'sprint', 'release', 'description', 'criteria']);
  });

  it('AC8.3 swapping the sides turns added into removed', () => {
    // Given a story that got a criterion
    const c = { id: 'c1', text: 'x', done: false };
    const old = statesOf(world({ stories: [story('s3')] })).get('story:s3')!.state;
    const now = statesOf(world({ stories: [story('s3', { criteria: [c] })] })).get('story:s3')!.state;
    // When the sides are compared both ways
    const forward = compareStates(old, now).find((row) => row.key === 'criteria')!;
    const backward = compareStates(now, old).find((row) => row.key === 'criteria')!;
    // Then what was added is removed the other way round
    expect(forward.list?.added).toHaveLength(1);
    expect(backward.list?.removed).toHaveLength(1);
  });

  it('AC8.4 finds no difference between a version and itself', () => {
    // Given a state
    const state = statesOf(world({ stories: [story('s3')] })).get('story:s3')!.state;
    // When it is compared with itself
    // Then every row is the same
    expect(compareStates(state, state).every((row) => row.same)).toBe(true);
    expect(changedKeys(state, state)).toEqual([]);
  });

  it('treats a renamed reference and the order of a multi select as no change', () => {
    // Given a reference whose label changed and a multi select in another order
    // When they are compared
    // Then they are the same
    expect(sameValue({ id: 'e1', label: 'Alt' }, { id: 'e1', label: 'Neu' })).toBe(true);
    expect(sameValue(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameValue(null, [])).toBe(true);
    expect(sameValue({ id: 'e1', label: 'x' }, { id: 'e2', label: 'x' })).toBe(false);
  });
});

describe('change log: moves, sprints and backups', () => {
  it('AC3.2 records a move into a sprint as a change of the sprint of the story and of the sprint', () => {
    // Given a story in the backlog and a sprint
    const before = world({ stories: [story('s3')], sprints: [sprint('sp4')] });
    let log = step([], world(), before, T0);
    // When the story is dropped into the sprint
    log = step(log, before, world({ stories: [story('s3', { sprintId: 'sp4' })], sprints: [sprint('sp4')] }), minutes(3));
    // Then the story names the sprint and the sprint names the story
    const [change] = diffStates(versionsOf(log, 'story', 's3')[0].state, versionsOf(log, 'story', 's3')[1].state);
    expect(change).toMatchObject({ key: 'sprint', kind: 'value', before: null, after: { id: 'sp4', label: 'Sprint sp4' } });
    expect(versionsOf(log, 'sprint', 'sp4')[1].keys).toEqual(['stories']);
  });

  it('AC5.2 keeps the history in an export and import of all data', () => {
    // Given the demo data with their history
    const seed = seedSnapshot('2026-10-13');
    // When they are exported and read again
    const parsed = parseBackup(serializeBackup(seed, '2026-10-13T10:00:00.000Z'), '2026-10-13');
    // Then every version is there
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.snapshot.changeLog).toEqual(seed.changeLog);
  });

  it('AC5.2 reads an export from before the history as one without versions', () => {
    // Given an export that has no change log
    const seed = seedSnapshot('2026-10-13');
    const old = JSON.parse(serializeBackup(seed, '2026-10-13T10:00:00.000Z')) as { data: Record<string, unknown> };
    delete old.data.changeLog;
    // When it is read
    const parsed = parseBackup(JSON.stringify(old), '2026-10-13');
    // Then the history is empty and the data are intact
    expect(parsed.ok && parsed.snapshot.changeLog).toEqual([]);
  });

  it('AC8.6 compares two versions of a sprint, with the stories that joined and left', () => {
    // Given a sprint that got a story and lost another
    const one = story('s1', { sprintId: 'sp5' });
    const two = story('s2');
    const before = world({ stories: [one, two], sprints: [sprint('sp5')] });
    let log = step([], world(), before, T0);
    log = step(log, before, world({ stories: [story('s1'), story('s2', { sprintId: 'sp5' })], sprints: [sprint('sp5')] }), minutes(5));
    // When the first and the last version are compared
    const [first, last] = versionsOf(log, 'sprint', 'sp5');
    const row = compareStates(first.state, last.state).find((item) => item.key === 'stories');
    // Then the row lists what was added and what was removed
    expect(row?.same).toBe(false);
    expect(row?.list?.added.map((entry) => entry.id)).toEqual(['s2']);
    expect(row?.list?.removed.map((entry) => entry.id)).toEqual(['s1']);
  });
});
