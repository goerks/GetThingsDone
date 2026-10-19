import { describe, expect, it } from 'vitest';
import { seedSnapshot } from '../data/seed';
import { inRepo, issueNumberOf, issueUrl, LABELS_FIELD_ID, linkedNumbersMissingIn, parseRepo, planSync, splitBody, type GithubIssue, type SyncInput } from './github';
import { DEFAULT_SETTINGS, normalizeSettings } from './settings';

const repo = { owner: 'goerks', name: 'GetThingsDone' };
const seed = seedSnapshot('2026-10-12');

const issue = (number: number, extra: Partial<GithubIssue> = {}): GithubIssue => ({
  number,
  title: `Issue ${number}`,
  body: '',
  state: 'open',
  labels: [],
  url: issueUrl(repo, number),
  ...extra
});

let counter = 0;
const nextId = (): string => `id-${(counter += 1)}`;

const input = (issues: GithubIssue[], stories = seed.stories, fields = seed.fields, assignments = seed.assignments): SyncInput => ({
  stories,
  fields,
  assignments,
  statuses: seed.statuses,
  repo,
  issues,
  newId: nextId
});

describe('the repository', () => {
  it('reads owner/name and refuses everything else', () => {
    expect(parseRepo('goerks/GetThingsDone')).toEqual(repo);
    expect(parseRepo('  https://github.com/goerks/GetThingsDone.git/ ')).toEqual(repo);
    for (const bad of ['', 'abc', 'a/b/c', '/b', 'a/', 'a b/c', '../x', 'a/..']) expect(parseRepo(bad), bad).toBeNull();
  });

  it('names an issue by its address', () => {
    expect(issueUrl(repo, 31)).toBe('https://github.com/goerks/GetThingsDone/issues/31');
    expect(issueNumberOf(issueUrl(repo, 31))).toBe(31);
    expect(issueNumberOf('https://example.com')).toBeNull();
    expect(inRepo(issueUrl(repo, 1), repo)).toBe(true);
    expect(inRepo('https://github.com/other/repo/issues/1', repo)).toBe(false);
  });
});

describe('settings of the GitHub connection', () => {
  it('AC1.1 is off by default and has no repository', () => {
    expect(DEFAULT_SETTINGS.features.github).toBe(false);
    expect(DEFAULT_SETTINGS.github).toEqual({ repo: '', lastSyncAt: null, write: false, conflict: 'remote', ignored: [] });
    expect(normalizeSettings({ features: { releases: true } }).features.github).toBe(false);
    expect(normalizeSettings({ features: { github: 'x' } }).features.github).toBe(false);
  });

  it('AC1.5 keeps the repository and the time of the last sync when the feature is switched', () => {
    const stored = { features: { releases: true, github: '1' }, github: { repo: 'goerks/GetThingsDone', lastSyncAt: '2026-10-12T10:00:00.000Z' } };
    expect(normalizeSettings(stored).features.github).toBe(true);
    expect(normalizeSettings(stored).github).toMatchObject(stored.github);
    expect(normalizeSettings({ ...stored, features: { github: false } }).github).toMatchObject(stored.github);
  });
});

describe('the text of an issue', () => {
  it('AC3.5 turns the task list under "Acceptance criteria" into criteria and takes it out of the description', () => {
    const body = 'Users log in.\r\n\r\n## Acceptance criteria\r\n- [ ] Login possible\r\n- [x] Error message for a wrong password\r\n\r\n## Notes\r\nSee the design.';
    expect(splitBody(body)).toEqual({
      description: 'Users log in.\n\n## Notes\nSee the design.',
      criteria: [
        { text: 'Login possible', done: false },
        { text: 'Error message for a wrong password', done: true }
      ]
    });
  });

  it('AC3.5 also knows the German headings, other bullets and capital X', () => {
    expect(splitBody('### Akzeptanzkriterien:\n* [X] Eins\n+ [ ] Zwei').criteria).toEqual([
      { text: 'Eins', done: true },
      { text: 'Zwei', done: false }
    ]);
    expect(splitBody('# Abnahmekriterien\n- [ ] Eins').criteria).toHaveLength(1);
  });

  it('AC3.6 leaves tasks under another heading, and a heading without tasks, in the description', () => {
    const todo = 'Text\n\n## Todo\n- [ ] Buy milk';
    expect(splitBody(todo)).toEqual({ description: todo, criteria: [] });
    const empty = '## Acceptance criteria\nTo be defined.';
    expect(splitBody(empty)).toEqual({ description: empty, criteria: [] });
    expect(splitBody('')).toEqual({ description: '', criteria: [] });
  });

  it('AC3.6 does not mistake a task in the text before the heading for a criterion', () => {
    expect(splitBody('- [ ] intro task\n\n## Acceptance criteria\n- [ ] real').criteria).toEqual([{ text: 'real', done: false }]);
  });
});

describe('importing issues', () => {
  it('AC2.1 makes a story of every open issue with title, description, labels, criteria and the link', () => {
    const plan = planSync(
      input([
        issue(31, { title: 'Login', body: 'Text\n\n## Acceptance criteria\n- [ ] A\n- [x] B', labels: ['feature', 'bug'] }),
        issue(35, { title: 'Export' })
      ])
    );
    const created = plan.stories.slice(seed.stories.length);
    expect(created.map((story) => story.title)).toEqual(['Login', 'Export']);
    const [login] = created;
    expect(login).toMatchObject({ description: 'Text', status: 'todo', sprintId: null, epicId: null, points: 0, github: { url: issueUrl(repo, 31), state: 'open' } });
    expect(login.criteria.map(({ text, done }) => ({ text, done }))).toEqual([
      { text: 'A', done: false },
      { text: 'B', done: true }
    ]);
    const labels = plan.fields.find((field) => field.id === LABELS_FIELD_ID);
    expect(labels?.options.map((option) => option.label)).toEqual(['feature', 'bug']);
    expect(login.values[LABELS_FIELD_ID]).toHaveLength(2);
    expect(plan.assignments.some((item) => item.fieldId === LABELS_FIELD_ID && item.itemType === 'story')).toBe(true);
    expect(plan.summary.created.map((entry) => entry.number)).toEqual([31, 35]);
    expect(new Set(plan.stories.map((story) => story.code)).size).toBe(plan.stories.length);
  });

  it('AC2.2 does not import an issue twice', () => {
    const first = planSync(input([issue(31), issue(35)]));
    const second = planSync(input([issue(31), issue(35)], first.stories, first.fields, first.assignments));
    expect(second.stories).toHaveLength(first.stories.length);
    expect(second.summary).toEqual({ created: [], closed: [], updated: [], published: [], overwritten: [], conflicts: [], pending: 0, releasesCreated: [], epicsCreated: [], missingMilestones: [], multipleEpics: [] });
  });

  it('AC2.1 does not import a closed issue that has no story', () => {
    expect(planSync(input([issue(29, { state: 'closed' })])).stories).toHaveLength(seed.stories.length);
  });

  it('AC2.1 ignores issues of another repository', () => {
    expect(planSync(input([issue(1, { url: 'https://github.com/other/repo/issues/1' })])).stories).toHaveLength(seed.stories.length);
  });
});

describe('syncing', () => {
  const imported = (extra: Partial<GithubIssue> = {}) => {
    const first = planSync(input([issue(31, { title: 'Login', body: 'Old\n\n## Acceptance criteria\n- [ ] A\n- [ ] B', labels: ['feature'], ...extra })]));
    const story = first.stories[first.stories.length - 1];
    return { first, story, again: (issues: GithubIssue[]) => planSync(input(issues, first.stories, first.fields, first.assignments)) };
  };

  it('AC3.1 takes title, description and labels from GitHub and tells what changed', () => {
    const { story, again } = imported();
    const plan = again([issue(31, { title: 'Login-Seite', body: 'New\n\n## Acceptance criteria\n- [ ] A\n- [ ] B', labels: ['feature', 'bug'] })]);
    const after = plan.stories.find((item) => item.id === story.id);
    expect(after).toMatchObject({ title: 'Login-Seite', description: 'New' });
    expect(after?.values[LABELS_FIELD_ID]).toHaveLength(2);
    expect(plan.summary.updated).toHaveLength(1);
    expect(plan.summary.updated[0].changes).toEqual([
      { kind: 'title', from: 'Login', to: 'Login-Seite' },
      { kind: 'description' },
      { kind: 'labels', added: ['bug'], removed: [] }
    ]);
  });

  it('AC3.2 puts a story whose issue was closed into Done, and back to the start when it is opened again', () => {
    const { story, again } = imported();
    const closed = again([issue(31, { title: 'Login', state: 'closed', body: 'Old\n\n## Acceptance criteria\n- [ ] A\n- [ ] B', labels: ['feature'] })]);
    expect(closed.stories.find((item) => item.id === story.id)).toMatchObject({ status: 'done', github: { state: 'closed' } });
    expect(closed.summary.closed.map((entry) => entry.number)).toEqual([31]);
    expect(closed.summary.updated).toEqual([]);
    const reopened = planSync(input([issue(31, { title: 'Login', body: 'Old\n\n## Acceptance criteria\n- [ ] A\n- [ ] B', labels: ['feature'] })], closed.stories, closed.fields, closed.assignments));
    expect(reopened.stories.find((item) => item.id === story.id)).toMatchObject({ status: 'todo', github: { state: 'open' } });
    expect(reopened.summary.updated[0].changes).toEqual([{ kind: 'reopened' }]);
  });

  it('AC3.2 leaves a story that was finished here alone while its issue is still open', () => {
    const { first, story } = imported();
    const done = first.stories.map((item) => (item.id === story.id ? { ...item, status: 'done' } : item));
    const plan = planSync(input([issue(31, { title: 'Login', body: 'Old\n\n## Acceptance criteria\n- [ ] A\n- [ ] B', labels: ['feature'] })], done, first.fields, first.assignments));
    expect(plan.stories.find((item) => item.id === story.id)?.status).toBe('done');
    expect(plan.summary.updated).toEqual([]);
  });

  it('AC3.3 lets GitHub win over a local change of the title when GitHub changed it too', () => {
    const { first, story } = imported();
    const edited = first.stories.map((item) => (item.id === story.id ? { ...item, title: 'My own title' } : item));
    const plan = planSync(input([issue(31, { title: 'Login-Seite', body: 'Old\n\n## Acceptance criteria\n- [ ] A\n- [ ] B', labels: ['feature'] })], edited, first.fields, first.assignments));
    expect(plan.stories.find((item) => item.id === story.id)?.title).toBe('Login-Seite');
    expect(plan.summary.updated[0].changes[0]).toEqual({ kind: 'title', from: 'My own title', to: 'Login-Seite' });
    expect(plan.summary.overwritten).toMatchObject([{ field: 'title', side: 'local', value: 'My own title' }]);
  });

  it('AC3.4 keeps sprint, points, epic, rank and the column of an open story', () => {
    const { first, story } = imported();
    const planned = first.stories.map((item) => (item.id === story.id ? { ...item, sprintId: 'sprint-2', points: 5, epicId: 'epic-1', status: 'in_progress', rank: 3 } : item));
    const plan = planSync(input([issue(31, { title: 'Login 2', body: 'Old\n\n## Acceptance criteria\n- [ ] A\n- [ ] B', labels: ['feature'] })], planned, first.fields, first.assignments));
    expect(plan.stories.find((item) => item.id === story.id)).toMatchObject({ title: 'Login 2', sprintId: 'sprint-2', points: 5, epicId: 'epic-1', status: 'in_progress', rank: 3 });
  });

  it('AC3.7 adds, removes and ticks criteria as GitHub has them and overwrites a local tick', () => {
    const { first, story } = imported();
    const ticked = first.stories.map((item) => (item.id === story.id ? { ...item, criteria: item.criteria.map((criterion) => (criterion.text === 'A' ? { ...criterion, done: true } : criterion)) } : item));
    const plan = planSync(input([issue(31, { title: 'Login', body: 'Old\n\n## Acceptance criteria\n- [ ] A\n- [x] C\n- [ ] D', labels: ['feature'] })], ticked, first.fields, first.assignments));
    const after = plan.stories.find((item) => item.id === story.id);
    expect(after?.criteria.map(({ text, done }) => ({ text, done }))).toEqual([
      { text: 'A', done: false },
      { text: 'C', done: true },
      { text: 'D', done: false }
    ]);
    const kept = story.criteria.find((criterion) => criterion.text === 'A');
    expect(after?.criteria[0].id).toBe(kept?.id);
    expect(plan.summary.updated[0].changes).toEqual([{ kind: 'criteria', added: 2, removed: 1, changed: 1 }]);
  });

  it('AC3.8 counts new, updated and closed issues apart', () => {
    const first = planSync(input([issue(1), issue(2), issue(3), issue(4)]));
    const plan = planSync(
      input([issue(1, { title: 'One' }), issue(2, { state: 'closed' }), issue(3), issue(4, { title: 'Four' }), issue(5)], first.stories, first.fields, first.assignments)
    );
    expect(plan.summary.created.map((entry) => entry.number)).toEqual([5]);
    expect(plan.summary.updated.map((entry) => entry.number)).toEqual([1, 4]);
    expect(plan.summary.closed.map((entry) => entry.number)).toEqual([2]);
  });

  it('asks for the issues of the stories that are no longer in the list of open issues', () => {
    const first = planSync(input([issue(1), issue(2), issue(3, { state: 'closed' })].filter((item) => item.state === 'open')));
    const closed = planSync(input([issue(1)], first.stories, first.fields, first.assignments));
    expect(linkedNumbersMissingIn(first.stories, repo, [issue(1)])).toEqual([2]);
    // A story already known to be closed is not asked for again.
    const marked = planSync(input([issue(2, { state: 'closed' })], closed.stories, closed.fields, closed.assignments));
    expect(linkedNumbersMissingIn(marked.stories, repo, [issue(1)])).toEqual([]);
  });
});
