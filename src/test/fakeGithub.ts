import { SyncError } from '../sync/connector';
import type { GithubApi } from '../sync/github/api';
import { createGithubConnector } from '../sync/github/connector';
import { issueUrl, type ExternalMilestone, type GithubIssue, type GithubPatch } from '../sync/github/format';
import { createMemoryTokenVault } from '../sync/token';

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
    writes: [] as Array<{ number: number; patch: GithubPatch } | { created: number } | { milestone: string } | { label: string } | { deletedLabel: string } | { deletedMilestone: string }>
  };
  const check = (repo: { owner: string; name: string }, token: string): void => {
    state.calls += 1;
    if (state.offline) throw new SyncError('network');
    if (token !== state.goodToken) throw new SyncError('auth');
    if (`${repo.owner}/${repo.name}` !== state.repo) throw new SyncError('notFound');
  };
  const only = (wanted: readonly string[]) => ({
    labels: wanted.flatMap((name) => state.knownLabels.find((label) => label.toLowerCase() === name.toLowerCase()) ?? []),
    skipped: wanted.filter((name) => !state.knownLabels.some((label) => label.toLowerCase() === name.toLowerCase()))
  });
  const api: GithubApi = {
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
      if (!state.canWrite) throw new SyncError('forbidden');
      const index = state.issues.findIndex((issue) => issue.number === number);
      if (index < 0) throw new SyncError('notFound');
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
      return { issue: { ...state.issues[index] }, skippedLabels: labels?.skipped ?? [] };
    },
    async listMilestones(repo, token) {
      check(repo, token);
      return state.milestones.map((item) => ({ ...item }));
    },
    async createMilestone(repo, token, milestone) {
      check(repo, token);
      if (!state.canWrite) throw new SyncError('forbidden');
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
      if (!state.canWrite) throw new SyncError('forbidden');
      if (!state.knownLabels.some((item) => item.toLowerCase() === label.name.toLowerCase())) state.knownLabels.push(label.name);
      state.writes.push({ label: label.name });
    },
    async deleteLabel(repo, token, name) {
      check(repo, token);
      if (!state.canWrite) throw new SyncError('forbidden');
      state.knownLabels = state.knownLabels.filter((item) => item.toLowerCase() !== name.toLowerCase());
      state.issues = state.issues.map((issue) => ({ ...issue, labels: issue.labels.filter((item) => item.toLowerCase() !== name.toLowerCase()) }));
      state.writes.push({ deletedLabel: name });
    },
    async deleteMilestone(repo, token, number) {
      check(repo, token);
      if (!state.canWrite) throw new SyncError('forbidden');
      const gone = state.milestones.find((item) => item.number === number);
      state.milestones = state.milestones.filter((item) => item.number !== number);
      if (gone) state.issues = state.issues.map((issue) => (issue.milestone === gone.title ? { ...issue, milestone: null } : issue));
      state.writes.push({ deletedMilestone: gone?.title ?? String(number) });
    },
    async createIssue(repo, token, item) {
      check(repo, token);
      if (!state.canWrite) throw new SyncError('forbidden');
      const number = state.issues.reduce((max, issue) => Math.max(max, issue.number), 0) + 1;
      const labels = only(item.labels);
      const created = fakeIssue(number, { title: item.title, body: item.body, labels: labels.labels });
      state.issues.push(created);
      state.writes.push({ created: number });
      return { issue: { ...created }, skippedLabels: labels.skipped };
    }
  };
  const vault = createMemoryTokenVault();
  const connectors = { github: createGithubConnector(api) };
  return { state, api, sync: { connectors, tokens: vault }, tokens: vault('github') };
}
