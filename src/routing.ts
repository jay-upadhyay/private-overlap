import { useEffect, useState } from 'react';
import { DEFAULT_STAGE, isStageId, type StageId } from './stages';

// Hash routing: GitHub Pages has no server-side rewrites, so paths live after '#'.

export type Route = { kind: 'stage'; stage: StageId } | { kind: 'debug-data' };

export function parseHash(hash: string): Route {
  if (/^#\/debug\/data\/?$/.test(hash)) return { kind: 'debug-data' };
  const match = /^#\/stage\/([a-z-]+)\/?$/.exec(hash);
  const id = match?.[1];
  return { kind: 'stage', stage: id && isStageId(id) ? id : DEFAULT_STAGE };
}

export function formatRoute(route: Route): string {
  return route.kind === 'debug-data' ? '#/debug/data' : `#/stage/${route.stage}`;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
