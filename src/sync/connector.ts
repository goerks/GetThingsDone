import type { Catalog, ExternalItem, FieldName, ItemPatch, NewItem } from '../domain/sync';
import type { Epic, ExternalLink, Release, ServiceKind, StatusValue } from '../domain/types';

/** Why a call to a service failed. The texts for the user are `sync.errors.<kind>`. */
export type SyncErrorKind = 'config' | 'network' | 'auth' | 'forbidden' | 'notFound' | 'rateLimit' | 'transition' | 'other';

export class SyncError extends Error {
  constructor(
    readonly kind: SyncErrorKind,
    message: string = kind
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

/** What a connector can do. The engine only compares the fields a service can hold. */
export interface ConnectorCapabilities {
  /** The compared fields the service can hold. */
  fields: readonly FieldName[];
  /** Whether a story can be published as a new issue. */
  create: boolean;
  /** Whether the sync deletes again what it made in the service (labels, milestones). */
  tidy: boolean;
}

/** The result of a change in the service: the item as it is now, and the labels the service does not know. */
export interface WriteResult {
  item: ExternalItem;
  skippedLabels: string[];
}

/** What the sync made in the service (names), so it can delete exactly that later. The connector adds to it. */
export interface Made {
  labels: string[];
  milestones: string[];
}

/** What a connector needs to know to change the service: the epics, releases and columns of the app, what the service has, and where to note what was made. */
export interface WriteContext {
  epics: readonly Epic[];
  releases: readonly Release[];
  statuses: readonly StatusValue[];
  catalog: Catalog;
  made: Made;
}

/** What is still needed after a sync; what the sync made and nothing needs any more is deleted. */
export interface Needs {
  epic(name: string): boolean;
  status(name: string): boolean;
  release(title: string): boolean;
}

export interface TidyResult {
  /** The registry of what the sync made, after the deletions. */
  managed: Made;
  /** What was deleted. */
  gone: Made;
}

/**
 * One connector per service (ADR 0005, ADR 0006). The sync engine knows nothing of a service: it asks a connector for the
 * open items, for one item, and tells it what to change in the terms of the app. The connector translates (GitHub: text,
 * task list and labels with the conventions "epic: …" and "status: …"). The desktop app and the browser talk to the
 * service directly, or, for the public preview, to a simulation, so it never needs a real token.
 */
export interface TrackerConnector<Target = unknown> {
  readonly kind: ServiceKind;
  readonly capabilities: ConnectorCapabilities;
  /** The target the settings of the connection name (GitHub: the repository), or null when they are not complete or not valid. */
  target(connection: Record<string, string>): Target | null;
  /** The settings of the connection in their usual form (GitHub: `owner/name`), `{}` for none, or null when they are not valid. */
  normalize(connection: Record<string, string>): Record<string, string> | null;
  /** The open items of the target. Checks the target and the token as well. Throws a `SyncError`. */
  open(target: Target, token: string): Promise<ExternalItem[]>;
  /** One item by its id, or null when it does not exist (or is not an issue). Throws a `SyncError`. */
  item(target: Target, token: string, id: string): Promise<ExternalItem | null>;
  /** The id of the item a link points to, or null when the link belongs to another target. */
  idOf(target: Target, link: ExternalLink): string | null;
  /** What the service holds besides its items (releases), read once per sync. Throws a `SyncError`. */
  catalog(target: Target, token: string): Promise<Catalog>;
  /** What the service lacks for an epic or a column, as text for the notice, or null when it is there. */
  lacks(catalog: Catalog, kind: 'epic' | 'status', name: string): string | null;
  /** Changes an item; makes before what the change needs. Throws a `SyncError`, with kind `forbidden` when the token may not write. */
  update(target: Target, token: string, item: ExternalItem, patch: ItemPatch, context: WriteContext): Promise<WriteResult>;
  /** Creates an item. Throws a `SyncError`. */
  create(target: Target, token: string, item: NewItem, context: WriteContext): Promise<WriteResult>;
  /** Deletes what the sync made and nothing needs any more. Only called when `capabilities.tidy` is set. Throws a `SyncError`. */
  tidy(target: Target, token: string, needs: Needs, managed: Made, catalog: Catalog): Promise<TidyResult>;
  /** How many items the last `open` left out because they are not stories (Jira: epics and sub-tasks). */
  skipped?(): number;
  /** The statuses of the target's workflow, so the settings can map them to the columns of the board. */
  statuses?(target: Target, token: string): Promise<WorkflowStatus[]>;
}

/** A status of the workflow of a service: its name and what it counts as (not started, in progress, done). */
export interface WorkflowStatus {
  name: string;
  category: 'new' | 'indeterminate' | 'done';
}

/** The connectors by service; a service without one is planned. */
export type Connectors = Partial<Record<ServiceKind, TrackerConnector>>;

/** Where the access token is kept. The desktop app uses the keychain of the operating system, the browser the session. */
export interface TokenStore {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}

/** The token stores by service: one entry per service, so the token of one never reaches another. */
export type TokenVault = (service: ServiceKind) => TokenStore;
