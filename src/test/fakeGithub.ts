import { issueUrl, type GithubIssue } from '../domain/github';
import { GithubError, type GithubSource, type TokenStore } from '../github';

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
  const state = { issues, offline: false, goodToken: 'good', repo: REPO, calls: 0 };
  const check = (repo: { owner: string; name: string }, token: string): void => {
    state.calls += 1;
    if (state.offline) throw new GithubError('network');
    if (token !== state.goodToken) throw new GithubError('auth');
    if (`${repo.owner}/${repo.name}` !== state.repo) throw new GithubError('notFound');
  };
  const source: GithubSource = {
    async openIssues(repo, token) {
      check(repo, token);
      return state.issues.filter((issue) => issue.state === 'open').map((issue) => ({ ...issue }));
    },
    async issue(repo, token, number) {
      check(repo, token);
      return state.issues.find((issue) => issue.number === number) ?? null;
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
