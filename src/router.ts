import { useEffect, useState } from 'react';

export type Route = { name: 'board' } | { name: 'backlog' } | { name: 'story'; id: string };

export const hrefs = {
  board: '#/board',
  backlog: '#/backlog',
  story: (id: string): string => `#/story/${encodeURIComponent(id)}`
};

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  if (path === 'backlog') return { name: 'backlog' };
  if (path.startsWith('story/')) {
    const id = decodeURIComponent(path.slice('story/'.length));
    if (id) return { name: 'story', id };
  }
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
