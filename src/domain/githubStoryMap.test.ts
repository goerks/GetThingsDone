import { describe, expect, it } from 'vitest';
import { LABELS_FIELD_ID, issueUrl, localFields, pendingFields, planSync, remoteFields, type ExternalMilestone, type GithubIssue, type SyncInput } from './github';
import { DEFAULT_STATUSES } from './statuses';
import { EPIC_COLOR_KEYS, type Epic, type ExternalFields, type FieldDefinition, type Release, type Story } from './types';

const repo = { owner: 'goerks', name: 'GetThingsDone' };
const statuses = DEFAULT_STATUSES.map((status) => ({ ...status }));

let counter = 0;
const newId = (): string => `id-${(counter += 1)}`;

const issue = (number: number, extra: Partial<GithubIssue> = {}): GithubIssue => ({ number, title: 'Login', body: '', state: 'open', labels: [], url: issueUrl(repo, number), milestone: null, ...extra });

const baseFields = (extra: Partial<ExternalFields> = {}): ExternalFields => ({ title: 'Login', description: '', labels: [], criteria: [], done: false, release: null, epic: null, status: null, ...extra });

const story = (extra: Partial<Story> = {}, base: Partial<ExternalFields> = {}): Story => ({
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
  github: { url: issueUrl(repo, 31), state: 'open', base: baseFields(base) },
  ...extra
});

const epic = (id: string, name: string): Epic => ({ id, name, colorKey: EPIC_COLOR_KEYS[0], position: 0, values: {} });
const release = (id: string, title: string): Release => ({ id, title, description: '', startDate: null, endDate: null });
const milestone = (number: number, title: string, extra: Partial<ExternalMilestone> = {}): ExternalMilestone => ({ number, title, description: '', dueOn: null, state: 'open', ...extra });

const labelsField: FieldDefinition = { id: LABELS_FIELD_ID, builtinKey: null, kind: 'custom', dataType: 'multi_select', label: 'Labels', options: [], defaultValue: null };

const plan = (stories: Story[], issues: GithubIssue[], extra: Partial<SyncInput> = {}) =>
  planSync({ stories, fields: [labelsField], assignments: [], statuses, repo, issues, newId, epics: [], releases: [], milestones: [], ...extra });

describe('releases and milestones', () => {
  it('AC12.1 makes a release of a milestone that has none yet and puts the story into it', () => {
    // Given an issue in the milestone "v1.0" and no release of that title
    const result = plan([story()], [issue(31, { milestone: 'v1.0' })], { milestones: [milestone(1, 'v1.0', { description: 'First version', dueOn: '2026-12-31' })] });
    // Then a release with its description and end date exists, the story is in it, and the result names it
    expect(result.releases).toHaveLength(1);
    expect(result.releases[0]).toMatchObject({ title: 'v1.0', description: 'First version', endDate: '2026-12-31', startDate: null });
    expect(result.stories[0].releaseId).toBe(result.releases[0].id);
    expect(result.summary.releasesCreated).toEqual(['v1.0']);
  });

  it('AC12.2 takes the milestone of the issue as the release of the story', () => {
    const result = plan([story({ releaseId: 'r1' }, { release: 'v1.0' })], [issue(31, { milestone: 'v2.0' })], { releases: [release('r1', 'v1.0'), release('r2', 'v2.0')], milestones: [milestone(1, 'v1.0'), milestone(2, 'v2.0')] });
    expect(result.stories[0].releaseId).toBe('r2');
    expect(result.summary.updated[0].changes).toContainEqual({ kind: 'release', from: 'v1.0', to: 'v2.0' });
    expect(result.releases).toHaveLength(2);
  });

  it('AC12.3 publishes the release of a story as the milestone, and removes it when the story has none', () => {
    const releases = [release('r2', 'v2.0')];
    const milestones = [milestone(2, 'v2.0')];
    const set = plan([story({ releaseId: 'r2' })], [issue(31)], { releases, milestones, write: true });
    expect(set.pushes[0]).toMatchObject({ fields: ['release'], patch: { milestone: 2 } });
    const cleared = plan([story({ releaseId: null }, { release: 'v2.0' })], [issue(31, { milestone: 'v2.0' })], { releases, milestones, write: true });
    expect(cleared.pushes[0].patch).toEqual({ milestone: null });
  });

  it('AC12.4 does not publish a release without a milestone while writing is off, and says so', () => {
    const result = plan([story({ releaseId: 'r3' })], [issue(31)], { releases: [release('r3', 'Herbst')], milestones: [milestone(2, 'v2.0')], write: false });
    expect(result.pushes).toEqual([]);
    expect(result.summary.missingMilestones).toEqual(['Herbst']);
    expect(result.summary.pending).toBe(1);
    expect(result.stories[0].releaseId).toBe('r3');
  });

  it('AC12.5 asks the run to make the milestone of a release when writing is on', () => {
    const result = plan([story({ releaseId: 'r3' })], [issue(31)], { releases: [release('r3', 'Herbst')], milestones: [milestone(2, 'v2.0')], write: true });
    expect(result.pushes).toHaveLength(1);
    expect(result.pushes[0]).toMatchObject({ fields: ['release'], needsMilestone: 'Herbst' });
    expect(result.pushes[0].patch.milestone).toBeUndefined();
    expect(result.summary.missingMilestones).toEqual([]);
  });

  it('AC12.6 lets GitHub win by default when story and issue moved to different releases', () => {
    const releases = [release('r1', 'v1.0'), release('r2', 'v2.0'), release('r3', 'v3.0')];
    const result = plan([story({ releaseId: 'r2' }, { release: 'v1.0' })], [issue(31, { milestone: 'v3.0' })], { releases, milestones: [milestone(3, 'v3.0')], write: true });
    expect(result.stories[0].releaseId).toBe('r3');
    expect(result.summary.overwritten).toMatchObject([{ field: 'release', side: 'local' }]);
  });
});

describe('epics and labels', () => {
  it('AC13.1 makes an epic of a label "epic: …", takes it out of the labels and puts the story into it', () => {
    const result = plan([story()], [issue(31, { labels: ['epic: Login & Konto', 'feature'] })]);
    expect(result.epics).toHaveLength(1);
    expect(result.epics[0].name).toBe('Login & Konto');
    expect(result.stories[0].epicId).toBe(result.epics[0].id);
    expect(result.summary.epicsCreated).toEqual(['Login & Konto']);
    expect(result.fields.find((item) => item.id === LABELS_FIELD_ID)?.options.map((option) => option.label)).toEqual(['feature']);
  });

  it('AC13.1 does the same for a story that is imported', () => {
    const result = plan([], [issue(31, { labels: ['epic: Boards'] })]);
    expect(result.stories[0].epicId).toBe(result.epics[0].id);
  });

  it('AC13.2 takes the epic of the issue as the epic of the story', () => {
    const epics = [epic('e1', 'Boards'), epic('e2', 'Backlog')];
    const result = plan([story({ epicId: 'e1' }, { epic: 'Boards' })], [issue(31, { labels: ['epic: Backlog'] })], { epics });
    expect(result.stories[0].epicId).toBe('e2');
    expect(result.epics).toHaveLength(2);
    expect(result.summary.updated[0].changes).toContainEqual({ kind: 'epic', from: 'Boards', to: 'Backlog' });
  });

  it('AC13.3 publishes the epic as a label, replaces the old epic label and keeps the other labels', () => {
    const epics = [epic('e2', 'Backlog')];
    const set = plan([story({ epicId: 'e2' }, { epic: 'Boards' })], [issue(31, { labels: ['epic: Boards', 'feature'] })], { epics, write: true });
    expect(set.pushes[0]).toMatchObject({ fields: ['epic'], patch: { labels: ['feature', 'epic: Backlog'] } });
    const cleared = plan([story({ epicId: null }, { epic: 'Boards' })], [issue(31, { labels: ['epic: Boards', 'feature'] })], { epics, write: true });
    expect(cleared.pushes[0].patch.labels).toEqual(['feature']);
  });

  it('AC13.6 counts only the first epic label and says that there are several', () => {
    const result = plan([story()], [issue(31, { labels: ['epic: Boards', 'epic: Backlog'] })]);
    expect(result.epics.map((item) => item.name)).toEqual(['Boards']);
    expect(result.summary.multipleEpics).toEqual([{ code: 'S-1', number: 31 }]);
  });
});

describe('missing labels while writing is off', () => {
  it('AC13.4 names the epic label that GitHub does not have, and keeps the assignment pending', () => {
    const result = plan([story({ epicId: 'e3' })], [issue(31)], { epics: [epic('e3', 'Storage')], write: false, knownLabels: ['feature'] });
    expect(result.pushes).toEqual([]);
    expect(result.summary.missingLabels).toEqual(['epic: Storage']);
    expect(result.summary.pending).toBe(1);
  });

  it('AC15.5 names the status label that GitHub does not have', () => {
    const result = plan([story({ status: 'review' })], [issue(31)], { write: false, knownLabels: ['status: in progress'] });
    expect(result.summary.missingLabels).toEqual(['status: review']);
  });
});

describe('board columns and status labels', () => {
  it('AC15.1 puts the story into the column a label "status: …" names and keeps the label out of the labels', () => {
    const result = plan([story()], [issue(31, { labels: ['status: in progress', 'feature'] })]);
    expect(result.stories[0].status).toBe('in_progress');
    expect(result.summary.updated[0].changes).toContainEqual({ kind: 'status', from: null, to: 'in progress' });
    expect(result.fields.find((item) => item.id === LABELS_FIELD_ID)?.options.map((option) => option.label)).toEqual(['feature']);
  });

  it('AC15.2 puts the story back into the first column when the label is gone', () => {
    const result = plan([story({ status: 'review' }, { status: 'review' })], [issue(31)]);
    expect(result.stories[0].status).toBe('todo');
  });

  it('AC15.3 keeps a closed issue done whatever its status label says', () => {
    const result = plan([story({ status: 'review' }, { status: 'review' })], [issue(31, { state: 'closed', labels: ['status: review'] })]);
    expect(result.stories[0].status).toBe('done');
  });

  it('AC15.4 publishes the column as a label, replaces the old one and drops it for the first column and done', () => {
    const inProgress = plan([story({ status: 'in_progress' }, { status: 'review' })], [issue(31, { labels: ['status: review', 'feature'] })], { write: true });
    expect(inProgress.pushes[0].patch.labels).toEqual(['feature', 'status: in progress']);
    const first = plan([story({ status: 'todo' }, { status: 'review' })], [issue(31, { labels: ['status: review', 'feature'] })], { write: true });
    expect(first.pushes[0].patch.labels).toEqual(['feature']);
    const done = plan([story({ status: 'done' }, { status: 'review' })], [issue(31, { labels: ['status: review'] })], { write: true });
    expect(done.pushes[0].patch).toMatchObject({ state: 'closed', labels: [] });
  });

  it('AC15.5 keeps a column without a label on GitHub as pending', () => {
    const changed = story({ status: 'review' });
    expect(pendingFields(changed, labelsField, statuses)).toEqual(['status']);
    expect(localFields(changed, labelsField, statuses).status).toBe('review');
  });

  it('AC15.7 lets GitHub win by default when both sides changed the column', () => {
    const result = plan([story({ status: 'review' })], [issue(31, { labels: ['status: in progress'] })], { write: true });
    expect(result.stories[0].status).toBe('in_progress');
    expect(result.summary.overwritten).toMatchObject([{ field: 'status', side: 'local' }]);
  });

  it('AC15.8 names a column of its own after its label and finds it again', () => {
    const own = [...statuses, { id: 'test', label: 'Test', category: 'in_progress' as const }];
    const pushed = planSync({ stories: [story({ status: 'test' })], fields: [labelsField], assignments: [], statuses: own, repo, issues: [issue(31)], newId, write: true });
    expect(pushed.pushes[0].patch.labels).toEqual(['status: Test']);
    const pulled = planSync({ stories: [story()], fields: [labelsField], assignments: [], statuses: own, repo, issues: [issue(31, { labels: ['status: Test'] })], newId });
    expect(pulled.stories[0].status).toBe('test');
  });

  it('ignores a status label this app has no column for', () => {
    const result = plan([story()], [issue(31, { labels: ['status: someday'] })]);
    expect(result.stories[0].status).toBe('todo');
    expect(remoteFields(issue(31, { labels: ['status: someday'] })).status).toBe('someday');
  });
});
