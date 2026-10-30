import type { MouseEvent } from 'react';
import { isTauri } from '../data/createRepository';

/** Opens a web address in the default browser through the desktop app; the web view does not open `target="_blank"` links. */
export async function openExternal(url: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('open_external', { url });
}

interface Deps {
  desktop: boolean;
  open: (url: string) => Promise<void>;
}

/**
 * The click on a link to a web page. In the browser the link works by itself; in the desktop app the click is taken over
 * and the page is opened in the default browser. If that fails, the link is opened in a new window as a last resort.
 */
export function openLink(event: Pick<MouseEvent, 'preventDefault'>, url: string, deps: Deps = { desktop: isTauri(), open: openExternal }): void {
  if (!deps.desktop) return;
  event.preventDefault();
  deps.open(url).catch(() => {
    window.open(url, '_blank', 'noopener,noreferrer');
  });
}
