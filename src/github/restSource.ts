import type { GithubIssue, RepoRef } from '../domain/github';
import { repoText } from '../domain/github';
import { GithubError, type GithubSource } from './source';

const API = 'https://api.github.com';
const PAGE_SIZE = 100;
/** A safety limit: 3000 open issues are more than a team plans by hand. */
const MAX_PAGES = 30;

interface RawIssue {
  number: number;
  title: string;
  body?: string | null;
  state: string;
  html_url: string;
  labels?: Array<string | { name?: string | null }>;
  pull_request?: unknown;
}

function toIssue(raw: RawIssue): GithubIssue {
  return {
    number: raw.number,
    title: raw.title,
    body: raw.body ?? '',
    state: raw.state === 'closed' ? 'closed' : 'open',
    labels: (raw.labels ?? []).map((label) => (typeof label === 'string' ? label : (label.name ?? ''))).filter((name) => name !== ''),
    url: raw.html_url
  };
}

/** Reads issues through the REST API of GitHub with a token that may only read. */
export function createRestSource(fetchImpl: typeof fetch = (...args) => fetch(...args)): GithubSource {
  async function get(path: string, token: string): Promise<Response> {
    let response: Response;
    try {
      response = await fetchImpl(`${API}${path}`, {
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' }
      });
    } catch {
      throw new GithubError('network');
    }
    if (response.ok) return response;
    if (response.status === 401) throw new GithubError('auth');
    if (response.status === 403) throw new GithubError(response.headers.get('x-ratelimit-remaining') === '0' ? 'rateLimit' : 'auth');
    if (response.status === 404) throw new GithubError('notFound');
    throw new GithubError('other', `HTTP ${response.status}`);
  }

  return {
    async openIssues(repo: RepoRef, token: string): Promise<GithubIssue[]> {
      const issues: GithubIssue[] = [];
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const response = await get(`/repos/${repoText(repo)}/issues?state=open&per_page=${PAGE_SIZE}&page=${page}`, token);
        const raw = (await response.json()) as RawIssue[];
        // The issues list of GitHub also holds the pull requests.
        issues.push(...raw.filter((item) => item.pull_request === undefined).map(toIssue));
        if (raw.length < PAGE_SIZE) break;
      }
      return issues;
    },
    async issue(repo: RepoRef, token: string, number: number): Promise<GithubIssue | null> {
      try {
        const raw = (await (await get(`/repos/${repoText(repo)}/issues/${number}`, token)).json()) as RawIssue;
        return raw.pull_request === undefined ? toIssue(raw) : null;
      } catch (cause) {
        if (cause instanceof GithubError && cause.kind === 'notFound') return null;
        throw cause;
      }
    }
  };
}
