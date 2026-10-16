import { describe, expect, it } from 'vitest';
import de from '../i18n/de.json';
import en from '../i18n/en.json';
import fr from '../i18n/fr.json';
import it_ from '../i18n/it.json';
import { seedSnapshot } from '../data/seed';
import { BACKUP_FORMAT, parseBackup, serializeBackup } from './backup';
import { applyWrites, recordWorld, statesOf, type World } from './changeLog';
import {
  ALL_MEMBERS,
  addMember,
  changeMember,
  checkMember,
  deriveInitials,
  effectiveFilter,
  freeInitials,
  matchesMemberFilter,
  removeMember,
  storiesOfMember
} from './members';
import { migrateSnapshot } from './migrate';
import { DEFAULT_SETTINGS, normalizeSettings } from './settings';
import { EMPTY_QUERY, search } from './search';
import type { Member, Snapshot } from './types';

const TODAY = '2026-10-12';
const team: Member[] = [
  { id: 'm-1', name: 'Marco Brunner', initials: 'MB' },
  { id: 'm-2', name: 'Anna Keller', initials: 'AK' },
  { id: 'm-3', name: 'Luca Rossi', initials: 'LR' }
];

describe('team members (#18)', () => {
  it('AC1.1 adds a member with initials derived from the name', () => {
    // Given the team with three members
    // When I add "Sara Meier"
    const result = addMember(team, 'm-4', 'Sara Meier');
    // Then she is in the list at the end, with the initials "SM"
    expect(result.ok && result.members.map((member) => member.name)).toEqual(['Marco Brunner', 'Anna Keller', 'Luca Rossi', 'Sara Meier']);
    expect(result.ok && result.member.initials).toBe('SM');
  });

  it('AC1.1 derives initials from one word, from several words and suggests a free pair when they are taken', () => {
    // Given the team of the demo
    // When I derive initials
    // Then a single word gives two letters, several words give the first and the last
    expect(deriveInitials('Cher')).toBe('CH');
    expect(deriveInitials('Anna Maria Keller')).toBe('AK');
    expect(deriveInitials('  ')).toBe('');
    // And a pair that is taken gets a number
    expect(freeInitials('Anna Kern', team)).toBe('AK2');
  });

  it('AC1.2 changes the initials of a member', () => {
    // Given "Sara Meier (SM)"
    const added = addMember(team, 'm-4', 'Sara Meier');
    const members = added.ok ? added.members : team;
    // When I change the initials to "SAM"
    const result = changeMember(members, 'm-4', { initials: 'SAM' });
    // Then the member has the initials "SAM"
    expect(result.ok && result.member.initials).toBe('SAM');
  });

  it('AC1.3 lets the initials follow the new name while they were never changed by hand', () => {
    // Given "Anna Keller (AK)"
    // When I rename her to "Anna Roth"
    const result = changeMember(team, 'm-2', { name: 'Anna Roth' });
    // Then she is "Anna Roth (AR)"
    expect(result.ok && result.member).toEqual({ id: 'm-2', name: 'Anna Roth', initials: 'AR' });
  });

  it('AC1.3a keeps initials that were set by hand when the member is renamed', () => {
    // Given "Sara Meier" with the initials "SAM" set by hand
    const members: Member[] = [...team, { id: 'm-4', name: 'Sara Meier', initials: 'SAM' }];
    // When I rename her to "Sara Meier-Frei"
    const result = changeMember(members, 'm-4', { name: 'Sara Meier-Frei' });
    // Then the initials stay "SAM"
    expect(result.ok && result.member.initials).toBe('SAM');
  });

  it('AC1.4 refuses empty, too long and taken names and initials', () => {
    // Given the team with three members
    // When I check the inputs of the table
    // Then each one gives its problem
    expect(checkMember(team, '', 'XX')).toBe('nameEmpty');
    expect(checkMember(team, 'New Person', '')).toBe('initialsEmpty');
    expect(checkMember(team, 'New Person', 'ANNA')).toBe('initialsTooLong');
    expect(checkMember(team, 'Karl Adler', 'AK')).toBe('initialsTaken');
    expect(checkMember(team, 'anna  keller', 'XX')).toBe('nameTaken');
    // And a member may keep their own name and initials
    expect(checkMember(team, 'Anna Keller', 'AK', 'm-2')).toBeNull();
    // And a refused input does not change the list
    const refused = addMember(team, 'm-9', 'Karl Adler', 'AK');
    expect(refused).toEqual({ ok: false, problem: 'initialsTaken' });
  });

  it('AC1.6 removes a member without stories', () => {
    // Given "Luca Rossi" has no stories
    const stories = seedSnapshot(TODAY).stories;
    expect(storiesOfMember(stories, 'member-luca')).toHaveLength(0);
    // When I remove him
    const result = removeMember(seedSnapshot(TODAY).members, stories, 'member-luca');
    // Then he is gone and no story changed
    expect(result.members.map((member) => member.initials)).toEqual(['MB', 'AK']);
    expect(result.stories).toEqual(stories);
  });

  it('AC5.1 removes a member with stories and leaves the stories without assignee', () => {
    // Given Anna has two stories
    const seed = seedSnapshot(TODAY);
    expect(storiesOfMember(seed.stories, 'member-anna').map((story) => story.code)).toEqual(['S-1', 'S-3']);
    // When I remove her
    const result = removeMember(seed.members, seed.stories, 'member-anna');
    // Then both stories still exist and are not assigned
    expect(result.stories).toHaveLength(seed.stories.length);
    expect(result.stories.filter((story) => story.assigneeId === 'member-anna')).toEqual([]);
    expect(result.stories.find((story) => story.code === 'S-3')?.assigneeId).toBeNull();
  });

  it('AC5.3 shows everything again when the filter is on a member who was removed', () => {
    // Given the board is filtered to Anna
    const filter = { kind: 'member', memberId: 'm-2' } as const;
    // When Anna is removed
    const after = team.filter((member) => member.id !== 'm-2');
    // Then the filter that applies is "all"
    expect(effectiveFilter(filter, team)).toEqual(filter);
    expect(effectiveFilter(filter, after)).toEqual(ALL_MEMBERS);
  });
});

describe('filter by person (#18)', () => {
  const stories = seedSnapshot(TODAY).stories;
  const codes = (filter: Parameters<typeof matchesMemberFilter>[1]): string[] => stories.filter((story) => matchesMemberFilter(story, filter)).map((story) => story.code);

  it('AC4.1 filters to the stories of one person', () => {
    // Given the demo stories
    // When I filter to Anna
    // Then only her stories remain
    expect(codes({ kind: 'member', memberId: 'member-anna' })).toEqual(['S-1', 'S-3']);
  });

  it('AC4.2 filters to the stories nobody works on', () => {
    // Given the demo stories
    // When I filter to "Unassigned"
    // Then only stories without a person remain
    expect(codes({ kind: 'none' })).toEqual(['S-4', 'S-6', 'S-7']);
  });

  it('AC4.3 shows all stories again with "All"', () => {
    // Given a filter on a person
    // When I choose "All"
    // Then every story is shown
    expect(codes(ALL_MEMBERS)).toHaveLength(stories.length);
  });

  it('AC4.4 gives no stories for a person without stories', () => {
    // Given Luca has no stories
    // When I filter to Luca
    // Then nothing remains
    expect(codes({ kind: 'member', memberId: 'member-luca' })).toEqual([]);
  });
});

describe('search by person (#18)', () => {
  const seed = seedSnapshot(TODAY);
  const found = (text: string, filters: { field: string; value: string }[] = []): string[] =>
    search(seed, { ...EMPTY_QUERY, text, filters })
      .filter((result) => result.kind === 'story')
      .map((result) => (result.kind === 'story' ? result.story.code : ''))
      .sort();

  it('AC6.1 finds the stories of a person by name and by initials', () => {
    // Given the demo data
    // When I search for "Anna" and for "AK"
    // Then both find the stories of Anna
    expect(found('anna')).toEqual(['S-1', 'S-3']);
    expect(found('AK')).toEqual(expect.arrayContaining(['S-1', 'S-3']));
  });

  it('AC6.1 filters the search by assignee and by "not assigned"', () => {
    // Given the demo data
    // When I filter the search by assignee
    // Then the stories of that person, or those without a person, are found
    expect(found('', [{ field: 'assignee', value: 'member-marco' }])).toEqual(['S-2', 'S-5']);
    expect(found('', [{ field: 'assignee', value: 'none' }])).toEqual(['S-4', 'S-6', 'S-7']);
  });
});

describe('demo data, export and history (#18)', () => {
  it('AC6.2 holds a team with assigned and unassigned stories in the demo data', () => {
    // Given the demo data of the preview
    const seed = seedSnapshot(TODAY);
    // Then there are team members, some stories are assigned and some are not
    expect(seed.members.length).toBeGreaterThanOrEqual(3);
    expect(seed.stories.some((story) => story.assigneeId)).toBe(true);
    expect(seed.stories.some((story) => !story.assigneeId)).toBe(true);
  });

  it('AC6.3 has the texts in German, English, French and Italian', () => {
    // Given the four language files
    // Then the field and the filter have a name in each language
    expect(en.team.field).toBe('Assigned to');
    expect(de.team.field).toBe('Zugewiesen an');
    for (const file of [en, de, fr, it_]) {
      expect(file.team.title).not.toBe('');
      expect(file.team.filter.none).not.toBe('');
      expect(file.team.nobody).not.toBe('');
    }
    expect(fr.team.field).not.toBe(en.team.field);
    expect(it_.team.field).not.toBe(en.team.field);
  });

  it('AC7.1 brings team members and assignments back through an export and an import', () => {
    // Given the demo data with its team
    const seed = seedSnapshot(TODAY);
    // When I export it and import the file again
    const parsed = parseBackup(serializeBackup(seed, '2026-10-12T08:00:00.000Z'), TODAY);
    // Then the members and the assignments are back
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.snapshot.members).toEqual(seed.members);
    expect(parsed.snapshot.stories.find((story) => story.code === 'S-3')?.assigneeId).toBe('member-anna');
  });

  it('AC7.2 records an assignment as a change of the story in the history', () => {
    // Given S-4 is not assigned
    const seed = seedSnapshot(TODAY);
    const before: World = { stories: seed.stories, epics: seed.epics, sprints: seed.sprints, releases: seed.releases, members: seed.members };
    const first = applyWrites([], recordWorld([], { ...before, stories: [] }, before, '2026-10-12T08:00:00.000Z', (() => { let n = 0; return () => `v-${(n += 1)}`; })()));
    // When I assign it to Luca
    const stories = seed.stories.map((story) => (story.code === 'S-4' ? { ...story, assigneeId: 'member-luca' } : story));
    const writes = recordWorld(first, before, { ...before, stories }, '2026-10-12T09:00:00.000Z', (() => { let n = 100; return () => `v-${(n += 1)}`; })());
    // Then the story has a new version that changed "assignee" and names Luca
    const version = writes.upsert.find((item) => item.itemId === 'story-4');
    expect(version?.keys).toEqual(['assignee']);
    expect(version?.state.assignee).toEqual({ id: 'member-luca', label: 'Luca Rossi' });
    // And a story that is not assigned has no key "assignee" in its state
    expect(statesOf(before).get('story:story-4')?.state).not.toHaveProperty('assignee');
  });

  it('AC7.3 imports a backup from before the team without error and leaves every story unassigned', () => {
    // Given a backup file written before the team existed
    const { members: _members, ...old } = seedSnapshot(TODAY);
    const withoutTeam = { ...old, stories: old.stories.map(({ assigneeId: _assignee, ...story }) => story) };
    const text = JSON.stringify({ format: BACKUP_FORMAT, version: 1, exportedAt: '2026-10-01T08:00:00.000Z', data: withoutTeam });
    // When I import it
    const parsed = parseBackup(text, TODAY);
    // Then it works, the team is empty and no story is assigned
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.snapshot.members).toEqual([]);
    expect(parsed.snapshot.stories.every((story) => !story.assigneeId)).toBe(true);
  });

  it('AC7.3 drops an assignment to a member who is not in the file', () => {
    // Given stored data in which a story points to a member that does not exist
    const seed = seedSnapshot(TODAY);
    const stored = { ...seed, members: seed.members.filter((member) => member.id !== 'member-anna') } as Snapshot;
    // When the data are migrated
    const migrated = migrateSnapshot(stored, TODAY);
    // Then the story is not assigned
    expect(migrated.stories.find((story) => story.code === 'S-3')?.assigneeId).toBeNull();
    expect(migrated.stories.find((story) => story.code === 'S-2')?.assigneeId).toBe('member-marco');
  });
});

describe('the team as a feature (#18)', () => {
  it('AC8.4 has the team off by default and on in the demo data', () => {
    // Given a project without the setting, a new one and the demo data
    // Then the team is off, except in the demo data
    expect(DEFAULT_SETTINGS.features.team).toBe(false);
    expect(normalizeSettings(undefined).features.team).toBe(false);
    expect(normalizeSettings({ features: { releases: true } }).features.team).toBe(false);
    expect(normalizeSettings({ features: { team: true } }).features.team).toBe(true);
    expect(normalizeSettings({ features: { team: '1' } }).features.team).toBe(true);
    expect(normalizeSettings({ features: { team: 'unknown' } }).features.team).toBe(false);
    expect(seedSnapshot(TODAY).settings.features.team).toBe(true);
  });

  it('AC8.4 imports a file from before the team with the team switched off', () => {
    // Given a backup file from before the team
    const { members: _members, ...old } = seedSnapshot(TODAY);
    const text = JSON.stringify({ format: BACKUP_FORMAT, version: 1, exportedAt: '2026-10-01T08:00:00.000Z', data: { ...old, settings: { mapRows: 'sprints', features: { releases: true } } } });
    // When I import it
    const parsed = parseBackup(text, TODAY);
    // Then the team is off
    expect(parsed.ok && parsed.snapshot.settings.features.team).toBe(false);
  });

  it('AC8.3 exports the team even while it is switched off', () => {
    // Given the demo data with the team switched off
    const seed = seedSnapshot(TODAY);
    const off = { ...seed, settings: { ...seed.settings, features: { ...seed.settings.features, team: false } } };
    // When I export and import the file
    const parsed = parseBackup(serializeBackup(off, '2026-10-12T08:00:00.000Z'), TODAY);
    // Then the members and the assignments are in the file, and the team is still off
    expect(parsed.ok && parsed.snapshot.members).toEqual(seed.members);
    expect(parsed.ok && parsed.snapshot.stories.find((story) => story.code === 'S-3')?.assigneeId).toBe('member-anna');
    expect(parsed.ok && parsed.snapshot.settings.features.team).toBe(false);
  });

  it('AC8.2 finds nobody by name while the team is off, because the search has no member list', () => {
    // Given the demo data and a search snapshot without members, as the search gets it while the team is off
    const seed = seedSnapshot(TODAY);
    const { members: _members, ...withoutTeam } = seed;
    // When I search for "Anna"
    const results = search(withoutTeam, { ...EMPTY_QUERY, text: 'anna' });
    // Then no story is found
    expect(results).toEqual([]);
  });

  it('AC8.6 describes the switch in German, English, French and Italian', () => {
    // Given the four language files
    // Then the switch has a name, a description and a note for the off state in each
    for (const file of [en, de, fr, it_]) {
      expect(file.settings.features.team.name).not.toBe('');
      expect(file.settings.features.team.description).not.toBe('');
      expect(file.settings.features.team.offNote).not.toBe('');
    }
    expect(de.settings.features.team.offNote).not.toBe(en.settings.features.team.offNote);
  });
});
