import { issueUrl, type GithubIssue } from '../domain/github';
import { GithubError, type GithubSource, type TokenStore } from '../github';
import type { ExternalMilestone, ItemPatch } from '../domain/github';

export const REPO = 'goerks/GetThingsDone';

export const fakeIssue = (number: number, extra: Partial<GithubIssue> = {}): GithubIssue => ({
  number,
  title: `Issue ${number}`,
  body: '',
  state: 'open',
  labels: [],
  url: issueUrl({ owner: 'goerks', name: 'GetThingsDone' }, number),
  ...extra
});

/** A GitHub for the tests: the issues can be changed, and the token or the network can fail. */
export function fakeGithub(issues: GithubIssue[]) {
  const state = {
    issues,
    offline: false,
    goodToken: 'good',
    repo: REPO,
    calls: 0,
    /** Whether the token may change issues. */
    canWrite: true,
    /** The labels the repository has; any other label is not set. */
    knownLabels: ['feature', 'bug', 'docs'],
    /** The milestones of the repository. */
    milestones: [] as ExternalMilestone[],
    /** What was sent to GitHub: one entry for every change or creation. */
    writes: [] as Array<{ number: number; patch: ItemPatch } | { created: number } | { milestone: string } | { label: string }>
  };
  const check = (repo: { owner: string; name: string }, token: string): void => {
    state.calls += 1;
    if (state.offline) throw new GithubError('network');
    if (token !== state.goodToken) throw new GithubError('auth');
    if (`${repo.owner}/${repo.name}` !== state.repo) throw new GithubError('notFound');
  };
  const only = (wanted: readonly string[]) => ({
    labels: wanted.flatMap((name) => state.knownLabels.find((label) => label.toLowerCase() === name.toLowerCase()) ?? []),
    skipped: wanted.filter((name) => !state.knownLabels.some((label) => label.toLowerCase() === name.toLowerCase()))
  });
  const source: GithubSource = {
    kind: 'github',
    async openIssues(repo, token) {
      check(repo, token);
      return state.issues.filter((issue) => issue.state === 'open').map((issue) => ({ ...issue }));
    },
    async issue(repo, token, number) {
      check(repo, token);
      return state.issues.find((issue) => issue.number === number) ?? null;
    },
    async updateIssue(repo, token, number, patch) {
      check(repo, token);
      if (!state.canWrite) throw new GithubError('forbidden');
      const index = state.issues.findIndex((issue) => issue.number === number);
      if (index < 0) throw new GithubError('notFound');
      const labels = patch.labels === undefined ? null : only(patch.labels);
      state.writes.push({ number, patch });
      state.issues[index] = {
        ...state.issues[index],
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.body !== undefined ? { body: patch.body } : {}),
        ...(patch.state !== undefined ? { state: patch.state } : {}),
        ...(patch.milestone !== undefined ? { milestone: patch.milestone === null ? null : (state.milestones.find((item) => item.number === patch.milestone)?.title ?? null) } : {}),
        ...(labels ? { labels: labels.labels } : {})
      };
      return { item: { ...state.issues[index] }, skippedLabels: labels?.skipped ?? [] };
    },
    async listMilestones(repo, token) {
      check(repo, token);
      return state.milestones.map((item) => ({ ...item }));
    },
    async createMilestone(repo, token, milestone) {
      check(repo, token);
      if (!state.canWrite) throw new GithubError('forbidden');
      const created: ExternalMilestone = { number: state.milestones.reduce((max, item) => Math.max(max, item.number), 0) + 1, title: milestone.title, description: milestone.description, dueOn: milestone.dueOn, state: 'open' };
      state.milestones.push(created);
      state.writes.push({ milestone: milestone.title });
      return { ...created };
    },
    async listLabels(repo, token) {
      check(repo, token);
      return [...state.knownLabels];
    },
    async createLabel(repo, token, label) {
      check(repo, token);
      if (!state.canWrite) throw new GithubError('forbidden');
      if (!state.knownLabels.some((item) => item.toLowerCase() === label.name.toLowerCase())) state.knownLabels.push(label.name);
      state.writes.push({ label: label.name });
    },
    async createIssue(repo, token, item) {
      check(repo, token);
      if (!state.canWrite) throw new GithubError('forbidden');
      const number = state.issues.reduce((max, issue) => Math.max(max, issue.number), 0) + 1;
      const labels = only(item.labels);
      const created = fakeIssue(number, { title: item.title, body: item.body, labels: labels.labels });
      state.issues.push(created);
      state.writes.push({ created: number });
      return { item: { ...created }, skippedLabels: labels.skipped };
    }
  };
  let token: string | null = null;
  const tokens: TokenStore = {
    get: async () => token,
    set: async (value) => {
      token = value;
    },
    clear: async () => {
      token = null;
    }
  };
  return { state, github: { source, tokens } };
}
