// Arbitraries for PSI property tests. Each element costs a few scalar multiplications
// (~1 ms each), so cases stay in the tens of records.

import fc from 'fast-check';
import { MATCH_FIELDS } from '../../data/normalize';
import { smallScenario } from '../../test/fixtures';

export const fieldArb = fc.constantFrom(...MATCH_FIELDS);

/**
 * 1–`maxHolders` holders, up to `maxCustomers` customers. Every banlist is large enough to hold
 * every flagged customer, plus some outsiders.
 */
export function screeningCaseArb(maxHolders: number, maxCustomers: number) {
  return fc
    .record({
      seed: fc.integer({ min: 1, max: 1_000_000 }),
      customers: fc.integer({ min: 1, max: maxCustomers }),
      holders: fc.integer({ min: 1, max: maxHolders }),
      fractions: fc.array(fc.double({ min: 0, max: 0.6 / maxHolders, noNaN: true }), {
        minLength: maxHolders,
        maxLength: maxHolders,
      }),
      outsiders: fc.integer({ min: 0, max: 10 }),
      field: fieldArb,
    })
    .map(({ seed, customers, holders, fractions, outsiders, field }) => {
      const flaggedByCount = fractions.slice(0, holders);
      const flagged = flaggedByCount.reduce((sum, f) => sum + Math.round(f * customers), 0);
      return {
        field,
        scenario: smallScenario({
          seed,
          customers,
          holders,
          banlistSize: flagged + outsiders,
          flaggedByCount,
        }),
      };
    });
}
