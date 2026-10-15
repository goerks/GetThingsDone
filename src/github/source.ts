import type { GithubIssue, RepoRef } from '../domain/github';

/** Why a call to GitHub failed. The texts for the user are `github.errors.<kind>`. */
export type GithubErrorKind = 'config' | 'network' | 'auth' | 'notFound' | 'rateLimit' | 'other';

export class GithubError extends Error {
  constructor(
    readonly kind: GithubErrorKind,
    message: string = kind
  ) {
    super(message);
    this.name = 'GithubError';
  }
}

/**
 * Where the issues come from. The desktop app and the browser ask api.github.com (read only); the public preview uses
 * a simulated repository, so it never needs a real token (#30).
 */
export interface GithubSource {
  /** Checks repository and token and returns the open issues. Throws a `GithubError`. */
  openIssues(repo: RepoRef, token: string): Promise<GithubIssue[]>;
  /** One issue, or null when it is a pull request or does not exist. Throws a `GithubError`. */
  issue(repo: RepoRef, token: string, number: number): Promise<GithubIssue | null>;
}

/** Where the access token is kept. The desktop app uses the keychain of the operating system, the browser the session. */
export interface TokenStore {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}
