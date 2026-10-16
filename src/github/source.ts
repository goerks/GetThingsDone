import type { GithubIssue, ItemPatch, RepoRef } from '../domain/github';

/** Why a call to a service failed. The texts for the user are `github.errors.<kind>`. */
export type GithubErrorKind = 'config' | 'network' | 'auth' | 'forbidden' | 'notFound' | 'rateLimit' | 'other';

export class GithubError extends Error {
  constructor(
    readonly kind: GithubErrorKind,
    message: string = kind
  ) {
    super(message);
    this.name = 'GithubError';
  }
}

/** An item of an external service as the sync sees it. `number` is its number in the service; the address identifies it across syncs. */
export type ExternalItem = GithubIssue;

/** The result of a change on the service: the item as it is now, and the labels the service does not know. */
export interface WriteResult {
  item: ExternalItem;
  skippedLabels: string[];
}

/** The services a connector can exist for. Only the available ones have a connector; the others are listed as planned in the settings. */
export const CONNECTOR_KINDS = [
  { kind: 'github', status: 'available' },
  { kind: 'gitlab', status: 'planned' },
  { kind: 'jira', status: 'planned' },
  { kind: 'trello', status: 'planned' }
] as const;

export type ConnectorKind = (typeof CONNECTOR_KINDS)[number]['kind'];

/**
 * One connector per service (#30, ADR 0004). The sync engine knows nothing of a service: it asks a connector for the open
 * items, for one item, and tells it what to change. The desktop app and the browser talk to api.github.com; the public
 * preview uses a simulated repository, so it never needs a real token.
 */
export interface TrackerConnector {
  readonly kind: ConnectorKind;
  /** Checks the target and the token and returns the open items. Throws a `GithubError`. */
  openIssues(repo: RepoRef, token: string): Promise<ExternalItem[]>;
  /** One item, or null when it is a pull request or does not exist. Throws a `GithubError`. */
  issue(repo: RepoRef, token: string, number: number): Promise<ExternalItem | null>;
  /** Changes an item. Throws a `GithubError`, with kind `forbidden` when the token may not write. */
  updateIssue(repo: RepoRef, token: string, number: number, patch: ItemPatch): Promise<WriteResult>;
  /** Creates an item. Throws a `GithubError`. */
  createIssue(repo: RepoRef, token: string, item: { title: string; body: string; labels: string[] }): Promise<WriteResult>;
}

/** The connector of GitHub; the name the rest of the app knows. */
export type GithubSource = TrackerConnector;

/** Where the access token is kept. The desktop app uses the keychain of the operating system, the browser the session. */
export interface TokenStore {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}
