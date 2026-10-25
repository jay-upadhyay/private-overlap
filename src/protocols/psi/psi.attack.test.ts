import { describe, expect, it } from 'vitest';
import { fishingCandidates, runFishing, scoreFishing } from '../../attacks/fishing';
import { bytesToHex, packFixed, unpackFixed } from '../../crypto/bytes';
import { encodePoint, hashToGroup, POINT_BYTES } from '../../crypto/ristretto';
import { hashIdentifier } from '../../crypto/sha256';
import { extractIdentifiers } from '../../data/identifiers';
import { MATCH_FIELDS, normalizeField } from '../../data/normalize';
import type { Scenario } from '../../data/scenario';
import { runInMemory } from '../../protocol/run';
import { expectedQuerierResult, screeningParties } from '../../protocol/screening';
import { smallScenario } from '../../test/fixtures';
import { capturedBytes, tapProtocol } from './tap';
import { twoPartyPsi } from './twoParty';

const latin1 = (bytes: Uint8Array) => String.fromCharCode(...bytes);

/** Every identifier in the scenario, raw and normalized, across all three fields. */
function identifiers(scenario: Scenario): string[] {
  const records = [...scenario.querier.records, ...scenario.holders.flatMap((h) => h.records)];
  const out = new Set<string>();
  for (const record of records) {
    for (const field of MATCH_FIELDS) {
      out.add(record[field]);
      const normalized = normalizeField(field, record[field]);
      if (normalized) out.add(normalized);
    }
  }
  return [...out];
}

/**
 * A dictionary eavesdropper: looks up every 32-byte chunk among SHA-256 and unblinded H(x) of
 * every known identifier, and searches payloads (raw and hex) and previews for plaintext and hex digests.
 */
function dictionaryHits(
  payloads: readonly Uint8Array[],
  previews: readonly string[],
  values: readonly string[],
) {
  const digests = new Map<string, string>();
  const needles: string[] = [];
  for (const value of values) {
    const digest = bytesToHex(hashIdentifier(value));
    digests.set(digest, value);
    digests.set(bytesToHex(encodePoint(hashToGroup(value))), value);
    if (value.length >= 6) needles.push(value, digest);
  }
  const hits = new Set<string>();
  for (const payload of payloads) {
    for (const chunk of unpackFixed(payload, POINT_BYTES)) {
      const found = digests.get(bytesToHex(chunk));
      if (found) hits.add(found);
    }
    const text = latin1(payload) + bytesToHex(payload);
    for (const needle of needles) if (text.includes(needle)) hits.add(needle);
  }
  for (const preview of previews)
    for (const needle of needles) if (preview.includes(needle)) hits.add(needle);
  return [...hits];
}

describe('psi.attack', () => {
  it('dictionary.recovers_nothing', async () => {
    const scenario = smallScenario({ seed: 31, customers: 25, banlistSize: 20, flaggedByCount: [0.4] });
    const values = identifiers(scenario);
    for (const field of MATCH_FIELDS) {
      const { protocol, messages } = tapProtocol(twoPartyPsi);
      const { wire } = await runInMemory(protocol, screeningParties(scenario, field));
      const payloads = capturedBytes(messages);
      expect(payloads.length).toBe(messages.length); // every message is opaque binary
      const previews = wire.map((w) => w.preview);
      expect(dictionaryHits(payloads, previews, values)).toEqual([]);
    }

    // Control: the same lookup breaks a stage-1 style payload of SHA-256(normalized email).
    const emails = extractIdentifiers(scenario.querier.records, 'email').values;
    const stage1 = packFixed(emails.map(hashIdentifier), 32);
    const recovered = dictionaryHits([stage1], [], values).filter((v) => emails.includes(v));
    expect(recovered.sort()).toEqual([...emails].sort());
  });

  it('fishing.scrapes_banlist', async () => {
    const scenario = smallScenario({ seed: 41, customers: 40, banlistSize: 60, flaggedByCount: [0.25] });
    for (const field of MATCH_FIELDS) {
      const candidates = fishingCandidates(scenario, { field, coverage: 0.9, decoys: 300, seed: 5 });
      const result = await runFishing(scenario, { field, candidates });
      // The legitimate answer is unchanged, so the holder has nothing to notice but the count.
      expect(result.flaggedCustomers).toEqual(expectedQuerierResult(scenario));
      expect(result.sent).toBe(40 + candidates.length);
      const score = scoreFishing(scenario, 'h1', field, result.hitsByHolder.h1!);
      expect(score.recall).toBeGreaterThanOrEqual(0.8);
      // PSI is exact: every hit is genuinely on the list.
      expect(score.precision).toBe(1);
    }
  }, 20_000);
});
