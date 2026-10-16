import { beforeEach, describe, expect, it } from 'vitest';
import type { GithubIssue } from '../domain/github';
import { fakeGithub } from '../test/fakeGithub';
import { createDemoSource, DEMO_READONLY_TOKEN, DEMO_REPO, saveDemoIssues, resetDemoIssues } from './demoSource';
import { createRestSource } from './restSource';
import type { TrackerConnector } from './source';

/*
 * One test series that every connector has to pass (#30, ADR 0004): reading, writing, errors. The sync engine knows no
 * service, so a new service is "only" a connector that passes this series. Three connectors run it: the REST connector
 * of GitHub against a small imitation of the API, the simulated GitHub of the preview, and the fake of the other tests.
 */

const repo = { owner: DEMO_REPO.owner, name: DEMO_REPO.name };
const urlOf = (number: number): string => `https://github.com/${repo.owner}/${repo.name}/issues/${number}`;
const item = (number: number, extra: Partial<GithubIssue> = {}): GithubIssue => ({ number, title: `Issue ${number}`, body: '', state: 'open', labels: [], url: urlOf(number), ...extra });

const SEED: GithubIssue[] = [item(31, { title: 'Login', body: 'Text', labels: ['feature'] }), item(29, { title: 'Imprint', state: 'closed' }), item(35, { title: 'Export' })];

interface Backend {
  connector: TrackerConnector;
  /** The token to use: the one that may write, or the one that may only read. */
  token(write: boolean): string;
}

function restBackend(): Backend {
  const state = { issues: SEED.map((issue) => ({ ...issue })), known: ['feature', 'bug', 'docs'] };
  const raw = (issue: GithubIssue) => ({ number: issue.number, title: issue.title, body: issue.body, state: issue.state, html_url: issue.url, labels: issue.labels.map((name) => ({ name })) });
  const answer = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const authorization = (init?.headers as Record<string, string>).Authorization;
    const path = url.pathname.replace(`/repos/${repo.owner}/${repo.name}`, '');
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    if (method !== 'GET' && authorization !== 'Bearer writer') return answer(403, {});
    if (method === 'GET' && path === '/issues') return answer(200, state.issues.filter((issue) => issue.state === 'open').map(raw));
    if (method === 'GET' && path === '/labels') return answer(200, state.known.map((name) => ({ name })));
    const match = /^\/issues\/(\d+)$/.exec(path);
    if (method === 'GET' && match) {
      const found = state.issues.find((issue) => issue.number === Number(match[1]));
      return found ? answer(200, raw(found)) : answer(404, {});
    }
    if (method === 'PATCH' && match) {
      const index = state.issues.findIndex((issue) => issue.number === Number(match[1]));
      if (index < 0) return answer(404, {});
      const changed = { ...state.issues[index], ...body } as GithubIssue;
      state.issues[index] = changed;
      return answer(200, raw(changed));
    }
    if (method === 'POST' && path === '/issues') {
      const number = state.issues.reduce((max, issue) => Math.max(max, issue.number), 0) + 1;
      const created: GithubIssue = { number, title: String(body.title), body: String(body.body), state: 'open', labels: (body.labels as string[]) ?? [], url: urlOf(number) };
      state.issues.push(created);
      return answer(200, raw(created));
    }
    return answer(404, {});
  }) as typeof fetch;
  // The imitation answers labels of a PATCH as names; the connector sends names, so they land in the issue as they are.
  return { connector: createRestSource(fetchImpl), token: (write) => (write ? 'writer' : 'reader') };
}

function demoBackend(): Backend {
  resetDemoIssues();
  saveDemoIssues(SEED.map((issue) => ({ ...issue })));
  return { connector: createDemoSource(), token: (write) => (write ? 'writer' : DEMO_READONLY_TOKEN) };
}

function fakeBackend(): Backend {
  const fake = fakeGithub(SEED.map((issue) => ({ ...issue })));
  const wrapped = fake.github.source;
  // The fake knows one token; the right to write is switched by the token of the call.
  const connector: TrackerConnector = {
    kind: 'github',
    openIssues: (r) => wrapped.openIssues(r, 'good'),
    issue: (r, _t, n) => wrapped.issue(r, 'good', n),
    updateIssue: async (r, t, n, patch) => {
      fake.state.canWrite = t === 'writer';
      return wrapped.updateIssue(r, 'good', n, patch);
    },
    createIssue: async (r, t, input) => {
      fake.state.canWrite = t === 'writer';
      return wrapped.createIssue(r, 'good', input);
    }
  };
  return { connector, token: (canWrite) => (canWrite ? 'writer' : 'reader') };
}

const BACKENDS: Array<[string, () => Backend]> = [
  ['REST connector of GitHub', restBackend],
  ['simulated GitHub of the preview', demoBackend],
  ['fake of the tests', fakeBackend]
];

describe.each(BACKENDS)('AC11.3 connector contract: %s', (_name, make) => {
  let backend: Backend;
  beforeEach(() => {
    backend = make();
  });

  it('lists only the open items, with title, text, labels and address', async () => {
    const open = await backend.connector.openIssues(repo, backend.token(false));
    expect(open.map((issue) => issue.number).sort()).toEqual([31, 35]);
    expect(open.find((issue) => issue.number === 31)).toMatchObject({ title: 'Login', body: 'Text', labels: ['feature'], state: 'open', url: urlOf(31) });
  });

  it('returns one item even when it is closed, and nothing for an unknown one', async () => {
    expect(await backend.connector.issue(repo, backend.token(false), 29)).toMatchObject({ number: 29, state: 'closed' });
    expect(await backend.connector.issue(repo, backend.token(false), 999)).toBeNull();
  });

  it('changes title, text and state and gives back the item as it is now', async () => {
    const { item: changed, skippedLabels } = await backend.connector.updateIssue(repo, backend.token(true), 31, { title: 'Login-Seite', body: 'New text', state: 'closed' });
    expect(changed).toMatchObject({ number: 31, title: 'Login-Seite', body: 'New text', state: 'closed' });
    expect(skippedLabels).toEqual([]);
    expect(await backend.connector.issue(repo, backend.token(false), 31)).toMatchObject({ title: 'Login-Seite', state: 'closed' });
  });

  it('sets only labels the service has and reports the others', async () => {
    const { item: changed, skippedLabels } = await backend.connector.updateIssue(repo, backend.token(true), 31, { labels: ['bug', 'does-not-exist'] });
    expect(changed.labels).toEqual(['bug']);
    expect(skippedLabels).toEqual(['does-not-exist']);
  });

  it('creates an item that is then in the list of open items', async () => {
    const { item: created, skippedLabels } = await backend.connector.createIssue(repo, backend.token(true), { title: 'Export as CSV', body: 'Text', labels: ['feature', 'nope'] });
    expect(created).toMatchObject({ title: 'Export as CSV', body: 'Text', state: 'open', labels: ['feature'] });
    expect(skippedLabels).toEqual(['nope']);
    expect((await backend.connector.openIssues(repo, backend.token(false))).map((issue) => issue.number)).toContain(created.number);
  });

  it('says "forbidden" when the token may only read', async () => {
    await expect(backend.connector.updateIssue(repo, backend.token(false), 31, { title: 'x' })).rejects.toMatchObject({ kind: 'forbidden' });
    await expect(backend.connector.createIssue(repo, backend.token(false), { title: 'x', body: '', labels: [] })).rejects.toMatchObject({ kind: 'forbidden' });
  });
});
