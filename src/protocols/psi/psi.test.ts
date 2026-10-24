import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { bytesToHex, unpackFixed } from '../../crypto/bytes';
import { POINT_BYTES } from '../../crypto/ristretto';
import { runInMemory } from '../../protocol/run';
import { expectedQuerierResult, screeningParties } from '../../protocol/screening';
import { smallScenario } from '../../test/fixtures';
import { PSI_MESSAGES } from './session';
import { capturedBytes, tapProtocol } from './tap';
import { screeningCaseArb } from './testScenarios';
import { twoPartyPsi } from './twoParty';

const chunks = (bytes: Uint8Array) => unpackFixed(bytes, POINT_BYTES).map(bytesToHex);

describe('psi', () => {
  it('result_equals_ground_truth', async () => {
    await fc.assert(
      fc.asyncProperty(screeningCaseArb(1, 30), async ({ scenario, field }) => {
        const { results } = await runInMemory(twoPartyPsi, screeningParties(scenario, field));
        expect(results.q).toEqual({
          kind: 'querier',
          flaggedBy: expectedQuerierResult(scenario),
          skipped: [],
        });
        expect(results.h1).toMatchObject({ kind: 'holder', skipped: [] });
      }),
      { numRuns: 15 },
    );
  }, 20_000);

  it('skips_values_that_fail_normalization', async () => {
    const scenario = smallScenario({ seed: 7, customers: 6, banlistSize: 4, flaggedByCount: [0.5] });
    scenario.querier.records.push({ ...scenario.querier.records[0]!, rowId: 'bad-q', email: 'not an email' });
    scenario.holders[0]!.records.push({ ...scenario.holders[0]!.records[0]!, rowId: 'bad-h', email: '@@' });
    const { results } = await runInMemory(twoPartyPsi, screeningParties(scenario, 'email'));
    expect(results.q).toEqual({
      kind: 'querier',
      flaggedBy: expectedQuerierResult(scenario),
      skipped: ['bad-q'],
    });
    expect(results.h1).toEqual({ kind: 'holder', screened: 6, skipped: ['bad-h'] });
  });

  it('rejects_more_than_one_holder', async () => {
    const scenario = smallScenario({ customers: 3, holders: 2, banlistSize: 2, flaggedByCount: [0] });
    await expect(runInMemory(twoPartyPsi, screeningParties(scenario, 'email'))).rejects.toThrow(
      '1–1 holders',
    );
  });

  it('holder_learns_only_size', async () => {
    // Two different customer bases of the same size against the same banlist: the holder's
    // view must have the same shape and its output must be identical.
    const a = smallScenario({ seed: 11, customers: 12, banlistSize: 8, flaggedByCount: [0.25] });
    const b = smallScenario({ seed: 12, customers: 12, banlistSize: 8, flaggedByCount: [0.5] });
    b.holders[0] = a.holders[0]!;
    const views = [];
    for (const scenario of [a, b]) {
      const { protocol, messages } = tapProtocol(twoPartyPsi);
      const { results, wire } = await runInMemory(protocol, screeningParties(scenario, 'phone'));
      const toHolder = wire.filter((w) => w.to === 'h1');
      expect(toHolder.map((w) => [w.type, w.bytes])).toEqual([[PSI_MESSAGES.blinded, 12 * 32]]);
      // The 12 points are opaque and distinct; nothing else rides along.
      expect(new Set(chunks(capturedBytes(messages.filter((m) => m.to === 'h1'))[0]!)).size).toBe(12);
      views.push(results.h1);
    }
    expect(views[0]).toEqual({ kind: 'holder', screened: 12, skipped: [] });
    expect(views[1]).toEqual(views[0]);
  });

  it('fresh_scalars_per_run', async () => {
    const scenario = smallScenario({ seed: 21, customers: 15, banlistSize: 10, flaggedByCount: [0.4] });
    const runs: { results: unknown; chunks: Set<string> }[] = [];
    for (let i = 0; i < 2; i++) {
      const { protocol, messages } = tapProtocol(twoPartyPsi);
      const { results } = await runInMemory(protocol, screeningParties(scenario, 'email'));
      runs.push({ results, chunks: new Set(capturedBytes(messages).flatMap(chunks)) });
    }
    // Same inputs, same answer...
    expect(runs[1]!.results).toEqual(runs[0]!.results);
    // ...but not one 32-byte value on the wire repeats between runs, so runs cannot be linked.
    expect(runs[0]!.chunks.size).toBeGreaterThan(0);
    expect([...runs[0]!.chunks].filter((c) => runs[1]!.chunks.has(c))).toEqual([]);
  });
});
