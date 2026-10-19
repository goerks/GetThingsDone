import { describe, expect, it } from 'vitest';
import { LABELS_FIELD_ID, issueUrl, pendingFields, type GithubIssue } from '../domain/github';
import { DEFAULT_STATUSES } from '../domain/statuses';
import { EPIC_COLOR_KEYS, type ExternalFields, type FieldDefinition, type Story } from '../domain/types';
import { fakeGithub, fakeIssue, REPO } from '../test/fakeGithub';
import { createEpicLabelFor, createMilestoneFor, createOnGithub, createStatusLabels, runSync, type RunSyncInput } from './runSync';

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

const story = (extra: Partial<Story> = {}): Story => ({
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
  github: { url: issueUrl(repo, 31), state: 'open', base: base() },
  ...extra
});

const input = (fake: ReturnType<typeof fakeGithub>, stories: Story[], extra: Partial<RunSyncInput> = {}): RunSyncInput => ({
  connector: fake.github.source,
  token: 'good',
  repo,
  stories,
  fields: [labelsField],
  assignments: [],
  statuses,
  epics: [],
  releases: [],
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
    expect(result.summary.published).toEqual([{ storyId: 's1', code: 'S-1', number: 31, title: 'Login-Seite', fields: ['title', 'labels'], skippedLabels: [] }]);
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
    const reopened = story({ status: 'in_progress', github: { url: issueUrl(repo, 31), state: 'closed', base: base({ done: true }) } });
    const result = await runSync(input(fake, [reopened]));
    expect(fake.state.issues[0].state).toBe('open');
    expect(result.plan.stories[0].github?.state).toBe('open');
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
    const own = story({ title: 'Export as CSV', description: 'Text', github: undefined, values: { [LABELS_FIELD_ID]: ['gh-label-bug', 'gh-label-unknown'] } });
    const created = await createOnGithub({ connector: fake.github.source, token: 'good', repo, story: own, fields: [labelsField], statuses });
    expect(fake.state.issues[0]).toMatchObject({ title: 'Export as CSV', body: 'Text', labels: ['bug'] });
    expect(created.skippedLabels).toEqual(['unknown']);
    expect(created.story.github).toMatchObject({ url: `https://github.com/${REPO}/issues/1`, state: 'open' });
  });

  it('AC13.4 and AC15.5 create no label: a missing epic or status label is reported and the assignment stays pending', async () => {
    const fake = fakeGithub(issues());
    const epicStory = story({ epicId: 'e-storage', status: 'review' });
    const result = await runSync(input(fake, [epicStory], { epics: [{ id: 'e-storage', name: 'Storage', colorKey: EPIC_COLOR_KEYS[0], position: 0, values: {} }] }));
    expect(result.summary.published[0].skippedLabels).toEqual(['epic: Storage', 'status: review']);
    expect(fake.state.issues[0].labels).toEqual([]);
    expect(fake.state.knownLabels).not.toContain('epic: Storage');
    expect(pendingFields(result.plan.stories[0], labelsField, statuses, { epics: [{ id: 'e-storage', name: 'Storage', colorKey: EPIC_COLOR_KEYS[0], position: 0, values: {} }] })).toEqual(['epic', 'status']);
  });

  it('AC12.3 publishes the milestone of a release to the issue', async () => {
    const fake = fakeGithub(issues());
    fake.state.milestones = [{ number: 2, title: 'v2.0', description: '', dueOn: null, state: 'open' }];
    const result = await runSync(input(fake, [story({ releaseId: 'r2' })], { releases: [{ id: 'r2', title: 'v2.0', description: '', startDate: null, endDate: null }] }));
    expect(fake.state.issues[0].milestone).toBe('v2.0');
    expect(result.summary.published[0].fields).toEqual(['release']);
  });

  it('AC12.5 makes a milestone once and AC13.5 a label once', async () => {
    const fake = fakeGithub([]);
    const common = { connector: fake.github.source, token: 'good', repo };
    const herbst = { id: 'r', title: 'Herbst', description: 'Autumn', startDate: null, endDate: '2026-11-30' };
    expect(await createMilestoneFor({ ...common, release: herbst })).toBe(true);
    expect(await createMilestoneFor({ ...common, release: herbst })).toBe(false);
    expect(fake.state.milestones).toHaveLength(1);
    const storage = { id: 'e', name: 'Storage', colorKey: EPIC_COLOR_KEYS[0], position: 0, values: {} };
    expect(await createEpicLabelFor({ ...common, epic: storage })).toBe(true);
    expect(await createEpicLabelFor({ ...common, epic: storage })).toBe(false);
    expect(fake.state.knownLabels.filter((label) => label === 'epic: Storage')).toHaveLength(1);
  });

  it('AC15.6 makes the labels of the columns between the first one and done, and only the missing ones', async () => {
    const fake = fakeGithub([]);
    const common = { connector: fake.github.source, token: 'good', repo, statuses };
    expect(await createStatusLabels(common)).toEqual(['status: in progress', 'status: review']);
    expect(await createStatusLabels(common)).toEqual([]);
    fake.state.canWrite = false;
    fake.state.knownLabels = fake.state.knownLabels.filter((label) => label !== 'status: review');
    await expect(createStatusLabels(common)).rejects.toMatchObject({ kind: 'forbidden' });
  });
});
