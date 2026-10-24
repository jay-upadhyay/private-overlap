import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { formatRoute, parseHash } from './routing';
import { DEFAULT_STAGE, STAGES } from './stages';

describe('routing', () => {
  it('round_trips_every_stage', () => {
    for (const stage of STAGES) {
      const route = { kind: 'stage', stage: stage.id } as const;
      expect(parseHash(formatRoute(route))).toEqual(route);
    }
  });

  it('accepts_trailing_slash', () => {
    expect(parseHash('#/stage/psi/')).toEqual({ kind: 'stage', stage: 'psi' });
  });

  it('unknown_hash_falls_back_to_default', () => {
    fc.assert(
      fc.property(fc.string(), (hash) => {
        const route = parseHash(hash);
        const valid = STAGES.some((s) => `#/stage/${s.id}` === hash.replace(/\/$/, ''));
        if (!valid) expect(route.stage).toBe(DEFAULT_STAGE);
      }),
    );
  });
});
