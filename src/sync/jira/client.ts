import { SyncError } from '../connector';

/*
 * The HTTP calls to Jira Cloud (#66, ADR 0008). Jira Cloud does not allow requests from a browser with an API token (no
 * CORS), so the desktop app sends them through the Rust side (`http_request`); the browser build and the public preview
 * talk to a simulated Jira instead. Both are a `JiraTransport`.
 */

export interface JiraRequest {
  method: 'GET' | 'POST' | 'PUT';
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface JiraResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/** Sends one request. A request that never reached Jira (no network) is thrown as a `SyncError('network')`. */
export type JiraTransport = (request: JiraRequest) => Promise<JiraResponse>;

/** What the settings of the connection say about Jira. */
export interface JiraTarget {
  /** `https://<name>.atlassian.net`, without a slash at the end. */
  site: string;
  email: string;
  /** The key of the project, in capitals. */
  project: string;
  /** More JQL for the issues to import, or empty. */
  filter: string;
  /** The id of the board whose sprints are synchronised; empty or missing for the first scrum board of the project. */
  board?: string;
  /** Jira status name → name of a column of the board, for the statuses that the names do not match. */
  statusMap: Record<string, string>;
}

const SITE = /^https:\/\/([a-z0-9-]+)\.atlassian\.net$/i;
const PROJECT = /^[A-Z][A-Z0-9_]+$/;

/** The address of the site in its usual form (`https://name.atlassian.net`), or null when it is none. `name.atlassian.net` and addresses with a path are accepted. */
export function parseSite(text: string): string | null {
  const trimmed = text.trim().replace(/\/+$/, '');
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed.replace(/^http:\/\//i, 'https://') : `https://${trimmed}`;
  const origin = /^(https:\/\/[^/]+)/i.exec(withScheme)?.[1] ?? '';
  const match = SITE.exec(origin);
  return match ? `https://${match[1].toLowerCase()}.atlassian.net` : null;
}

export const parseProject = (text: string): string | null => (PROJECT.test(text.trim().toUpperCase()) ? text.trim().toUpperCase() : null);

export const isEmail = (text: string): boolean => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text.trim());

/** `Authorization: Basic …` of an e-mail address and an API token. */
export function basicAuth(email: string, token: string): string {
  const bytes = new TextEncoder().encode(`${email}:${token}`);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `Basic ${btoa(binary)}`;
}

/** The kind of error an answer of Jira stands for. A refused write is `forbidden`, a refused read is `auth`. */
export function errorOf(status: number, method: string): SyncError {
  if (status === 401) return new SyncError('auth');
  if (status === 403) return new SyncError(method === 'GET' ? 'auth' : 'forbidden');
  if (status === 404) return new SyncError('notFound');
  if (status === 429) return new SyncError('rateLimit');
  return new SyncError('other', `HTTP ${status}`);
}

export interface JiraClient {
  /** Calls the API (`path` starts with `/rest/…`) and returns the parsed JSON, or null for an answer without a body. */
  call<T = unknown>(method: JiraRequest['method'], path: string, body?: unknown): Promise<T | null>;
}

/** A client for one site and one login. */
export function createClient(transport: JiraTransport, target: JiraTarget, token: string): JiraClient {
  return {
    async call<T>(method: JiraRequest['method'], path: string, body?: unknown): Promise<T | null> {
      let response: JiraResponse;
      try {
        response = await transport({
          method,
          url: `${target.site}${path}`,
          headers: { Accept: 'application/json', Authorization: basicAuth(target.email, token), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) })
        });
      } catch (cause) {
        throw cause instanceof SyncError ? cause : new SyncError('network');
      }
      if (response.status < 200 || response.status >= 300) throw errorOf(response.status, method);
      if (response.body.trim() === '') return null;
      try {
        return JSON.parse(response.body) as T;
      } catch {
        throw new SyncError('other', 'the answer is not JSON');
      }
    }
  };
}
