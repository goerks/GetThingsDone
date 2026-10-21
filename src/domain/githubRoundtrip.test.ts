import { describe, expect, it } from 'vitest';
import { LABELS_FIELD_ID, decisionKey, linkTo, newItemOf, pendingFields, withBase } from './sync';
import { composeBody, issueUrl, splitBody, toItem, toNewIssue, withCriteria, type GithubIssue } from '../sync/github/format';
import { planGithub, type GithubSyncInput } from '../test/githubPlan';
import { DEFAULT_STATUSES } from './statuses';
import { EPIC_COLOR_KEYS, type ExternalFields, type FieldDefinition, type Story } from './types';

const repo = { owner: 'goerks', name: 'GetThingsDone' };
const statuses = DEFAULT_STATUSES.map((status) => ({ ...status }));

let counter = 0;
const newId = (): string => `id-${(counter += 1)}`;

const issue = (number: number, extra: Partial<GithubIssue> = {}): GithubIssue => ({ number, title: 'Login', body: '', state: 'open', labels: [], url: issueUrl(repo, number), ...extra });

const baseFields = (extra: Partial<ExternalFields> = {}): ExternalFields => ({ title: 'Login', description: '', labels: [], criteria: [], done: false, ...extra });

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
  link: { service: 'github', key: '#31', url: issueUrl(repo, 31), state: 'open', base: baseFields(base) },
  ...extra
});

const labelsField: FieldDefinition = {
  id: LABELS_FIELD_ID,
  builtinKey: null,
  kind: 'custom',
  dataType: 'multi_select',
  label: 'Labels',
  options: [{ id: 'gh-label-bug', label: 'bug', colorKey: EPIC_COLOR_KEYS[0] }],
  defaultValue: null
};

const plan = (stories: Story[], issues: GithubIssue[], extra: Partial<GithubSyncInput> = {}) =>
  planGithub({ stories, fields: [labelsField], assignments: [], statuses, repo, issues, newId, ...extra });

describe('publishing local changes', () => {
  it('AC7.1 publishes a changed title and a new label when writing is on', () => {
    // Given a story whose title and labels changed here since the last sync
    const local = story({ title: 'Login-Seite', values: { [LABELS_FIELD_ID]: ['gh-label-bug'] } });
    // When the sync runs with writing on
    const result = plan([local], [issue(31)], { write: true });
    // Then it asks to change title and labels of the issue and nothing else
    expect(result.pushes).toEqual([{ storyId: 's1', number: 31, fields: ['title', 'labels'], patch: { title: 'Login-Seite', labels: ['bug'] } }]);
    expect(result.summary.pending).toBe(0);
  });

  it('AC7.2 publishes criteria and ticks under "Acceptance criteria" and keeps the rest of the text', () => {
    // Given an issue with other text around its task list, and a story whose criteria changed
    const body = 'Intro\n\n## Acceptance criteria\n- [ ] Login possible\n- [ ] Error message\n\n## Notes\nKeep this';
    const local = story(
      {
        criteria: [
          { id: 'c1', text: 'Login possible', done: true },
          { id: 'c2', text: 'Error message', done: false },
          { id: 'c3', text: 'Forgot password', done: false }
        ]
      },
      { criteria: [{ text: 'Login possible', done: false }, { text: 'Error message', done: false }] }
    );
    // When the sync publishes
    const result = plan([local], [issue(31, { body })], { write: true });
    // Then the tasks are replaced and the other text stays as it was
    expect(result.pushes[0].fields).toEqual(['criteria']);
    expect(result.pushes[0].patch.body).toBe('Intro\n\n## Acceptance criteria\n- [x] Login possible\n- [ ] Error message\n- [ ] Forgot password\n\n## Notes\nKeep this');
  });

  it('AC7.3 closes the issue of a story that is done and opens it again when the story is not', () => {
    // Given a story moved to Done here
    const done = plan([story({ status: 'done' })], [issue(31)], { write: true });
    expect(done.pushes[0].patch).toEqual({ state: 'closed' });
    // And a story moved out of Done whose issue is closed
    const closed = issue(31, { state: 'closed' });
    const open = plan([story({ status: 'in_progress' }, { done: true })], [closed], { write: true });
    expect(open.pushes[0].patch).toEqual({ state: 'open', labels: ['status: in progress'] });
  });

  it('AC7.5 publishes nothing when writing is off and counts what stays', () => {
    // Given a changed story
    const result = plan([story({ title: 'Login-Seite' })], [issue(31)], { write: false });
    // Then nothing is published, the story keeps its change and the sync says how many changes stayed
    expect(result.pushes).toEqual([]);
    expect(result.stories[0].title).toBe('Login-Seite');
    expect(result.summary.pending).toBe(1);
  });
});

describe('conflicts', () => {
  const both = (): Story => story({ title: 'Anmeldung' });
  const remote = (): GithubIssue => issue(31, { title: 'Login-Seite' });

  it('AC3.3 lets GitHub win by default and names the lost local title', () => {
    // When both sides changed the title and the rule is the default
    const result = plan([both()], [remote()], { write: true });
    // Then the title is the one of GitHub and the sync says what was overwritten
    expect(result.stories[0].title).toBe('Login-Seite');
    expect(result.pushes).toEqual([]);
    expect(result.summary.overwritten).toEqual([{ storyId: 's1', code: 'S-1', key: '#31', field: 'title', side: 'local', value: 'Anmeldung' }]);
  });

  it('AC8.1 lets the local change win and names the lost GitHub title', () => {
    // When the rule is "local wins"
    const result = plan([both()], [remote()], { write: true, conflict: 'local' });
    // Then the local title is published and the sync says what was overwritten
    expect(result.stories[0].title).toBe('Anmeldung');
    expect(result.pushes[0].patch).toEqual({ title: 'Anmeldung' });
    expect(result.summary.overwritten).toEqual([{ storyId: 's1', code: 'S-1', key: '#31', field: 'title', side: 'remote', value: 'Login-Seite' }]);
  });

  it('AC8.1 keeps the local change but cannot publish it when writing is off', () => {
    const result = plan([both()], [remote()], { write: false, conflict: 'local' });
    expect(result.stories[0].title).toBe('Anmeldung');
    expect(result.pushes).toEqual([]);
    expect(result.summary.pending).toBe(1);
  });

  it('AC8.2 changes nothing until I decide, then follows my answer on both sides', () => {
    // When the rule is "I decide" and there is no answer yet
    const asked = plan([both()], [remote()], { write: true, conflict: 'ask' });
    // Then nothing changes and the conflict shows both versions
    expect(asked.stories[0].title).toBe('Anmeldung');
    expect(asked.pushes).toEqual([]);
    expect(asked.summary.conflicts).toHaveLength(1);
    expect(asked.summary.conflicts[0]).toMatchObject({ field: 'title', local: { title: 'Anmeldung' }, remote: { title: 'Login-Seite' } });
    // And with the answer "GitHub" the story takes the title of GitHub
    const key = decisionKey('s1', 'title');
    const github = plan([both()], [remote()], { write: true, conflict: 'ask', decisions: { [key]: 'remote' } });
    expect(github.stories[0].title).toBe('Login-Seite');
    expect(github.summary.conflicts).toEqual([]);
    // And with the answer "local" the title is published
    const local = plan([both()], [remote()], { write: true, conflict: 'ask', decisions: { [key]: 'local' } });
    expect(local.pushes[0].patch).toEqual({ title: 'Anmeldung' });
  });

  it('AC8.4 is no conflict when different fields changed: both changes stay', () => {
    // Given a title changed here and a description changed on GitHub
    const result = plan([story({ title: 'Anmeldung' })], [issue(31, { body: 'New text' })], { write: true, conflict: 'ask' });
    // Then the title is published and the description is taken, without a conflict
    expect(result.summary.conflicts).toEqual([]);
    expect(result.summary.overwritten).toEqual([]);
    expect(result.pushes[0].patch).toEqual({ title: 'Anmeldung' });
    expect(result.stories[0].description).toBe('New text');
  });

  it('AC8.4 takes the same change on both sides without a conflict', () => {
    const result = plan([story({ title: 'Login-Seite' })], [issue(31, { title: 'Login-Seite' })], { write: true, conflict: 'ask' });
    expect(result.summary.conflicts).toEqual([]);
    expect(result.pushes).toEqual([]);
    expect(result.stories[0].link?.base?.title).toBe('Login-Seite');
  });
});

describe('what is not on GitHub yet', () => {
  it('AC9.1 names the fields that changed here since the last sync', () => {
    const changed = story({ title: 'Anmeldung', status: 'done' });
    expect(pendingFields(changed, labelsField, statuses)).toEqual(['title', 'done']);
    expect(pendingFields(story(), labelsField, statuses)).toEqual([]);
  });

  it('AC9.1 marks nothing on a story of the team', () => {
    const own = story({ title: 'Anmeldung', link: undefined });
    expect(pendingFields(own, labelsField, statuses)).toEqual([]);
  });

  it('AC9.2 has nothing pending once the published fields are the new base', () => {
    // Given a story with a changed title that was published
    const changed = story({ title: 'Anmeldung' });
    const after = withBase(changed, toItem(issue(31, { title: 'Anmeldung' })), ['title']);
    // Then it is no longer pending
    expect(pendingFields(after, labelsField, statuses)).toEqual([]);
  });
});

describe('creating an issue from a story', () => {
  it('AC10.1 makes the issue of title, description with criteria and labels, and links the story to it', () => {
    // Given a story of the team
    const own = story(
      {
        title: 'Export as CSV',
        description: 'Export the backlog.',
        criteria: [{ id: 'c1', text: 'Header row', done: true }],
        values: { [LABELS_FIELD_ID]: ['gh-label-bug'] },
        link: undefined
      },
      {}
    );
    // When the issue is made
    const input = toNewIssue(newItemOf(own, labelsField, statuses));
    expect(input).toEqual({ title: 'Export as CSV', body: 'Export the backlog.\n\n## Acceptance criteria\n- [x] Header row', labels: ['bug'] });
    // Then the link points to the new issue and starts from its state
    const created = issue(44, { title: 'Export as CSV', body: input.body, labels: ['bug'] });
    expect(linkTo('github', toItem(created))).toEqual({
      service: 'github',
      key: '#44',
      url: issueUrl(repo, 44),
      state: 'open',
      base: { title: 'Export as CSV', description: 'Export the backlog.', labels: ['bug'], criteria: [{ text: 'Header row', done: true }], done: false, release: null, epic: null, status: null }
    });
  });

  it('AC10.3 does not bring back an issue whose story was deleted', () => {
    // Given an open issue whose address was ignored
    const result = plan([], [issue(31)], { ignored: [issueUrl(repo, 31)] });
    expect(result.stories).toEqual([]);
    expect(plan([], [issue(31)]).stories).toHaveLength(1);
  });
});

describe('the text of an issue', () => {
  it('writes description and criteria so that splitting gives them back', () => {
    const criteria = [{ text: 'One', done: false }, { text: 'Two', done: true }];
    expect(splitBody(composeBody('Some text', criteria))).toEqual({ description: 'Some text', criteria });
    expect(composeBody('', [])).toBe('');
  });

  it('adds the section when the text has none and drops an emptied one', () => {
    expect(withCriteria('Text', [{ text: 'One', done: false }])).toBe('Text\n\n## Acceptance criteria\n- [ ] One');
    expect(withCriteria('Text\n\n## Acceptance criteria\n- [ ] One\n', [])).toBe('Text');
  });
});
