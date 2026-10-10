import type { Repository } from './repository';
import { LocalStorageRepository } from './localStorageRepository';

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Picks SQLite inside the desktop app and the local fallback in a plain browser. */
export async function createRepository(): Promise<Repository> {
  if (isTauri()) {
    const { SqliteRepository } = await import('./sqliteRepository');
    return SqliteRepository.open();
  }
  return new LocalStorageRepository();
}
