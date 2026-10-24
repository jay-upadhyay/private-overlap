// Small scenarios for PSI tests. Each element costs a few scalar multiplications (~1 ms each),
// so property tests stay in the tens of records.

import fc from 'fast-check';
import { MATCH_FIELDS } from '../../data/normalize';
import { buildScenario, type Scenario } from '../../data/scenario';

const HOLDER_IDS = ['halcyon', 'copperline', 'meridian', 'bluewater'] as const;

export function smallScenario(
  seed: number,
  customers: number,
  banlistSizes: readonly number[],
  flaggedByCount: readonly number[],
): Scenario {
  return buildScenario({
    seed,
    querier: { id: 'northwind', name: 'Northwind Exchange', kind: 'exchange', customers },
    holders: banlistSizes.map((banlistSize, i) => ({
      id: HOLDER_IDS[i]!,
      name: HOLDER_IDS[i]!,
      kind: 'broker',
      banlistSize,
    })),
    flaggedByCount: [...flaggedByCount],
  });
}

/** Rows in querier record order, for comparing against protocol output. */
export function orderedRows(scenario: Scenario, rows: Set<string>): string[] {
  return scenario.querier.records.filter((r) => rows.has(r.rowId)).map((r) => r.rowId);
}

export const fieldArb = fc.constantFrom(...MATCH_FIELDS);

/** One holder: up to 30 customers, a banlist large enough for everyone flagged. */
export const twoPartyCaseArb = fc
  .record({
    seed: fc.integer({ min: 1, max: 1_000_000 }),
    customers: fc.integer({ min: 1, max: 30 }),
    flaggedFraction: fc.double({ min: 0, max: 0.6, noNaN: true }),
    extraBanned: fc.integer({ min: 0, max: 20 }),
    field: fieldArb,
  })
  .map(({ seed, customers, flaggedFraction, extraBanned, field }) => {
    const flagged = Math.round(flaggedFraction * customers);
    return {
      field,
      scenario: smallScenario(seed, customers, [flagged + extraBanned], [flaggedFraction]),
    };
  });
