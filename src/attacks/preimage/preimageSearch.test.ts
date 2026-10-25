import { describe, expect, it } from 'vitest';
import { packFixed, unpackFixed } from '../../crypto/bytes';
import { hashIdentifier, HASH_BYTES } from '../../crypto/sha256';
import {
  emailBases,
  emailSeparators,
  EMAIL_NUMBER_SUFFIX_MAX,
  EMAIL_YEAR_SUFFIX_RANGE,
} from '../../data/identity';
import { extractIdentifiers } from '../../data/identifiers';
import type { MatchField } from '../../data/normalize';
import type { Scenario } from '../../data/scenario';
import { EMAIL_DOMAINS } from '../../data/names';
import { runInMemory } from '../../protocol/run';
import { screeningParties, type ScreeningProtocol } from '../../protocol/screening';
import { smallScenario } from '../../test/fixtures';
import { hashingProtocol, MSG_BANLIST, type HashingOptions } from '../../protocols/hashing';
import { phoneRangeCandidates } from '../candidates';
import { scoreRecovery } from '../score';
import { preimageSearch } from './preimageSearch';

/** Wraps a protocol so every payload a party receives of `type` is captured, as a member would see it. */
function capturing(protocol: ScreeningProtocol, type: string, captured: Uint8Array[]): ScreeningProtocol {
  return {
    ...protocol,
    run: (role, input, ctx) =>
      protocol.run(role, input, {
        ...ctx,
        receive: async <T>(from: string, t: string) => {
          const payload = await ctx.receive<T>(from, t);
          if (t === type) captured.push(payload as Uint8Array);
          return payload;
        },
      }),
  };
}

/** Runs stage 1 on the scenario and returns the hashes received of the given message type. */
async function observe(scenario: Scenario, field: MatchField, type: string, options: HashingOptions = {}) {
  const captured: Uint8Array[] = [];
  await runInMemory(capturing(hashingProtocol(options), type, captured), screeningParties(scenario, field));
  return captured;
}

describe('attacks/preimage', () => {
  it('preimage_search_recovers_known_hashes', () => {
    const values = ['alice@example.com', 'bob@gmail.com', 'charlie@outlook.com', 'dana@proton.me'];
    const targets = packFixed(values.map(hashIdentifier), HASH_BYTES);
    const result = preimageSearch(targets, values);
    expect(result.recovered).toEqual(values);
    expect(result.targets).toBe(values.length);
    expect(result.tried).toBe(values.length);
  });

  it('phone_range_candidates_cover_selected_prefixes', () => {
    const prefixes = ['415555', '415777'];
    const values = [...phoneRangeCandidates(prefixes)];
    expect(values).toHaveLength(prefixes.length * 10_000);
    expect(values[0]).toBe('+14155550000');
    expect(values[9_999]).toBe('+14155559999');
    expect(values[10_000]).toBe('+14157770000');
  });

  it('hashing_attack_recovers_banlist_emails', async () => {
    const scenario = smallScenario({ seed: 17, customers: 80, banlistSize: 24, flaggedByCount: [0.3] });
    const targets = observe(scenario, 'email', MSG_BANLIST).then((payloads) =>
      payloads.flatMap((payload) => unpackFixed(payload, HASH_BYTES)),
    );
    const candidates = Array.from(
      new Set(
        [...scenario.querier.records, ...scenario.holders.flatMap((holder) => holder.records)].flatMap(
          (record) => {
            const first = record.firstName.toLowerCase();
            const last = record.lastName.toLowerCase();
            const values: string[] = [];
            for (const domain of EMAIL_DOMAINS) {
              for (const sep of emailSeparators(domain)) {
                for (const base of emailBases(first, last, sep)) {
                  for (let n = 0; n < EMAIL_NUMBER_SUFFIX_MAX; n++) values.push(`${base}${n}@${domain}`);
                  for (let y = EMAIL_YEAR_SUFFIX_RANGE[0]; y <= EMAIL_YEAR_SUFFIX_RANGE[1]; y++) {
                    values.push(`${base}${y}@${domain}`);
                  }
                  values.push(`${base}@${domain}`);
                }
              }
            }
            return values;
          },
        ),
      ),
    );
    const result = preimageSearch(await targets, candidates, { progressEvery: 10_000 });
    const truth = extractIdentifiers(scenario.holders[0]!.records, 'email').values;
    const score = scoreRecovery(result.recovered, truth);
    expect(score.recall).toBeGreaterThanOrEqual(0.8);
    expect(score.precision).toBe(1);
  }, 20_000);
});
