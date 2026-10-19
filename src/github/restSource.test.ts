import { describe, expect, it } from 'vitest';
import { createRestSource } from './restSource';
import { GithubError } from './source';

const repo = { owner: 'goerks', name: 'GetThingsDone' };

const raw = (number: number, extra: Record<string, unknown> = {}) => ({
  number,
  title: `Issue ${number}`,
  body: null,
  state: 'open',
  html_url: `https://github.com/goerks/GetThingsDone/issues/${number}`,
  labels: [{ name: 'feature' }, 'bug', { name: null }],
  ...extra
});

const json = (body: unknown, init: ResponseInit = {}): Response => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init });

describe('reading issues from GitHub', () => {
  it('AC2.1 reads title, text, labels and address of the open issues and asks with a token that only reads', async () => {
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    const source = createRestSource(async (url, init) => {
      calls.push({ url: String(url), headers: init?.headers as Record<string, string> });
      return json([raw(31, { body: 'Text' }), raw(35)]);
    });
    const issues = await source.openIssues(repo, 'secret');
    expect(issues).toEqual([
      { number: 31, title: 'Issue 31', body: 'Text', state: 'open', labels: ['feature', 'bug'], url: 'https://github.com/goerks/GetThingsDone/issues/31', milestone: null },
      { number: 35, title: 'Issue 35', body: '', state: 'open', labels: ['feature', 'bug'], url: 'https://github.com/goerks/GetThingsDone/issues/35', milestone: null }
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.github.com/repos/goerks/GetThingsDone/issues?state=open&per_page=100&page=1');
    expect(calls[0].headers.Authorization).toBe('Bearer secret');
  });

  it('AC2.3 leaves out pull requests', async () => {
    const source = createRestSource(async () => json([raw(1), raw(2, { pull_request: { url: 'x' } })]));
    expect((await source.openIssues(repo, 't')).map((issue) => issue.number)).toEqual([1]);
    const one = createRestSource(async () => json(raw(2, { pull_request: {} })));
    expect(await one.issue(repo, 't', 2)).toBeNull();
  });

  it('AC2.1 follows the pages', async () => {
    const pages = [Array.from({ length: 100 }, (_, index) => raw(index + 1)), [raw(101)]];
    let page = 0;
    const source = createRestSource(async () => json(pages[page++]));
    expect(await source.openIssues(repo, 't')).toHaveLength(101);
  });

  it('AC5.1 says "network" when there is no connection', async () => {
    const source = createRestSource(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(source.openIssues(repo, 't')).rejects.toMatchObject({ kind: 'network' });
  });

  it('AC5.2 and AC1.4 tell a wrong token, a missing repository and the limit apart', async () => {
    const answer = (status: number, headers: Record<string, string> = {}) => createRestSource(async () => new Response('{}', { status, headers }));
    await expect(answer(401).openIssues(repo, 't')).rejects.toMatchObject({ kind: 'auth' });
    await expect(answer(403).openIssues(repo, 't')).rejects.toMatchObject({ kind: 'auth' });
    await expect(answer(403, { 'x-ratelimit-remaining': '0' }).openIssues(repo, 't')).rejects.toMatchObject({ kind: 'rateLimit' });
    await expect(answer(404).openIssues(repo, 't')).rejects.toMatchObject({ kind: 'notFound' });
    await expect(answer(500).openIssues(repo, 't')).rejects.toBeInstanceOf(GithubError);
    await expect(answer(500).openIssues(repo, 't')).rejects.toMatchObject({ kind: 'other' });
  });

  it('asks for one issue and says nothing when it is gone', async () => {
    const found = createRestSource(async () => json(raw(7, { state: 'closed' })));
    expect(await found.issue(repo, 't', 7)).toMatchObject({ number: 7, state: 'closed' });
    const gone = createRestSource(async () => new Response('{}', { status: 404 }));
    expect(await gone.issue(repo, 't', 7)).toBeNull();
  });
});
