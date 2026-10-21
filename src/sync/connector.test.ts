import { beforeEach, describe, expect, it } from 'vitest';
import { seedSnapshot } from '../data/seed';
import { LABELS_FIELD_ID, pendingFields } from '../domain/sync';
import type { Story } from '../domain/types';
import { exampleTracker, exampleUrl } from '../test/exampleConnector';
import { fakeGithub } from '../test/fakeGithub';
import type { TrackerConnector } from './connector';
import type { GithubApi } from './github/api';
import { createGithubConnector } from './github/connector';
import { createDemoApi, DEMO_READONLY_TOKEN, DEMO_REPO, resetDemoIssues, saveDemoIssues } from './github/demoApi';
import type { GithubIssue } from './github/format';
import { runSync } from './runSync';

/*
 * One test series that every connector has to pass (#66, AC11.1): reading, writing, errors and a run of the sync engine.
 * The engine knows no service, so a new service is "only" a connector that passes this series. Three connectors run it:
 * the connector of GitHub on the fake and on the simulated GitHub of the preview, and a second service that looks like
 * GitLab and nothing like GitHub.
 */

const repo = { owner: DEMO_REPO.owner, name: DEMO_REPO.name };
const githubUrl = (number: number): string => `https://github.com/${repo.owner}/${repo.name}/issues/${number}`;
const githubIssue = (number: number, extra: Partial<GithubIssue> = {}): GithubIssue => ({ number, title: `Issue ${number}`, body: '', state: 'open', labels: [], url: githubUrl(number), ...extra });
const SEED: GithubIssue[] = [githubIssue(31, { title: 'Login', body: 'Text', labels: ['feature'] }), githubIssue(29, { title: 'Imprint', state: 'closed' }), githubIssue(35, { title: 'Export' })];

interface Backend {
  connector: TrackerConnector;
  target: unknown;
  /** The token to use: the one that may write, the one that may only read, and one that is refused. */
  token(kind: 'writer' | 'reader' | 'wrong'): string;
  /** The first open item and a closed one: their ids and keys. */
  ids: { open: string; closed: string; openKey: string; unknown: string };
}

function githubOnFake(): Backend {
  const fake = fakeGithub(SEED.map((issue) => ({ ...issue })));
  // The fake knows one token; the right to write is switched by the token of the call.
  const wrapped = fake.api;
  const api: GithubApi = {
    ...wrapped,
    openIssues: (r, t) => wrapped.openIssues(r, t === 'wrong' ? t : 'good'),
    issue: (r, t, n) => wrapped.issue(r, t === 'wrong' ? t : 'good', n),
    updateIssue: async (r, t, n, patch) => {
      fake.state.canWrite = t === 'writer';
      return wrapped.updateIssue(r, 'good', n, patch);
    },
    createIssue: async (r, t, input) => {
      fake.state.canWrite = t === 'writer';
      return wrapped.createIssue(r, 'good', input);
    },
    listMilestones: (r) => wrapped.listMilestones(r, 'good'),
    listLabels: (r) => wrapped.listLabels(r, 'good')
  };
  return { connector: createGithubConnector(api), target: repo, token: (kind) => kind, ids: { open: '31', closed: '29', openKey: '#31', unknown: '999' } };
}

function githubOnDemo(): Backend {
  resetDemoIssues();
  saveDemoIssues(SEED.map((issue) => ({ ...issue })));
  const tokens = { writer: 'writer', reader: DEMO_READONLY_TOKEN, wrong: 'falsch' };
  return { connector: createGithubConnector(createDemoApi()), target: repo, token: (kind) => tokens[kind], ids: { open: '31', closed: '29', openKey: '#31', unknown: '999' } };
}

function gitlabLike(): Backend {
  const tracker = exampleTracker([
    { iid: 12, title: 'Login', text: 'Text', closed: false, labels: ['feature', 'status::doing'], milestone: null },
    { iid: 10, title: 'Imprint', text: '', closed: true, labels: [], milestone: null },
    { iid: 14, title: 'Export', text: '', closed: false, labels: [], milestone: null }
  ]);
  // The right to write is switched by the token of the call.
  const connector: TrackerConnector<{ project: string }> = {
    ...tracker.connector,
    update: async (target, token, item, patch, context) => {
      tracker.state.canWrite = token === 'writer';
      return tracker.connector.update(target, tracker.state.goodToken, item, patch, context);
    },
    create: async (target, token, item, context) => {
      tracker.state.canWrite = token === 'writer';
      return tracker.connector.create(target, tracker.state.goodToken, item, context);
    },
    open: (target, token) => tracker.connector.open(target, token === 'wrong' ? token : tracker.state.goodToken),
    item: (target, token, id) => tracker.connector.item(target, token === 'wrong' ? token : tracker.state.goodToken, id)
  };
  return { connector: connector as unknown as TrackerConnector, target: { project: 'team/app' }, token: (kind) => kind, ids: { open: '12', closed: '10', openKey: '#12', unknown: '999' } };
}

const BACKENDS: Array<[string, () => Backend]> = [
  ['GitHub on the fake', githubOnFake],
  ['GitHub on the simulation of the preview', githubOnDemo],
  ['a second service that looks like GitLab', gitlabLike]
];

describe.each(BACKENDS)('AC11.1 connector series: %s', (_name, make) => {
  let backend: Backend;
  beforeEach(() => {
    backend = make();
  });

  it('lists only the open items, with key, address, title, text and labels', async () => {
    const open = await backend.connector.open(backend.target, backend.token('reader'));
    expect(open).toHaveLength(2);
    const login = open.find((item) => item.id === backend.ids.open);
    expect(login).toMatchObject({ key: backend.ids.openKey, state: 'open', fields: { title: 'Login', description: 'Text', done: false } });
    expect(login?.fields.labels).toContain('feature');
    expect(login?.url).toMatch(/^https:\/\//);
  });

  it('returns one item even when it is closed, and nothing for an unknown one', async () => {
    expect(await backend.connector.item(backend.target, backend.token('reader'), backend.ids.closed)).toMatchObject({ state: 'closed', fields: { done: true } });
    expect(await backend.connector.item(backend.target, backend.token('reader'), backend.ids.unknown)).toBeNull();
  });

  it('tells which item a link points to, and none for a link of another target', async () => {
    const [first] = await backend.connector.open(backend.target, backend.token('reader'));
    expect(backend.connector.idOf(backend.target, { service: backend.connector.kind, key: first.key, url: first.url, state: 'open' })).toBe(first.id);
    expect(backend.connector.idOf(backend.target, { service: backend.connector.kind, key: '#1', url: 'https://other.example/x/-/issues/1', state: 'open' })).toBeNull();
  });

  it('changes title, text and state and gives back the item as it is now', async () => {
    const catalog = await backend.connector.catalog(backend.target, backend.token('reader'));
    const [first] = await backend.connector.open(backend.target, backend.token('reader'));
    const context = { epics: [], releases: [], statuses: [], catalog, made: { labels: [], milestones: [] } };
    const { item } = await backend.connector.update(backend.target, backend.token('writer'), first, { title: 'Login-Seite', description: 'New text', done: true }, context);
    expect(item).toMatchObject({ state: 'closed', fields: { title: 'Login-Seite', description: 'New text', done: true } });
    expect(await backend.connector.item(backend.target, backend.token('reader'), first.id)).toMatchObject({ state: 'closed', fields: { title: 'Login-Seite' } });
  });

  it('creates an item that is then in the list of open items', async () => {
    const catalog = await backend.connector.catalog(backend.target, backend.token('reader'));
    const context = { epics: [], releases: [], statuses: [], catalog, made: { labels: [], milestones: [] } };
    const { item } = await backend.connector.create(backend.target, backend.token('writer'), { title: 'Export as CSV', description: 'Text', criteria: [], labels: ['feature'], epic: null, status: null }, context);
    expect(item.fields).toMatchObject({ title: 'Export as CSV', description: 'Text' });
    expect((await backend.connector.open(backend.target, backend.token('reader'))).map((entry) => entry.id)).toContain(item.id);
  });

  it('says "forbidden" when the token may only read, and "auth" when it is refused', async () => {
    const catalog = await backend.connector.catalog(backend.target, backend.token('reader'));
    const [first] = await backend.connector.open(backend.target, backend.token('reader'));
    const context = { epics: [], releases: [], statuses: [], catalog, made: { labels: [], milestones: [] } };
    await expect(backend.connector.update(backend.target, backend.token('reader'), first, { title: 'x' }, context)).rejects.toMatchObject({ kind: 'forbidden' });
    await expect(backend.connector.create(backend.target, backend.token('reader'), { title: 'x', description: '', criteria: [], labels: [], epic: null, status: null }, context)).rejects.toMatchObject({ kind: 'forbidden' });
    await expect(backend.connector.open(backend.target, backend.token('wrong'))).rejects.toMatchObject({ kind: 'auth' });
  });

  it('runs through the sync engine: imports, publishes a local change and has nothing pending afterwards', async () => {
    // Given the stories of an empty team and the engine with this connector
    const seed = seedSnapshot('2026-10-12');
    let counter = 0;
    const run = (stories: Story[], write: boolean, token: 'writer' | 'reader') =>
      runSync({
        connector: backend.connector,
        target: backend.target,
        token: backend.token(token),
        stories,
        fields: seed.fields,
        assignments: seed.assignments,
        statuses: seed.statuses,
        epics: [],
        releases: [],
        managed: { labels: [], milestones: [] },
        newId: () => `id-${(counter += 1)}`,
        write,
        conflict: 'remote',
        ignored: []
      });
    // When it imports
    const imported = await run([], false, 'reader');
    // Then both open items are stories with their keys
    expect(imported.error).toBeNull();
    expect(imported.plan.stories.map((story) => story.link?.key).sort()).toHaveLength(2);
    expect(imported.plan.stories.every((story) => story.link?.service === backend.connector.kind)).toBe(true);
    // And a local change is published with writing on
    const login = imported.plan.stories.find((story) => story.title === 'Login') as Story;
    const changed = imported.plan.stories.map((story) => (story.id === login.id ? { ...story, title: 'Login-Seite' } : story));
    const labelsField = imported.plan.fields.find((field) => field.id === LABELS_FIELD_ID);
    expect(pendingFields(changed.find((story) => story.id === login.id) as Story, labelsField, seed.statuses, {}, backend.connector.capabilities.fields)).toEqual(['title']);
    const published = await run(changed, true, 'writer');
    expect(published.error).toBeNull();
    expect(published.summary.published.map((entry) => entry.fields)).toEqual([['title']]);
    expect(pendingFields(published.plan.stories.find((story) => story.id === login.id) as Story, labelsField, seed.statuses, {}, backend.connector.capabilities.fields)).toEqual([]);
    expect((await backend.connector.item(backend.target, backend.token('reader'), backend.ids.open))?.fields.title).toBe('Login-Seite');
  });
});

describe('AC11.3 a service only needs a connector', () => {
  it('the second service is planned in the settings, it has its own key format and fewer fields', () => {
    const { connector } = exampleTracker([]);
    expect(connector.kind).toBe('gitlab');
    expect(connector.capabilities.fields).not.toContain('criteria');
    expect(exampleUrl(12)).toBe('https://gitlab.example/team/app/-/issues/12');
  });
});
