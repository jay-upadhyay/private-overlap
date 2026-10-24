import { describe, expect, it } from 'vitest';
import { HASH_BYTES } from '../../crypto/sha256';
import { extractIdentifiers } from '../../data/identifiers';
import { MATCH_FIELDS } from '../../data/normalize';
import { buildPreset, PRESETS } from '../../data/presets';
import {
  expectedQuerierResult,
  screeningParties,
  type HolderResult,
  type QuerierResult,
  type ScreeningInput,
  type ScreeningProtocol,
} from '../../protocol/screening';
import { runInMemory } from '../../protocol/run';
import { smallScenario } from '../../test/fixtures';
import { hashingProtocol, MSG_BANLIST, MSG_CUSTOMERS } from './index';

/** Wraps a protocol so every payload a party sends is also recorded in full. */
function recordingPayloads(protocol: ScreeningProtocol): {
  protocol: ScreeningProtocol;
  payloads: unknown[];
} {
  const payloads: unknown[] = [];
  return {
    payloads,
    protocol: {
      ...protocol,
      run: (role, input: ScreeningInput, ctx) =>
        protocol.run(role, input, {
          ...ctx,
          self: ctx.self,
          signal: ctx.signal,
          send: (to, type, payload, round) => {
            payloads.push(payload);
            ctx.send(to, type, payload, round);
          },
          receive: (from, type) => ctx.receive(from, type),
          progress: (fraction, label) => ctx.progress(fraction, label),
        }),
    },
  };
}

const key = new Uint8Array(32).fill(7);

describe('protocols/hashing', () => {
  for (const preset of PRESETS) {
    for (const field of MATCH_FIELDS) {
      it(`hashing.result_equals_ground_truth (${preset.id}, ${field})`, async () => {
        const scenario = buildPreset(preset.id);
        const { results } = await runInMemory(hashingProtocol(), screeningParties(scenario, field));
        const querier = results[scenario.querier.institution.id] as QuerierResult;
        expect(querier.flaggedBy).toEqual(expectedQuerierResult(scenario));
        expect(querier.skipped).toEqual([]);
      });
    }
  }

  it('hashing.hmac.result_equals_ground_truth', async () => {
    const scenario = buildPreset('consortium');
    const { results } = await runInMemory(
      hashingProtocol({ keyed: { key } }),
      screeningParties(scenario, 'email'),
    );
    expect((results.northwind as QuerierResult).flaggedBy).toEqual(expectedQuerierResult(scenario));
  });

  it('hashing.holders_learn_querier_list_size', async () => {
    const scenario = smallScenario({ holders: 2, banlistSize: 120, flaggedByCount: [0.1, 0.05] });
    const { results, wire } = await runInMemory(hashingProtocol(), screeningParties(scenario, 'phone'));
    for (const holder of scenario.holders) {
      expect((results[holder.institution.id] as HolderResult).screened).toBe(scenario.querier.records.length);
    }
    // One hash batch in each direction per holder, each exactly 32 bytes per identifier.
    expect(wire.map((w) => w.type).sort()).toEqual([MSG_BANLIST, MSG_BANLIST, MSG_CUSTOMERS, MSG_CUSTOMERS]);
    for (const entry of wire.filter((w) => w.type === MSG_BANLIST)) {
      expect(entry.bytes).toBe(120 * HASH_BYTES);
    }
  });

  for (const field of MATCH_FIELDS) {
    it(`hashing.wire_has_no_plaintext (${field})`, async () => {
      const scenario = smallScenario({ holders: 2, banlistSize: 120, flaggedByCount: [0.1, 0.05] });
      const { protocol, payloads } = recordingPayloads(hashingProtocol());
      const { wire } = await runInMemory(protocol, screeningParties(scenario, field));

      const records = [scenario.querier.records, ...scenario.holders.map((h) => h.records)].flat();
      const secrets = new Set([
        ...records.map((r) => r[field]),
        ...extractIdentifiers(records, field).values,
      ]);
      const decoder = new TextDecoder('latin1');
      const text = [
        ...payloads.map((p) => {
          expect(p).toBeInstanceOf(Uint8Array);
          return decoder.decode(p as Uint8Array);
        }),
        ...wire.map((w) => w.preview),
      ].join('\n');
      expect(secrets.size).toBeGreaterThan(300);
      for (const secret of secrets) expect(text.includes(secret)).toBe(false);
    });
  }
});
