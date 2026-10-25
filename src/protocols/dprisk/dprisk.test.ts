import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { discreteLaplaceMeanAbsError, tierOf } from '../../dp/bounds';
import { runInMemory } from '../../protocol/run';
import type { QuerierResult } from '../../protocol/screening';
import { seededSource, smallScenario } from '../../test/fixtures';
import { COORDINATOR_ID, createDpRiskProtocol, dpRiskParties } from '.';

async function score(scenario: ReturnType<typeof smallScenario>, options = {}, epsilon = 0.5) {
  const run = await runInMemory(createDpRiskProtocol(options), dpRiskParties(scenario, 'email', epsilon));
  return { querier: run.results[scenario.querier.institution.id] as QuerierResult, wire: run.wire };
}

const trueCount = (scenario: ReturnType<typeof smallScenario>, rowId: string) =>
  scenario.truth.flaggedBy[rowId]?.length ?? 0;

describe('dp-risk protocol', () => {
  it('exact_counts_equal_ground_truth', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer(), fc.integer({ min: 1, max: 3 }), async (seed, holders) => {
        const scenario = smallScenario({
          seed,
          customers: 60,
          holders,
          banlistSize: 40,
          flaggedByCount: [0.1, 0.05, 0.05].slice(0, holders),
        });
        const { querier } = await score(scenario, { exactCounts: true });
        for (const r of scenario.querier.records) {
          expect(querier.scores![r.rowId]!.noisy).toBe(trueCount(scenario, r.rowId));
        }
      }),
      { numRuns: 8 },
    );
  }, 30_000);

  it('querier_learns_no_attribution', async () => {
    const scenario = smallScenario({ holders: 3, banlistSize: 120, flaggedByCount: [0.1, 0.05, 0.02] });
    const { querier } = await score(scenario);
    expect(querier.flaggedBy).toEqual({});
    expect(JSON.stringify(querier.scores)).not.toMatch(/h[123]/);
  }, 30_000);

  it('querier_never_holds_both_double_blinded_sets', async () => {
    const scenario = smallScenario({ holders: 2, banlistSize: 100, flaggedByCount: [0.1, 0.05] });
    const { wire } = await score(scenario);
    const toQuerier = new Set(wire.filter((w) => w.to === 'q').map((w) => w.type));
    // Re-blinded customers go only to the coordinator.
    expect([...toQuerier].sort()).toEqual(['dp/holder-set', 'dp/noisy-counts']);
    expect(wire.filter((w) => w.type === 'dp/reblinded').every((w) => w.to === COORDINATOR_ID)).toBe(true);
  });

  it('coordinator_receives_only_points', async () => {
    const scenario = smallScenario({ holders: 2, banlistSize: 100, flaggedByCount: [0.1, 0.05] });
    const { wire } = await score(scenario);
    const toCoordinator = wire.filter((w) => w.to === COORDINATOR_ID);
    expect(toCoordinator.length).toBe(4);
    for (const w of toCoordinator) {
      expect(w.bytes % 32).toBe(0);
      expect(w.preview).not.toContain('@');
    }
  });

  it('noise_matches_discrete_laplace_error', async () => {
    const scenario = smallScenario({ customers: 600, banlistSize: 300, flaggedByCount: [0.1] });
    const { querier } = await score(scenario, { source: seededSource(5) }, 0.5);
    const errors = scenario.querier.records.map((r) =>
      Math.abs(querier.scores![r.rowId]!.noisy - trueCount(scenario, r.rowId)),
    );
    const mae = errors.reduce((a, b) => a + b, 0) / errors.length;
    expect(errors.some((e) => e > 0)).toBe(true);
    // Within 25% of the closed-form mean absolute error over 600 draws.
    expect(Math.abs(mae - discreteLaplaceMeanAbsError(0.5))).toBeLessThan(
      0.25 * discreteLaplaceMeanAbsError(0.5),
    );
  });

  it('tiers_follow_noisy_counts', async () => {
    const { querier } = await score(smallScenario());
    for (const s of Object.values(querier.scores!)) expect(s.tier).toBe(tierOf(s.noisy));
  });
});
