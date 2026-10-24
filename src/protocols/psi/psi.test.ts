import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { truthMatches } from '../../data/scenario';
import { runInMemory } from '../../protocol/run';
import { splitPoints, toHex } from '../../crypto';
import { twoPartyParties } from './parties';
import { capturedBytes, tapProtocol } from './tap';
import { orderedRows, smallScenario, twoPartyCaseArb } from './testScenarios';
import { PSI_MESSAGES, twoPartyPsi, type PsiHolderOutput, type PsiQuerierOutput } from './twoParty';

describe('psi', () => {
  it('result_equals_ground_truth', async () => {
    await fc.assert(
      fc.asyncProperty(twoPartyCaseArb, async ({ scenario, field }) => {
        const parties = twoPartyParties(scenario, field);
        const { results } = await runInMemory(twoPartyPsi, parties);
        const querier = results[parties[0]!.id] as PsiQuerierOutput;
        const holderId = parties[1]!.id;
        expect(querier.matches).toEqual(orderedRows(scenario, truthMatches(scenario, holderId)));
        expect(querier.skipped).toEqual([]);
        expect(querier.holderSetSize).toBe(scenario.holders[0]!.records.length);
      }),
      { numRuns: 15 },
    );
  });

  it('skips_values_that_fail_normalization', async () => {
    const scenario = smallScenario(7, 6, [4], [0.5]);
    const bad = { ...scenario.querier.records[0]!, rowId: 'bad-1', email: 'not an email' };
    scenario.querier.records.push(bad);
    scenario.holders[0]!.records.push({ ...scenario.holders[0]!.records[0]!, rowId: 'bad-h', email: '@@' });
    const parties = twoPartyParties(scenario, 'email');
    const { results } = await runInMemory(twoPartyPsi, parties);
    const querier = results.northwind as PsiQuerierOutput;
    const holder = results.halcyon as PsiHolderOutput;
    expect(querier.skipped).toEqual([{ rowId: 'bad-1', field: 'email', raw: 'not an email' }]);
    expect(holder.skipped).toEqual([{ rowId: 'bad-h', field: 'email', raw: '@@' }]);
    expect(querier.matches).toEqual(orderedRows(scenario, truthMatches(scenario, 'halcyon')));
  });

  it('holder_learns_only_size', async () => {
    // Two different customer bases of the same size: the holder's view must be the same shape
    // and its output identical.
    const a = smallScenario(11, 12, [8], [0.25]);
    const b = smallScenario(12, 12, [8], [0.5]);
    b.holders[0] = a.holders[0]!; // same holder, same banlist
    const views = [];
    for (const scenario of [a, b]) {
      const { protocol, messages } = tapProtocol(twoPartyPsi);
      const { results, wire } = await runInMemory(protocol, twoPartyParties(scenario, 'phone'));
      const toHolder = wire.filter((w) => w.to === 'halcyon');
      expect(toHolder.map((w) => [w.type, w.bytes])).toEqual([[PSI_MESSAGES.blinded, 12 * 32]]);
      // The 12 points are opaque and distinct; nothing else rides along.
      const payload = messages.find((m) => m.to === 'halcyon')!.payload as Uint8Array;
      expect(new Set(splitPoints(payload).map(toHex)).size).toBe(12);
      views.push(results.halcyon);
    }
    expect(views[0]).toEqual({ role: 'holder', receivedCount: 12, skipped: [] });
    expect(views[1]).toEqual(views[0]);
  });

  it('fresh_scalars_per_run', async () => {
    const scenario = smallScenario(21, 15, [10], [0.4]);
    const runs: { results: unknown; chunks: Set<string> }[] = [];
    for (let i = 0; i < 2; i++) {
      const { protocol, messages } = tapProtocol(twoPartyPsi);
      const { results } = await runInMemory(protocol, twoPartyParties(scenario, 'email'));
      runs.push({
        results,
        chunks: new Set(capturedBytes(messages).flatMap((b) => splitPoints(b).map(toHex))),
      });
    }
    // Same inputs, same answer...
    expect(runs[1]!.results).toEqual(runs[0]!.results);
    // ...but not one 32-byte value on the wire repeats between runs, so runs cannot be linked.
    const repeated = [...runs[0]!.chunks].filter((c) => runs[1]!.chunks.has(c));
    expect(runs[0]!.chunks.size).toBeGreaterThan(0);
    expect(repeated).toEqual([]);
  });
});
