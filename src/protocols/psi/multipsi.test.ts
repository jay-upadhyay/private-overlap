import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { bytesToHex, unpackFixed } from '../../crypto/bytes';
import { POINT_BYTES } from '../../crypto/ristretto';
import { runInMemory } from '../../protocol/run';
import { expectedQuerierResult, screeningParties, type QuerierResult } from '../../protocol/screening';
import { smallScenario } from '../../test/fixtures';
import { createMultiPartyPsi, multiPartyPsi } from './multiParty';
import { PSI_MESSAGES } from './session';
import { capturedBytes, tapProtocol } from './tap';
import { screeningCaseArb } from './testScenarios';

const chunks = (bytes: Uint8Array) => unpackFixed(bytes, POINT_BYTES).map(bytesToHex);

describe('multipsi', () => {
  it('grid_equals_ground_truth', async () => {
    await fc.assert(
      fc.asyncProperty(screeningCaseArb(4, 20), async ({ scenario, field }) => {
        const { results } = await runInMemory(multiPartyPsi, screeningParties(scenario, field));
        expect((results.q as QuerierResult).flaggedBy).toEqual(expectedQuerierResult(scenario));
        // Every holder screened the same number of values and learned nothing else.
        const views = scenario.holders.map((h) => results[h.institution.id]);
        for (const view of views) expect(view).toEqual(views[0]);
      }),
      { numRuns: 12 },
    );
  }, 20_000);

  it('parallel_equals_sequential', async () => {
    const scenario = smallScenario({
      seed: 51,
      customers: 20,
      holders: 4,
      banlistSize: 16,
      flaggedByCount: [0.2, 0.1, 0.05, 0.05],
    });
    const parties = screeningParties(scenario, 'email');
    const parallel = await runInMemory(multiPartyPsi, parties);
    const sequential = await runInMemory(createMultiPartyPsi({ mode: 'sequential' }), parties);
    expect(sequential.results).toEqual(parallel.results);
    expect((parallel.results.q as QuerierResult).flaggedBy).toEqual(expectedQuerierResult(scenario));

    // Sequential really is one session at a time: holder i answers before holder i+1 is asked.
    const order = sequential.wire.filter((w) => w.type !== PSI_MESSAGES.reblinded).map((w) => [w.type, w.to]);
    expect(order).toEqual(
      ['h1', 'h2', 'h3', 'h4'].flatMap((h) => [
        [PSI_MESSAGES.blinded, h],
        [PSI_MESSAGES.holderSet, 'q'],
      ]),
    );
    // Parallel sends every blinded set before any holder set arrives.
    const firstHolderSet = parallel.wire.findIndex((w) => w.type === PSI_MESSAGES.holderSet);
    expect(
      parallel.wire.slice(0, firstHolderSet).filter((w) => w.type === PSI_MESSAGES.blinded),
    ).toHaveLength(4);
  });

  it('sessions_use_independent_scalars', async () => {
    const scenario = smallScenario({
      seed: 61,
      customers: 15,
      holders: 4,
      banlistSize: 10,
      flaggedByCount: [0.2, 0.1],
    });
    const { protocol, messages } = tapProtocol(multiPartyPsi);
    await runInMemory(protocol, screeningParties(scenario, 'phone'));

    // The same 15 customers went to four holders. With one shared scalar the four batches would be
    // the same 32-byte values (only reordered); with independent scalars no value repeats.
    const sentPerHolder = ['h1', 'h2', 'h3', 'h4'].map(
      (h) => new Set(capturedBytes(messages.filter((m) => m.to === h)).flatMap(chunks)),
    );
    for (const set of sentPerHolder) expect(set.size).toBe(15);
    expect(new Set(sentPerHolder.flatMap((s) => [...s])).size).toBe(15 * 4);

    // Same for everything the holders sent back.
    const replies = capturedBytes(messages.filter((m) => m.to === 'q')).flatMap(chunks);
    expect(new Set(replies).size).toBe(replies.length);
  });
});
