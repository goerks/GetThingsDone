import { issueUrl, parseRepo, repoText, type GithubIssue, type RepoRef } from '../domain/github';
import { GithubError, type GithubSource } from './source';

/*
 * The simulated GitHub of the public preview (#30): one repository with a few issues, kept in this browser. The preview
 * has no real token and sends nothing to GitHub. The settings page offers buttons to change the issues, so that a sync
 * can be tried out; the same data serves the automated tests.
 */

export const DEMO_REPO: RepoRef = { owner: 'goerks', name: 'GetThingsDone' };

/** The token the simulation refuses, to try the message for a wrong token. Any other text is accepted. */
export const DEMO_WRONG_TOKEN = 'falsch';

const KEY = 'getitdone.demoGithub';

export interface DemoIssue extends GithubIssue {
  /** A pull request: it is in the list of GitHub, but never becomes a story. */
  pullRequest?: boolean;
}

const url = (number: number): string => issueUrl(DEMO_REPO, number);

export const DEMO_ISSUES: readonly DemoIssue[] = [
  {
    number: 31,
    title: 'Login',
    body: 'Users log in with e-mail and password.\n\n## Acceptance criteria\n- [ ] Login possible\n- [x] Error message for a wrong password\n',
    state: 'open',
    labels: ['feature'],
    url: url(31)
  },
  { number: 35, title: 'Export as CSV', body: 'Export the backlog as a CSV file.', state: 'open', labels: ['feature', 'good first issue'], url: url(35) },
  { number: 38, title: 'Dark mode', body: '', state: 'open', labels: [], url: url(38) },
  { number: 29, title: 'Imprint page', body: 'Closed long ago.', state: 'closed', labels: ['docs'], url: url(29) },
  { number: 40, title: 'Pull request: fix typo', body: '', state: 'open', labels: [], url: url(40), pullRequest: true }
];

export function demoIssues(): DemoIssue[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DemoIssue[];
  } catch {
    // fall back to the issues every preview starts with
  }
  return DEMO_ISSUES.map((issue) => ({ ...issue, labels: [...issue.labels] }));
}

export function saveDemoIssues(issues: readonly DemoIssue[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(issues));
  } catch {
    // the simulation then keeps its starting issues
  }
}

export function resetDemoIssues(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // nothing to reset
  }
}

function check(repo: RepoRef, token: string): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new GithubError('network');
  if (token.trim() === '' || token === DEMO_WRONG_TOKEN) throw new GithubError('auth');
  if (repoText(repo).toLowerCase() !== repoText(DEMO_REPO).toLowerCase() || parseRepo(repoText(repo)) === null) throw new GithubError('notFound');
}

/** A GitHub that lives in this browser. */
export function createDemoSource(): GithubSource {
  const strip = ({ pullRequest: _pullRequest, ...issue }: DemoIssue): GithubIssue => issue;
  return {
    async openIssues(repo, token) {
      check(repo, token);
      return demoIssues()
        .filter((issue) => issue.state === 'open' && !issue.pullRequest)
        .map(strip);
    },
    async issue(repo, token, number) {
      check(repo, token);
      const found = demoIssues().find((issue) => issue.number === number);
      return found && !found.pullRequest ? strip(found) : null;
    }
  };
}
