import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { runInMemory } from '../../protocol/run';
import { splitPoints, toHex } from '../../crypto';
import { multiPartyPsi, type MultiPsiQuerierOutput } from './multiParty';
import { multiPartyParties } from './parties';
import { capturedBytes, tapProtocol } from './tap';
import { fieldArb, smallScenario } from './testScenarios';
import { PSI_MESSAGES } from './twoParty';

const multiCaseArb = fc
  .record({
    seed: fc.integer({ min: 1, max: 1_000_000 }),
    customers: fc.integer({ min: 1, max: 20 }),
    holders: fc.integer({ min: 1, max: 4 }),
    fractions: fc.array(fc.double({ min: 0, max: 0.15, noNaN: true }), { minLength: 4, maxLength: 4 }),
    extraBanned: fc.array(fc.integer({ min: 0, max: 8 }), { minLength: 4, maxLength: 4 }),
    field: fieldArb,
  })
  .map(({ seed, customers, holders, fractions, extraBanned, field }) => {
    const flaggedByCount = fractions.slice(0, holders);
    // Each holder can be assigned at most every flagged customer.
    const flagged = flaggedByCount.reduce((sum, f) => sum + Math.round(f * customers), 0);
    const sizes = extraBanned.slice(0, holders).map((extra) => flagged + extra);
    return { field, scenario: smallScenario(seed, customers, sizes, flaggedByCount) };
  });

describe('multipsi', () => {
  it('grid_equals_ground_truth', async () => {
    await fc.assert(
      fc.asyncProperty(multiCaseArb, async ({ scenario, field }) => {
        const { results } = await runInMemory(multiPartyPsi, multiPartyParties(scenario, field));
        const querier = results.northwind as MultiPsiQuerierOutput;
        expect(querier.grid).toEqual(scenario.truth.flaggedBy);
        for (const holder of scenario.holders) {
          expect(results[holder.institution.id]).toEqual({
            role: 'holder',
            receivedCount: querier.sentCount,
            skipped: [],
          });
        }
      }),
      { numRuns: 12 },
    );
  }, 20_000);

  it('parallel_equals_sequential', async () => {
    const scenario = smallScenario(51, 20, [12, 14, 10, 16], [0.2, 0.1, 0.05, 0.05]);
    const parallel = await runInMemory(multiPartyPsi, multiPartyParties(scenario, 'email'));
    const sequential = await runInMemory(
      multiPartyPsi,
      multiPartyParties(scenario, 'email', { mode: 'sequential' }),
    );
    expect(sequential.results).toEqual(parallel.results);
    expect((parallel.results.northwind as MultiPsiQuerierOutput).grid).toEqual(scenario.truth.flaggedBy);

    // Sequential really is one session at a time: holder i answers before holder i+1 is asked.
    const order = sequential.wire.filter((w) => w.type !== PSI_MESSAGES.reblinded).map((w) => [w.type, w.to]);
    expect(order).toEqual(
      scenario.holders.flatMap((h) => [
        [PSI_MESSAGES.blinded, h.institution.id],
        [PSI_MESSAGES.holderSet, 'northwind'],
      ]),
    );
    // Parallel sends every blinded set before any holder set arrives.
    const firstHolderSet = parallel.wire.findIndex((w) => w.type === PSI_MESSAGES.holderSet);
    expect(
      parallel.wire.slice(0, firstHolderSet).filter((w) => w.type === PSI_MESSAGES.blinded),
    ).toHaveLength(4);
  });

  it('sessions_use_independent_scalars', async () => {
    const scenario = smallScenario(61, 15, [10, 10, 10, 10], [0.2, 0.1]);
    const { protocol, messages } = tapProtocol(multiPartyPsi);
    await runInMemory(protocol, multiPartyParties(scenario, 'phone'));

    // The same 15 customers went to four holders. With one shared scalar the four batches would be
    // the same 32-byte values (only reordered); with independent scalars no value repeats.
    const sentPerHolder = scenario.holders.map((h) => {
      const sent = messages.filter((m) => m.to === h.institution.id);
      return new Set(capturedBytes(sent).flatMap((b) => splitPoints(b).map(toHex)));
    });
    for (const set of sentPerHolder) expect(set.size).toBe(15);
    const all = new Set(sentPerHolder.flatMap((s) => [...s]));
    expect(all.size).toBe(15 * 4);

    // Same for everything the holders sent back.
    const replies = capturedBytes(messages.filter((m) => m.to === 'northwind')).flatMap((b) =>
      splitPoints(b),
    );
    expect(new Set(replies.map(toHex)).size).toBe(replies.length);
  });
});
