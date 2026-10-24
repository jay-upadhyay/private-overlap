import { sha256 } from '@noble/hashes/sha2.js';
import { describe, expect, it } from 'vitest';
import { buildCandidates, recoveryRate, runFishing } from '../../attacks/fishing';
import { MATCH_FIELDS, normalizeField } from '../../data/normalize';
import { truthMatches, type Scenario } from '../../data/scenario';
import { runInMemory } from '../../protocol/run';
import { encodePoint, hashToGroup, splitPoints, toHex } from '../../crypto';
import { twoPartyParties } from './parties';
import { capturedBytes, tapProtocol } from './tap';
import { orderedRows, smallScenario } from './testScenarios';
import { twoPartyPsi } from './twoParty';

const encoder = new TextEncoder();
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

/** What a stage-1-style eavesdropper would try: plaintext, SHA-256 (bytes and hex), and H(x) itself. */
function dictionary(values: readonly string[]) {
  const digests = new Map<string, string>();
  const needles: string[] = [];
  for (const value of values) {
    const digest = sha256(encoder.encode(value));
    digests.set(toHex(digest), value);
    digests.set(toHex(encodePoint(hashToGroup(value))), value);
    needles.push(value, toHex(digest));
  }
  return { digests, needles };
}

function dictionaryHits(
  payloads: readonly Uint8Array[],
  previews: readonly string[],
  values: readonly string[],
) {
  const { digests, needles } = dictionary(values);
  const hits = new Set<string>();
  for (const payload of payloads) {
    for (const chunk of splitPoints(payload)) {
      const found = digests.get(toHex(chunk));
      if (found) hits.add(found);
    }
    const text = latin1(payload) + toHex(payload);
    for (const needle of needles) if (needle.length >= 6 && text.includes(needle)) hits.add(needle);
  }
  for (const preview of previews) {
    for (const needle of needles) if (needle.length >= 6 && preview.includes(needle)) hits.add(needle);
  }
  return [...hits];
}

describe('psi.attack', () => {
  it('dictionary.recovers_nothing', async () => {
    const scenario = smallScenario(31, 25, [20], [0.4]);
    const values = identifiers(scenario);
    for (const field of MATCH_FIELDS) {
      const { protocol, messages } = tapProtocol(twoPartyPsi);
      const { wire } = await runInMemory(protocol, twoPartyParties(scenario, field));
      const payloads = capturedBytes(messages);
      expect(payloads.length).toBe(messages.length); // every message is opaque binary
      expect(
        dictionaryHits(
          payloads,
          wire.map((w) => w.preview),
          values,
        ),
      ).toEqual([]);
    }

    // Control: the same lookup breaks a stage-1 style payload of SHA-256(normalized email).
    const hashed = scenario.querier.records.map((r) =>
      sha256(encoder.encode(normalizeField('email', r.email)!)),
    );
    const stage1 = new Uint8Array(hashed.length * 32);
    hashed.forEach((h, i) => stage1.set(h, i * 32));
    const recovered = dictionaryHits([stage1], [], values);
    expect(recovered.filter((v) => v.includes('@')).length).toBe(scenario.querier.records.length);
  });

  it('fishing.scrapes_banlist', async () => {
    const scenario = smallScenario(41, 40, [60], [0.25]);
    for (const field of MATCH_FIELDS) {
      const candidates = buildCandidates(scenario, { field, coverage: 0.9, decoys: 300, seed: 5 });
      const result = await runFishing(scenario, { field, candidates });
      // The legitimate answer is unchanged, so the holder has nothing to notice but the count.
      expect(result.flaggedCustomers).toEqual(orderedRows(scenario, truthMatches(scenario, 'halcyon')));
      // Distinct values sent: some candidates are the querier's own banned customers.
      expect(result.sent).toBeGreaterThanOrEqual(40 + 300);
      const rate = recoveryRate(scenario, 'halcyon', field, result.hits);
      expect(rate).toBeGreaterThanOrEqual(0.8);
      // Every hit is genuinely on the list: PSI has no false positives to hide behind.
      expect(recoveryRate(scenario, 'halcyon', field, result.hits) * 60).toBeCloseTo(result.hits.length, 5);
    }
  });
});
