import { isTauri } from '../data/createRepository';
import type { Connectors, TokenVault } from './connector';
import { createGithubConnector } from './github/connector';
import { createDemoApi } from './github/demoApi';
import { createJiraConnector } from './jira/connector';
import { createJiraSimulation } from './jira/simulation';
import { createTauriTransport } from './jira/tauriTransport';
import { createRestApi } from './github/restApi';
import { createKeychainTokenVault, createMemoryTokenVault } from './token';

export { SyncError } from './connector';
export type { Connectors, SyncErrorKind, TokenStore, TokenVault, TrackerConnector } from './connector';

/** The connectors of the services that are available. The desktop app talks to GitHub and Jira; the browser build only has demo data for now, so it gets the simulations (#30, #66, ADR 0005). */
export function createConnectors(): Connectors {
  return { github: createGithubConnector(isTauri() ? createRestApi() : createDemoApi()), jira: createJiraConnector(isTauri() ? createTauriTransport() : createJiraSimulation()) };
}

/** The keychain on the desktop, the memory of the page in the browser: one entry per service. */
export function createTokenVault(): TokenVault {
  return isTauri() ? createKeychainTokenVault() : createMemoryTokenVault();
}

/** Whether the data comes from the simulation: the settings and the dialogs then say "Demo". */
export const isSyncDemo = (): boolean => !isTauri();
