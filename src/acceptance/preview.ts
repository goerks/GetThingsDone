import { isTauri } from '../data/createRepository';

/** Hosts of the public pull request previews: `getthingsdone-pr-<n>.onrender.com`. `main` is not one of them. */
export function isPreviewHost(hostname: string): boolean {
  return /-pr-\d+\.onrender\.com$/.test(hostname);
}

/**
 * Whether the acceptance panel shows: in a pull request preview, in the dev server, and with `?acceptance=1`
 * (for the end-to-end tests and for trying it out). Never in the desktop app and never on `main`.
 */
export function acceptanceEnabled(location: Pick<Location, 'hostname' | 'search'> = window.location, tauri: boolean = isTauri()): boolean {
  if (tauri) return false;
  if (new URLSearchParams(location.search).get('acceptance') === '1') return true;
  return isPreviewHost(location.hostname) || import.meta.env.DEV;
}
