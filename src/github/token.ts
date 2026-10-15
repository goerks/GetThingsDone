import type { TokenStore } from './source';

/** The token for this page only: it is kept in memory, so it is gone when the page is reloaded or closed (#30, ADR 0004). */
export function createMemoryTokenStore(): TokenStore {
  let token: string | null = null;
  return {
    async get() {
      return token;
    },
    async set(value) {
      token = value;
    },
    async clear() {
      token = null;
    }
  };
}

/** The token in the credential store of the operating system (Windows Credential Manager), through the Rust side of the app. */
export function createKeychainTokenStore(): TokenStore {
  const call = async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(command, args);
  };
  return {
    get: () => call<string | null>('github_token_get'),
    set: (token) => call<void>('github_token_set', { token }),
    clear: () => call<void>('github_token_delete')
  };
}
