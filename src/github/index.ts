import { isTauri } from '../data/createRepository';
import { createDemoSource } from './demoSource';
import { createRestSource } from './restSource';
import type { GithubSource, TokenStore } from './source';
import { createKeychainTokenStore, createMemoryTokenStore } from './token';

export { GithubError } from './source';
export type { GithubErrorKind, GithubSource, TokenStore } from './source';

/** The desktop app reads from GitHub. The browser build only has the demo data for now, so it gets the simulation (#30, ADR 0004). */
export function createGithubSource(): GithubSource {
  return isTauri() ? createRestSource() : createDemoSource();
}

/** The keychain on the desktop, the memory of the page in the browser. */
export function createTokenStore(): TokenStore {
  return isTauri() ? createKeychainTokenStore() : createMemoryTokenStore();
}

/** Whether the data comes from the simulation: the settings and the dialogs then say "Demo". */
export const isGithubDemo = (): boolean => !isTauri();
