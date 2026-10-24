import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { formatRoute, parseHash, type Route } from './routing';
import { DEFAULT_STAGE, STAGES } from './stages';

describe('routing', () => {
  it('round_trips_every_route', () => {
    const routes: Route[] = [
      ...STAGES.map((s) => ({ kind: 'stage', stage: s.id }) as const),
      { kind: 'debug-data' },
    ];
    for (const route of routes) expect(parseHash(formatRoute(route))).toEqual(route);
  });

  it('accepts_trailing_slash', () => {
    expect(parseHash('#/stage/psi/')).toEqual({ kind: 'stage', stage: 'psi' });
    expect(parseHash('#/debug/data/')).toEqual({ kind: 'debug-data' });
  });

  it('unknown_hash_falls_back_to_default', () => {
    const known = new Set([...STAGES.map((s) => `#/stage/${s.id}`), '#/debug/data']);
    fc.assert(
      fc.property(fc.string(), (hash) => {
        if (known.has(hash.replace(/\/$/, ''))) return;
        expect(parseHash(hash)).toEqual({ kind: 'stage', stage: DEFAULT_STAGE });
      }),
    );
  });
});
