import { SyncError } from '../connector';
import type { JiraTransport } from './client';

/** Sends the request through the Rust side of the desktop app (`http_request`): Jira Cloud does not answer a browser with an API token (#66, ADR 0008). */
export const createTauriTransport = (): JiraTransport => async (request) => {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('http_request', { request: { method: request.method, url: request.url, headers: request.headers, body: request.body ?? null } });
  } catch {
    throw new SyncError('network');
  }
};
