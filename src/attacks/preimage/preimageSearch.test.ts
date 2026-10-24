import { describe, expect, it } from 'vitest';
import { packFixed } from '../../crypto/bytes';
import { randomBytes } from '../../crypto/random';
import { HASH_BYTES } from '../../crypto/sha256';
import { extractIdentifiers } from '../../data/identifiers';
import type { MatchField } from '../../data/normalize';
import { buildPreset } from '../../data/presets';
import type { Scenario } from '../../data/scenario';
import { runInMemory } from '../../protocol/run';
import { screeningParties, type ScreeningProtocol } from '../../protocol/screening';
import { smallScenario } from '../../test/fixtures';
import { hashingProtocol, identifierHasher, MSG_BANLIST, MSG_CUSTOMERS, type HashingOptions } from '../../protocols/hashing';
import { breachCorpus, emailPatternCandidates, phoneRangeCandidates } from '../candidates';
import { scoreRecovery } from '../score';
import { preimageSearch } from './preimageSearch';

/** Wraps a protocol so every payload a party receives of `type` is captured, as a member would see it. */
function capturing(protocol: ScreeningProtocol, type: string, captured: Uint8Array[]): ScreeningProtocol {
  return {
    ...protocol,
    run: (role, input, ctx) =>
      protocol.run(role, input, {
        ...ctx,
        receive: async <T,>(from: string, t: string) => {
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
  await runInMemory(capturing(