import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { formatRoute, parseHash, type Route } from './routing';
import { STAGES } from './stages';

const ROUTES: Route[] = [
  { kind: 'home' },
  { kind: 'summary' },
  { kind: 'debug-data' },
  ...STAGES.map((s) => ({ kind: 'stage', stage: s.id }) as const),
  ...STAGES.map((s) => ({ kind: 'theory', stage: s.id }) as const),
];

describe('routing', () => {
  it('round_trips_every_route', () => {
    for (const route of ROUTES) expect(parseHash(formatRoute(route))).toEqual(route);
  });

  it('accepts_trailing_slash', () => {
    expect(parseHash('#/stage/psi/')).toEqual({ kind: 'stage', stage: 'psi' });
    expect(parseHash('#/theory/dp-risk/')).toEqual({ kind: 'theory', stage: 'dp-risk' });
    expect(parseHash('#/debug/data/')).toEqual({ kind: 'debug-data' });
  });

  it('unknown_hash_goes_home', () => {
    const known = new Set(ROUTES.map(formatRoute));
    fc.assert(
      fc.property(fc.string(), (hash) => {
        if (known.has(hash.replace(/\/$/, '')) || hash === '#') return;
        expect(parseHash(hash)).toEqual({ kind: 'home' });
      }),
    );
    expect(parseHash('')).toEqual({ kind: 'home' });
    expect(parseHash('#/stage/nope')).toEqual({ kind: 'home' });
  });
});
