import { useEffect, useState } from 'react';

/** Sections of the settings page. Status values (#5) follow. */
export type SettingsSection = 'fields';

export type Route =
  | { name: 'board' }
  | { name: 'backlog' }
  | { name: 'map' }
  | { name: 'epics' }
  | { name: 'releases' }
  | { name: 'settings'; section: SettingsSection };

export const hrefs = {
  board: '#/board',
  backlog: '#/backlog',
  map: '#/map',
  epics: '#/epics',
  releases: '#/releases',
  settings: '#/settings/fields'
};

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  if (path === 'backlog') return { name: 'backlog' };
  if (path === 'map') return { name: 'map' };
  if (path === 'epics') return { name: 'epics' };
  if (path === 'releases') return { name: 'releases' };
  // "#/fields" was the address of the fields page before it moved into the settings.
  if (path === 'settings' || path === 'settings/fields' || path === 'fields') return { name: 'settings', section: 'fields' };
  return { name: 'board' };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = (): void => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}
