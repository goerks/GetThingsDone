import type { ExternalMilestone, GithubIssue, ItemPatch, RepoRef } from '../domain/github';
import { repoText } from '../domain/github';
import { GithubError, type TrackerConnector, type WriteResult } from './source';

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
  milestone?: { title?: string | null } | null;
}

interface RawMilestone {
  number: number;
  title: string;
  description?: string | null;
  due_on?: string | null;
  state: string;
}

function toMilestone(raw: RawMilestone): ExternalMilestone {
  return { number: raw.number, title: raw.title, description: raw.description ?? '', dueOn: raw.due_on ? raw.due_on.slice(0, 10) : null, state: raw.state === 'closed' ? 'closed' : 'open' };
}

function toIssue(raw: RawIssue): GithubIssue {
  return {
    number: raw.number,
    title: raw.title,
    body: raw.body ?? '',
    state: raw.state === 'closed' ? 'closed' : 'open',
    labels: (raw.labels ?? []).map((label) => (typeof label === 'string' ? label : (label.name ?? ''))).filter((name) => name !== ''),
    url: raw.html_url,
    milestone: raw.milestone?.title ?? null
  };
}

/** Talks to the REST API of GitHub. Reading needs a token that may read issues; changing needs "Issues: read and write". */
export function createRestSource(fetchImpl: typeof fetch = (...args) => fetch(...args)): TrackerConnector {
  async function call(method: 'GET' | 'POST' | 'PATCH', path: string, token: string, body?: unknown): Promise<Response> {
    let response: Response;
    try {
      response = await fetchImpl(`${API}${path}`, {
        method,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
    } catch {
      throw new GithubError('network');
    }
    if (response.ok) return response;
    if (response.status === 401) throw new GithubError('auth');
    if (response.status === 403) {
      if (response.headers.get('x-ratelimit-remaining') === '0') throw new GithubError('rateLimit');
      // A token that may read but not write is refused with 403 when it tries to change something.
      throw new GithubError(method === 'GET' ? 'auth' : 'forbidden');
    }
    if (response.status === 404) throw new GithubError('notFound');
    throw new GithubError('other', `HTTP ${response.status}`);
  }
  const get = (path: string, token: string): Promise<Response> => call('GET', path, token);

  /** The labels the repository has. A label that is not among them is not set: this sync never creates labels. */
  async function knownLabels(repo: RepoRef, token: string): Promise<string[]> {
    const names: string[] = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const raw = (await (await get(`/repos/${repoText(repo)}/labels?per_page=${PAGE_SIZE}&page=${page}`, token)).json()) as Array<{ name?: string | null }>;
      names.push(...raw.flatMap((label) => (label.name ? [label.name] : [])));
      if (raw.length < PAGE_SIZE) break;
    }
    return names;
  }

  async function onlyKnown(repo: RepoRef, token: string, wanted: readonly string[]): Promise<{ labels: string[]; skipped: string[] }> {
    if (wanted.length === 0) return { labels: [], skipped: [] };
    const known = await knownLabels(repo, token);
    const labels = wanted.flatMap((name) => known.find((label) => label.toLowerCase() === name.toLowerCase()) ?? []);
    return { labels, skipped: wanted.filter((name) => !known.some((label) => label.toLowerCase() === name.toLowerCase())) };
  }

  return {
    kind: 'github',
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
    },
    async updateIssue(repo: RepoRef, token: string, number: number, patch: ItemPatch): Promise<WriteResult> {
      const body: Record<string, unknown> = {};
      if (patch.title !== undefined) body.title = patch.title;
      if (patch.body !== undefined) body.body = patch.body;
      if (patch.state !== undefined) body.state = patch.state;
      if (patch.milestone !== undefined) body.milestone = patch.milestone;
      let skipped: string[] = [];
      if (patch.labels !== undefined) {
        const only = await onlyKnown(repo, token, patch.labels);
        body.labels = only.labels;
        skipped = only.skipped;
      }
      const raw = (await (await call('PATCH', `/repos/${repoText(repo)}/issues/${number}`, token, body)).json()) as RawIssue;
      return { item: toIssue(raw), skippedLabels: skipped };
    },
    async listMilestones(repo: RepoRef, token: string): Promise<ExternalMilestone[]> {
      const milestones: ExternalMilestone[] = [];
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const raw = (await (await get(`/repos/${repoText(repo)}/milestones?state=all&per_page=${PAGE_SIZE}&page=${page}`, token)).json()) as RawMilestone[];
        milestones.push(...raw.map(toMilestone));
        if (raw.length < PAGE_SIZE) break;
      }
      return milestones;
    },
    async createMilestone(repo: RepoRef, token: string, milestone): Promise<ExternalMilestone> {
      const body: Record<string, unknown> = { title: milestone.title, description: milestone.description };
      // GitHub wants a time; the end of the day in UTC keeps the date the same in every time zone east of it.
      if (milestone.dueOn) body.due_on = `${milestone.dueOn}T23:59:59Z`;
      return toMilestone((await (await call('POST', `/repos/${repoText(repo)}/milestones`, token, body)).json()) as RawMilestone);
    },
    async listLabels(repo: RepoRef, token: string): Promise<string[]> {
      return knownLabels(repo, token);
    },
    async createLabel(repo: RepoRef, token: string, label): Promise<void> {
      await call('POST', `/repos/${repoText(repo)}/labels`, token, { name: label.name, color: label.color });
    },
    async createIssue(repo: RepoRef, token: string, item): Promise<WriteResult> {
      const only = await onlyKnown(repo, token, item.labels);
      const raw = (await (await call('POST', `/repos/${repoText(repo)}/issues`, token, { title: item.title, body: item.body, labels: only.labels })).json()) as RawIssue;
      return { item: toIssue(raw), skippedLabels: only.skipped };
    }
  };
}
