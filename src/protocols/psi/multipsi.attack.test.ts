import { describe, expect, it } from 'vitest';
import { buildCandidates, recoveryRate, runMultiFishing } from '../../attacks/fishing';
import { runInMemory } from '../../protocol/run';
import { multiPartyPsi, type MultiPsiQuerierOutput } from './multiParty';
import { multiPartyParties } from './parties';
import { smallScenario } from './testScenarios';

describe('multipsi.attack', () => {
  it('attribution.querier_learns_flagger', async () => {
    // Documents the leak stage 4 fixes: the querier is told not just "flagged" but by whom.
    const scenario = smallScenario(71, 40, [20, 24, 18, 22], [0.2, 0.1, 0.05, 0.05]);
    const { results } = await runInMemory(multiPartyPsi, multiPartyParties(scenario, 'wallet'));
    const { grid } = results.northwind as MultiPsiQuerierOutput;

    const truth = scenario.truth.flaggedBy;
    const flagged = Object.keys(truth);
    expect(flagged.length).toBeGreaterThan(10);
    const correct = flagged.filter((rowId) => JSON.stringify(grid[rowId]) === JSON.stringify(truth[rowId]));
    expect(correct.length / flagged.length).toBe(1);
    // And it can tell single-institution flags from consortium-wide ones.
    const byCount = (n: number) => Object.values(grid).filter((by) => by.length === n).length;
    expect([1, 2, 3, 4].map(byCount)).toEqual([8, 4, 2, 2]);
  });

  it('fishing.scrapes_all_lists', async () => {
    // One field keeps this fast; psi.attack covers fishing on every field.
    const scenario = smallScenario(81, 30, [30, 40, 25, 35], [0.15, 0.1]);
    const field = 'email';
    const candidates = buildCandidates(scenario, { field, coverage: 0.9, decoys: 150, seed: 9 });
    const { hitsByHolder } = await runMultiFishing(scenario, { field, candidates });
    for (const holder of scenario.holders) {
      const id = holder.institution.id;
      expect(recoveryRate(scenario, id, field, hitsByHolder[id]!)).toBeGreaterThanOrEqual(0.8);
    }
  }, 20_000);
});
