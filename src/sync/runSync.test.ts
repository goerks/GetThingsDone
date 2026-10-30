import { describe, expect, it } from 'vitest';
import { LABELS_FIELD_ID, pendingFields } from '../domain/sync';
import { DEFAULT_STATUSES } from '../domain/statuses';
import { EPIC_COLOR_KEYS, type ExternalFields, type FieldDefinition, type Story } from '../domain/types';
import { fakeGithub, fakeIssue, REPO } from '../test/fakeGithub';
import type { Epic, Release } from '../domain/types';
import { issueUrl, type GithubIssue } from './github/format';
import { createInService, runSync, type RunSyncInput } from './runSync';

const repo = { owner: 'goerks', name: 'GetThingsDone' };
const statuses = DEFAULT_STATUSES.map((status) => ({ ...status }));
let counter = 0;
const newId = (): string => `id-${(counter += 1)}`;

const labelsField: FieldDefinition = {
  id: LABELS_FIELD_ID,
  builtinKey: null,
  kind: 'custom',
  dataType: 'multi_select',
  label: 'Labels',
  options: [
    { id: 'gh-label-bug', label: 'bug', colorKey: EPIC_COLOR_KEYS[0] },
    { id: 'gh-label-unknown', label: 'unknown', colorKey: EPIC_COLOR_KEYS[0] }
  ],
  defaultValue: null
};

const base = (extra: Partial<ExternalFields> = {}): ExternalFields => ({ title: 'Login', description: '', labels: [], criteria: [], done: false, ...extra });

const story = (extra: Partial<Story> = {}, baseExtra: Partial<ExternalFields> = {}): Story => ({
  id: 's1',
  code: 'S-1',
  title: 'Login',
  description: '',
  epicId: null,
  points: 0,
  status: 'todo',
  sprintId: null,
  releaseId: null,
  rank: 0,
  criteria: [],
  values: {},
  checks: {},
  doneItems: null,
  link: { service: 'github', key: '#31', url: issueUrl(repo, 31), state: 'open', base: base(baseExtra) },
  ...extra
});

const input = (fake: ReturnType<typeof fakeGithub>, stories: Story[], extra: Partial<RunSyncInput> = {}): RunSyncInput => ({
  connector: fake.sync.connectors.github,
  target: repo,
  token: 'good',
  stories,
  fields: [labelsField],
  assignments: [],
  statuses,
  epics: [],
  releases: [],
  managed: { labels: [], milestones: [] },
  newId,
  write: true,
  conflict: 'remote',
  ignored: [],
  ...extra
});

const issues = (): GithubIssue[] => [fakeIssue(31, { title: 'Login' })];

describe('one sync with a connector', () => {
  it('AC7.1 publishes the change, names it in the result and has nothing pending afterwards (AC9.2)', async () => {
    // Given a story whose title and label changed here, and its issue
    const fake = fakeGithub(issues());
    const changed = story({ title: 'Login-Seite', values: { [LABELS_FIELD_ID]: ['gh-label-bug'] } });
    expect(pendingFields(changed, labelsField, statuses)).toEqual(['title', 'labels']);
    // When the sync runs with writing on
    const result = await runSync(input(fake, [changed]));
    // Then GitHub has the change, the result names it, and nothing is pending any more
    expect(fake.state.issues[0]).toMatchObject({ title: 'Login-Seite', labels: ['bug'] });
    expect(result.error).toBeNull();
    expect(result.summary.published).toEqual([{ storyId: 's1', code: 'S-1', key: '#31', title: 'Login-Seite', fields: ['title', 'labels'], skippedLabels: [] }]);
    expect(pendingFields(result.plan.stories[0], labelsField, statuses)).toEqual([]);
  });

  it('AC7.4 and AC7.5 send nothing when writing is off, and the change stays pending', async () => {
    const fake = fakeGithub(issues());
    const result = await runSync(input(fake, [story({ title: 'Login-Seite' })], { write: false }));
    expect(fake.state.writes).toEqual([]);
    expect(result.summary.pending).toBe(1);
    expect(pendingFields(result.plan.stories[0], labelsField, statuses)).toEqual(['title']);
  });

  it('AC7.6 keeps the local change and says "forbidden" when the token may not write', async () => {
    const fake = fakeGithub(issues());
    fake.state.canWrite = false;
    const result = await runSync(input(fake, [story({ title: 'Login-Seite' })]));
    expect(result.error).toMatchObject({ kind: 'forbidden' });
    expect(result.plan.stories[0].title).toBe('Login-Seite');
    expect(pendingFields(result.plan.stories[0], labelsField, statuses)).toEqual(['title']);
    expect(result.summary.published).toEqual([]);
  });

  it('AC7.1 reports labels GitHub does not know and keeps them on the story', async () => {
    const fake = fakeGithub(issues());
    const changed = story({ values: { [LABELS_FIELD_ID]: ['gh-label-bug', 'gh-label-unknown'] } });
    const result = await runSync(input(fake, [changed]));
    expect(result.summary.published[0].skippedLabels).toEqual(['unknown']);
    expect(fake.state.issues[0].labels).toEqual(['bug']);
    expect(pendingFields(result.plan.stories[0], labelsField, statuses)).toEqual(['labels']);
  });

  it('AC7.3 reopens a closed issue whose story left Done, even though it is not in the list of open issues', async () => {
    const fake = fakeGithub([fakeIssue(31, { state: 'closed' })]);
    const reopened = story({ status: 'in_progress', link: { service: 'github', key: '#31', url: issueUrl(repo, 31), state: 'closed', base: base({ done: true }) } });
    const result = await runSync(input(fake, [reopened]));
    expect(fake.state.issues[0].state).toBe('open');
    expect(result.plan.stories[0].link?.state).toBe('open');
  });

  it('AC8.2 asks and changes nothing until the answer is given', async () => {
    const fake = fakeGithub([fakeIssue(31, { title: 'Login-Seite' })]);
    const both = story({ title: 'Anmeldung' });
    const asked = await runSync(input(fake, [both], { conflict: 'ask' }));
    expect(asked.summary.conflicts).toHaveLength(1);
    expect(fake.state.writes).toEqual([]);
    expect(asked.plan.stories[0].title).toBe('Anmeldung');
    const answered = await runSync(input(fake, [both], { conflict: 'ask', decisions: { 's1:title': 'local' } }));
    expect(fake.state.issues[0].title).toBe('Anmeldung');
    expect(answered.summary.conflicts).toEqual([]);
  });

  it('AC10.1 creates the issue of a story and links the story to it', async () => {
    const fake = fakeGithub([]);
    const own = story({ title: 'Export as CSV', description: 'Text', link: undefined, values: { [LABELS_FIELD_ID]: ['gh-label-bug', 'gh-label-unknown'] } });
    const created = await createInService({ connector: fake.sync.connectors.github, target: repo, token: 'good', story: own, fields: [labelsField], statuses });
    expect(fake.state.issues[0]).toMatchObject({ title: 'Export as CSV', body: 'Text', labels: ['bug'] });
    expect(created.skippedLabels).toEqual(['unknown']);
    expect(created.story.link).toMatchObject({ service: 'github', key: '#1', url: `https://github.com/${REPO}/issues/1`, state: 'open' });
  });

  it('AC12.3 publishes the milestone of a release to the issue', async () => {
    const fake = fakeGithub(issues());
    fake.state.milestones = [{ number: 2, title: 'v2.0', description: '', dueOn: null, state: 'open' }];
    const result = await runSync(input(fake, [story({ releaseId: 'r2' })], { releases: [{ id: 'r2', title: 'v2.0', description: '', startDate: null, endDate: null }] }));
    expect(fake.state.issues[0].milestone).toBe('v2.0');
    expect(result.summary.published[0].fields).toEqual(['release']);
  });
})

describe('labels and milestones the sync makes and deletes (AC16)', () => {
  const storage: Epic = { id: 'e-storage', name: 'Storage', colorKey: EPIC_COLOR_KEYS[0], position: 0, values: {} };
  const herbst: Release = { id: 'r-herbst', title: 'Herbst', description: 'Autumn', startDate: null, endDate: '2026-11-30' };
  const noReview = statuses.filter((status) => status.id !== 'review');

  it('AC13.5 makes the label of an epic that a story needs before it publishes it, and remembers that it made it', async () => {
    const fake = fakeGithub(issues());
    const result = await runSync(input(fake, [story({ epicId: 'e-storage' })], { epics: [storage] }));
    expect(fake.state.knownLabels).toContain('epic: Storage');
    expect(fake.state.issues[0].labels).toEqual(['epic: Storage']);
    expect(result.summary.labelsCreated).toEqual(['epic: Storage']);
    expect(result.managed.labels).toEqual(['epic: Storage']);
    expect(result.error).toBeNull();
  });

  it('AC15.6 makes the label of a column that a story is in', async () => {
    const fake = fakeGithub(issues());
    const result = await runSync(input(fake, [story({ status: 'review' })]));
    expect(fake.state.issues[0].labels).toEqual(['status: review']);
    expect(result.summary.labelsCreated).toEqual(['status: review']);
    // A column that no story is in gets no label
    expect(fake.state.knownLabels).not.toContain('status: in progress');
  });

  it('AC12.5 makes the milestone of a release that a story is in, with description and due date', async () => {
    const fake = fakeGithub(issues());
    const result = await runSync(input(fake, [story({ releaseId: 'r-herbst' })], { releases: [herbst] }));
    expect(fake.state.milestones).toMatchObject([{ title: 'Herbst', description: 'Autumn', dueOn: '2026-11-30' }]);
    expect(fake.state.issues[0].milestone).toBe('Herbst');
    expect(result.summary.milestonesCreated).toEqual(['Herbst']);
    expect(result.managed.milestones).toEqual(['Herbst']);
  });

  it('AC13.4 and AC15.5 make nothing while writing is off and name the missing labels', async () => {
    const fake = fakeGithub(issues());
    const result = await runSync(input(fake, [story({ epicId: 'e-storage', status: 'review' })], { epics: [storage], write: false }));
    expect(fake.state.writes).toEqual([]);
    expect(result.summary.missingLabels).toEqual(['epic: Storage', 'status: review']);
    expect(result.managed.labels).toEqual([]);
  });

  it('AC16.1 deletes the label the app made when its epic is gone and no issue has it any more', async () => {
    const fake = fakeGithub([fakeIssue(31, { title: 'Login', labels: ['epic: Storage'] })]);
    fake.state.knownLabels.push('epic: Storage');
    const was = story({ epicId: null }, { epic: 'Storage' });
    const result = await runSync(input(fake, [was], { managed: { labels: ['epic: Storage'], milestones: [] } }));
    expect(fake.state.issues[0].labels).toEqual([]);
    expect(fake.state.knownLabels).not.toContain('epic: Storage');
    expect(result.summary.labelsDeleted).toEqual(['epic: Storage']);
    expect(result.managed.labels).toEqual([]);
  });

  it('AC16.2 keeps the label while its epic still exists', async () => {
    const fake = fakeGithub([fakeIssue(31, { title: 'Login', labels: ['epic: Storage'] })]);
    fake.state.knownLabels.push('epic: Storage');
    const keeps = story({ epicId: 'e-storage' }, { epic: 'Storage' });
    const result = await runSync(input(fake, [keeps], { epics: [storage], managed: { labels: ['epic: Storage'], milestones: [] } }));
    expect(fake.state.knownLabels).toContain('epic: Storage');
    expect(result.summary.labelsDeleted).toEqual([]);
    expect(result.managed.labels).toEqual(['epic: Storage']);
  });

  it('AC16.3 deletes the label of a column that is gone', async () => {
    const fake = fakeGithub(issues());
    fake.state.knownLabels.push('status: review');
    const result = await runSync(input(fake, [story()], { statuses: noReview, managed: { labels: ['status: review'], milestones: [] } }));
    expect(fake.state.knownLabels).not.toContain('status: review');
    expect(result.summary.labelsDeleted).toEqual(['status: review']);
  });

  it('AC16.4 deletes the milestone of a release that is gone, after the issues have left it', async () => {
    const fake = fakeGithub([fakeIssue(31, { title: 'Login', milestone: 'Herbst' })]);
    fake.state.milestones = [{ number: 3, title: 'Herbst', description: '', dueOn: null, state: 'open' }];
    const result = await runSync(input(fake, [story({ releaseId: null }, { release: 'Herbst' })], { managed: { labels: [], milestones: ['Herbst'] } }));
    expect(fake.state.issues[0].milestone).toBeNull();
    expect(fake.state.milestones).toEqual([]);
    expect(result.summary.milestonesDeleted).toEqual(['Herbst']);
    expect(result.managed.milestones).toEqual([]);
  });

  it('AC16.5 never deletes a label or a milestone that the app did not make', async () => {
    const fake = fakeGithub(issues());
    fake.state.knownLabels.push('epic: Alt');
    fake.state.milestones = [{ number: 4, title: 'Q4', description: '', dueOn: null, state: 'open' }];
    const result = await runSync(input(fake, [story()]));
    expect(fake.state.knownLabels).toContain('epic: Alt');
    expect(fake.state.milestones).toHaveLength(1);
    expect(result.summary.labelsDeleted).toEqual([]);
    expect(result.summary.milestonesDeleted).toEqual([]);
  });

  it('AC16.6 deletes nothing while writing is off', async () => {
    const fake = fakeGithub(issues());
    fake.state.knownLabels.push('status: review');
    const result = await runSync(input(fake, [story()], { write: false, statuses: noReview, managed: { labels: ['status: review'], milestones: [] } }));
    expect(fake.state.knownLabels).toContain('status: review');
    expect(fake.state.writes).toEqual([]);
    expect(result.managed.labels).toEqual(['status: review']);
  });
});
