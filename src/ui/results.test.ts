import { describe, expect, it } from 'vitest';
import { expectedQuerierResult } from '../protocol/screening';
import { smallScenario } from '../test/fixtures';
import { compareResults, involvedHolders, perHolder, truthCustomers } from './results';

describe('ui/results', () => {
  const scenario = smallScenario({ holders: 2, flaggedByCount: [0.1, 0.05] });

  it('exact_result_has_no_errors', () => {
    const cmp = compareResults(scenario, expectedQuerierResult(scenario));
    expect(cmp.missed).toBe(0);
    expect(cmp.extra).toBe(0);
    expect(cmp.correct).toBe(20 * 1 + 10 * 2);
    expect(cmp.rows).toHaveLength(30);
  });

  it('counts_missed_and_extra_per_holder', () => {
    const expected = expectedQuerierResult(scenario);
    const [first] = Object.keys(expected);
    const unflagged = scenario.querier.records.find((r) => !(r.rowId in expected))!.rowId;
    const got = { ...expected, [unflagged]: ['h1'] };
    delete got[first!];
    const cmp = compareResults(scenario, got);
    expect(cmp.missed).toBe(expected[first!]!.length);
    expect(cmp.extra).toBe(1);
    expect(cmp.rows.find((r) => r.rowId === unflagged)!.cells).toEqual({ h1: 'extra' });
  });
});

describe('compareResults for two-party PSI', () => {
  it('checks_only_the_queried_holder', () => {
    const scenario = smallScenario({ holders: 3, banlistSize: 120, flaggedByCount: [0.1, 0.05, 0.02] });
    const holders = involvedHolders('psi', scenario);
    // What a correct two-party run returns: only the first holder's flags.
    const got = Object.fromEntries(
      Object.entries(scenario.truth.flaggedBy)
        .filter(([, by]) => by.includes(holders[0]!))
        .map(([rowId]) => [rowId, [holders[0]!]]),
    );
    const cmp = compareResults(scenario, got, holders);
    expect(cmp.missed).toBe(0);
    expect(cmp.extra).toBe(0);
    expect(cmp.correct).toBe(Object.keys(got).length);
  });
});

describe('per-institution breakdown', () => {
  it('splits_pairs_by_holder_and_counts_customers_once', () => {
    const scenario = smallScenario({ holders: 3, banlistSize: 120, flaggedByCount: [0.1, 0.05, 0.02] });
    const cmp = compareResults(scenario, expectedQuerierResult(scenario));
    const tallies = perHolder(cmp);
    expect(tallies.map((t) => t.holder)).toEqual(['h1', 'h2', 'h3']);
    // Pairs add up across institutions; customers are counted once however many flag them.
    expect(tallies.reduce((n, t) => n + t.correct, 0)).toBe(cmp.correct);
    expect(truthCustomers(cmp)).toBe(Object.keys(scenario.truth.flaggedBy).length);
    expect(cmp.correct).toBeGreaterThan(truthCustomers(cmp));
    for (const t of tallies) {
      expect(t.missed + t.extra).toBe(0);
      expect(t.flagged).toBe(
        Object.values(scenario.truth.flaggedBy).filter((by) => by.includes(t.holder)).length,
      );
    }
  });
});
