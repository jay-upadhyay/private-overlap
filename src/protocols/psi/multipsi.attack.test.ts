import { describe, expect, it } from 'vitest';
import { fishingCandidates, runMultiFishing, scoreFishing } from '../../attacks/fishing';
import { runInMemory } from '../../protocol/run';
import { screeningParties, type QuerierResult } from '../../protocol/screening';
import { smallScenario } from '../../test/fixtures';
import { multiPartyPsi } from './multiParty';

describe('multipsi.attack', () => {
  it('attribution.querier_learns_flagger', async () => {
    // Documents the leak stage 4 fixes: the querier is told not just "flagged" but by whom.
    const scenario = smallScenario({
      seed: 71,
      customers: 40,
      holders: 4,
      banlistSize: 24,
      flaggedByCount: [0.2, 0.1, 0.05, 0.05],
    });
    const { results } = await runInMemory(multiPartyPsi, screeningParties(scenario, 'wallet'));
    const { flaggedBy } = results.q as QuerierResult;

    const truth = scenario.truth.flaggedBy;
    const flagged = Object.keys(truth);
    expect(flagged.length).toBeGreaterThan(10);
    const correct = flagged.filter(
      (rowId) => [...flaggedBy[rowId]!].sort().join() === [...truth[rowId]!].sort().join(),
    );
    expect(correct.length / flagged.length).toBe(1);
    // And it can tell single-institution flags from consortium-wide ones.
    const byCount = (n: number) => Object.values(flaggedBy).filter((by) => by.length === n).length;
    expect([1, 2, 3, 4].map(byCount)).toEqual([8, 4, 2, 2]);
  });

  it('fishing.scrapes_all_lists', async () => {
    // One field keeps this fast; psi.attack covers fishing on every field.
    const scenario = smallScenario({
      seed: 81,
      customers: 30,
      holders: 4,
      banlistSize: 35,
      flaggedByCount: [0.15, 0.1],
    });
    const field = 'email';
    const candidates = fishingCandidates(scenario, { field, coverage: 0.9, decoys: 150, seed: 9 });
    const { hitsByHolder } = await runMultiFishing(scenario, { field, candidates });
    for (const id of ['h1', 'h2', 'h3', 'h4']) {
      const score = scoreFishing(scenario, id, field, hitsByHolder[id]!);
      expect(score.recall).toBeGreaterThanOrEqual(0.8);
      expect(score.precision).toBe(1);
    }
  }, 20_000);
});
