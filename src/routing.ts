import { useEffect, useState } from 'react';
import { isStageId, type StageId } from './stages';

// Hash routing: GitHub Pages has no server-side rewrites, so paths live after '#'.

export type Route =
  | { kind: 'home' }
  | { kind: 'stage'; stage: StageId }
  | { kind: 'theory'; stage: StageId }
  | { kind: 'summary' }
  | { kind: 'debug-data' };

const STAGE_ROUTE = /^#\/(stage|theory)\/([a-z-]+)\/?$/;

/** Unknown or empty hashes land on the home page. */
export function parseHash(hash: string): Route {
  if (/^#\/debug\/data\/?$/.test(hash)) return { kind: 'debug-data' };
  if (/^#\/summary\/?$/.test(hash)) return { kind: 'summary' };
  const match = STAGE_ROUTE.exec(hash);
  const id = match?.[2];
  if (match && id && isStageId(id)) return { kind: match[1] as 'stage' | 'theory', stage: id };
  return { kind: 'home' };
}

export function formatRoute(route: Route): string {
  switch (route.kind) {
    case 'home':
      return '#/';
    case 'summary':
      return '#/summary';
    case 'debug-data':
      return '#/debug/data';
    case 'stage':
    case 'theory':
      return `#/${route.kind}/${route.stage}`;
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo?.(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
