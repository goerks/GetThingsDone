import { useEffect, useState } from 'react';

/** Sections of the settings page. */
export type SettingsSection = 'fields' | 'statuses' | 'map' | 'definitions' | 'features' | 'github' | 'data';

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
  settings: '#/settings/fields',
  settingsStatuses: '#/settings/statuses',
  settingsMap: '#/settings/map',
  settingsDefinitions: '#/settings/definitions',
  settingsFeatures: '#/settings/features',
  settingsData: '#/settings/data',
  settingsGithub: '#/settings/github'
};

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  if (path === 'backlog') return { name: 'backlog' };
  if (path === 'map') return { name: 'map' };
  if (path === 'epics') return { name: 'epics' };
  if (path === 'releases') return { name: 'releases' };
  if (path === 'settings/features') return { name: 'settings', section: 'features' };
  if (path === 'settings/data') return { name: 'settings', section: 'data' };
  if (path === 'settings/github') return { name: 'settings', section: 'github' };
  if (path === 'settings/statuses') return { name: 'settings', section: 'statuses' };
  if (path === 'settings/definitions') return { name: 'settings', section: 'definitions' };
  if (path === 'settings/map') return { name: 'settings', section: 'map' };
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
