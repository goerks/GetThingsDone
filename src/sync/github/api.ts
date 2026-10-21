import type { ExternalMilestone, GithubIssue, GithubPatch, RepoRef } from './format';

/** The result of a change on GitHub: the issue as it is now, and the labels GitHub does not know. */
export interface GithubWriteResult {
  issue: GithubIssue;
  skippedLabels: string[];
}

/**
 * The calls to GitHub (#30, ADR 0005): the REST API in the desktop app and in the browser, a simulated repository in the
 * public preview, a fake in the tests. The connector (`connector.ts`) is built on it and translates between the app and
 * these calls. Every call throws a `SyncError`; `forbidden` when the token may not write.
 */
export interface GithubApi {
  /** Checks the repository and the token and returns the open issues (no pull requests). */
  openIssues(repo: RepoRef, token: string): Promise<GithubIssue[]>;
  /** One issue, or null when it is a pull request or does not exist. */
  issue(repo: RepoRef, token: string, number: number): Promise<GithubIssue | null>;
  updateIssue(repo: RepoRef, token: string, number: number, patch: GithubPatch): Promise<GithubWriteResult>;
  createIssue(repo: RepoRef, token: string, issue: { title: string; body: string; labels: string[] }): Promise<GithubWriteResult>;
  /** The milestones of the repository, open and closed. */
  listMilestones(repo: RepoRef, token: string): Promise<ExternalMilestone[]>;
  createMilestone(repo: RepoRef, token: string, milestone: { title: string; description: string; dueOn: string | null }): Promise<ExternalMilestone>;
  /** The names of the labels of the repository. */
  listLabels(repo: RepoRef, token: string): Promise<string[]>;
  /** Creates a label; `color` is a hex colour without the hash. */
  createLabel(repo: RepoRef, token: string, label: { name: string; color: string }): Promise<void>;
  /** Deletes a label of the repository; it disappears from every issue. */
  deleteLabel(repo: RepoRef, token: string, name: string): Promise<void>;
  /** Deletes a milestone; the issues in it have none afterwards. */
  deleteMilestone(repo: RepoRef, token: string, number: number): Promise<void>;
}
