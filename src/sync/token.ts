import type { ServiceKind } from '../domain/types';
import type { TokenStore, TokenVault } from './connector';

/** The tokens for this page only: they are kept in memory, so they are gone when the page is reloaded or closed (#30, ADR 0005). One per service. */
export function createMemoryTokenVault(): TokenVault {
  const tokens = new Map<ServiceKind, string>();
  return (service) => ({
    async get() {
      return tokens.get(service) ?? null;
    },
    async set(value) {
      tokens.set(service, value);
    },
    async clear() {
      tokens.delete(service);
    }
  });
}

/** The token in the credential store of the operating system (Windows Credential Manager), through the Rust side of the app: one entry per service. */
export function createKeychainTokenVault(): TokenVault {
  const call = async <T>(command: string, args: Record<string, unknown>): Promise<T> => {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(command, args);
  };
  return (service): TokenStore => ({
    get: () => call<string | null>('sync_token_get', { service }),
    set: (token) => call<void>('sync_token_set', { service, token }),
    clear: () => call<void>('sync_token_delete', { service })
  });
}
