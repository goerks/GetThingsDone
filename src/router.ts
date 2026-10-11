import { useEffect, useState } from 'react';

export type Route = { name: 'board' } | { name: 'backlog' } | { name: 'map' } | { name: 'epics' } | { name: 'fields' };

export const hrefs = {
  board: '#/board',
  backlog: '#/backlog',
  map: '#/map',
  epics: '#/epics',
  fields: '#/fields'
};

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  if (path === 'backlog') return { name: 'backlog' };
  if (path === 'map') return { name: 'map' };
  if (path === 'epics') return { name: 'epics' };
  if (path === 'fields') return { name: 'fields' };
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
