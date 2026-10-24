import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { MATCH_FIELDS, normalizeField } from './normalize';
import { buildScenario, flaggedCounts, truthMatches, type Scenario, type ScenarioConfig } from './scenario';

const base: ScenarioConfig = {
  seed: 1,
  querier: { id: 'q', name: 'Querier', kind: 'exchange', customers: 1000 },
  holders: [
    { id: 'h1', name: 'Holder 1', kind: 'broker', banlistSize: 300 },
    { id: 'h2', name: 'Holder 2', kind: 'bank', banlistSize: 250 },
    { id: 'h3', name: 'Holder 3', kind: 'exchange', banlistSize: 200 },
  ],
  flaggedByCount: [0.05, 0.02, 0.01],
};

/** Intersection computed from raw records alone, the way a protocol would see them. */
function rawIntersection(scenario: Scenario, holderIndex: number, field: (typeof MATCH_FIELDS)[number]) {
  const holder = scenario.holders[holderIndex]!;
  const listed = new Set(holder.records.map((r) => normalizeField(field, r[field])));
  return new Set(
    scenario.querier.records.filter((r) => listed.has(normalizeField(field, r[field]))).map((r) => r.rowId),
  );
}

const configArb = fc
  .record({
    seed: fc.integer(),
    customers: fc.integer({ min: 1, max: 400 }),
    holders: fc.integer({ min: 1, max: 4 }),
    fractions: fc.array(fc.double({ min: 0, max: 0.2, noNaN: true }), { minLength: 1, maxLength: 4 }),
    extra: fc.integer({ min: 0, max: 100 }),
  })
  .map(({ seed, customers, holders, fractions, extra }): ScenarioConfig => {
    const flaggedByCount = fractions.slice(0, holders);
    // Every holder can list every flagged customer, plus some outsiders.
    const banlistSize = customers + extra;
    return {
      seed,
      querier: { id: 'q', name: 'Q', kind: 'exchange', customers },
      holders: Array.from({ length: holders }, (_, i) => ({
        id: `h${i}`,
        name: `H${i}`,
        kind: 'broker' as const,
        banlistSize,
      })),
      flaggedByCount,
    };
  });

describe('generator', () => {
  it('same_seed_same_output', () => {
    expect(buildScenario(base)).toEqual(buildScenario(base));
    expect(buildScenario({ ...base, seed: 2 })).not.toEqual(buildScenario(base));
  });

  it('overlap_matches_config', () => {
    fc.assert(
      fc.property(configArb, (config) => {
        const scenario = buildScenario(config);
        const n = config.querier.customers;
        const byK = new Map<number, number>();
        for (const by of Object.values(scenario.truth.flaggedBy))
          byK.set(by.length, (byK.get(by.length) ?? 0) + 1);
        config.flaggedByCount.forEach((f, i) => {
          const realized = (byK.get(i + 1) ?? 0) / n;
          // Rounding to whole customers is the only error: at most half a customer.
          expect(Math.abs(realized - f)).toBeLessThanOrEqual(0.5 / n + 1e-12);
        });
      }),
      { numRuns: 60 },
    );
  });

  it('banlist_sizes_match_config', () => {
    const scenario = buildScenario(base);
    base.holders.forEach((h, i) => expect(scenario.holders[i]!.records).toHaveLength(h.banlistSize));
    expect(scenario.querier.records).toHaveLength(base.querier.customers);
  });

  it('ground_truth_is_consistent', () => {
    const scenario = buildScenario(base);
    for (const field of MATCH_FIELDS) {
      scenario.holders.forEach((holder, i) => {
        expect(rawIntersection(scenario, i, field)).toEqual(truthMatches(scenario, holder.institution.id));
      });
    }
  });

  it('ground_truth_is_consistent_for_random_configs', () => {
    fc.assert(
      fc.property(configArb, fc.constantFrom(...MATCH_FIELDS), (config, field) => {
        const scenario = buildScenario(config);
        scenario.holders.forEach((holder, i) => {
          expect(rawIntersection(scenario, i, field)).toEqual(truthMatches(scenario, holder.institution.id));
        });
      }),
      { numRuns: 30 },
    );
  });

  it('multi_list_counts', () => {
    const scenario = buildScenario(base);
    const expected = flaggedCounts(base);
    const byK = [0, 0, 0];
    for (const by of Object.values(scenario.truth.flaggedBy)) byK[by.length - 1]!++;
    expect(byK).toEqual(expected);
    // No customer is listed twice by the same holder.
    for (const by of Object.values(scenario.truth.flaggedBy)) expect(new Set(by).size).toBe(by.length);
  });

  it('records_carry_formatting_noise', () => {
    const scenario = buildScenario(base);
    const raw = scenario.querier.records.filter((r) => normalizeField('email', r.email) !== r.email);
    expect(raw.length).toBeGreaterThan(base.querier.customers * 0.2);
  });

  it('person_ids_stay_out_of_records', () => {
    const scenario = buildScenario(base);
    const json = JSON.stringify([scenario.querier.records, scenario.holders.map((h) => h.records)]);
    expect(json).not.toMatch(/"p\d+"/);
  });

  it.each([
    ['too many fractions', { flaggedByCount: [0.1, 0.1, 0.1, 0.1] }],
    ['fractions over 1', { flaggedByCount: [0.7, 0.4] }],
    ['negative fraction', { flaggedByCount: [-0.1] }],
    ['banlist too small', { holders: [{ id: 'h1', name: 'H', kind: 'bank' as const, banlistSize: 5 }] }],
    ['duplicate ids', { holders: [{ id: 'q', name: 'H', kind: 'bank' as const, banlistSize: 500 }] }],
  ])('rejects_invalid_config: %s', (_label, patch) => {
    const config = { ...base, flaggedByCount: [0.05], ...patch };
    expect(() => buildScenario(config)).toThrow();
  });
});
