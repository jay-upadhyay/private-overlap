import { describe, expect, it } from 'vitest';
import { extractIdentifiers } from '../../data/identifiers';
import { MATCH_FIELDS } from '../../data/normalize';
import { PRESETS, buildPreset } from '../../data/presets';
import { runInMemory } from '../../protocol/run';
import { expectedQuerierResult, screeningParties, type QuerierResult } from '../../protocol/screening';
import { payloadBytes } from '../../protocol/wire';
import { smallScenario } from '../../test/fixtures';
import { BANLIST_MESSAGE, plaintextProtocol } from './plaintext';

describe('plaintext', () => {
  for (const preset of PRESETS) {
    for (const field of MATCH_FIELDS) {
      it(`result_equals_ground_truth (${preset.id}, ${field})`, async () => {
        const scenario = buildPreset(preset.id);
        const { results } = await runInMemory(plaintextProtocol, screeningParties(scenario, field));
        const querier = results[scenario.querier.institution.id] as QuerierResult;
        expect(querier.flaggedBy).toEqual(expectedQuerierResult(scenario));
        for (const holder of scenario.holders) {
          expect(results[holder.institution.id]).toMatchObject({ kind: 'holder', screened: 0 });
        }
      });
    }
  }

  it('wire_contains_raw_lists', async () => {
    const scenario = smallScenario({ holders: 2, flaggedByCount: [0.1, 0.05] });
    const querier = scenario.querier.institution.id;
    const { wire } = await runInMemory(plaintextProtocol, screeningParties(scenario, 'email'));

    // The baseline leak: one message per holder, carrying its whole banlist in the clear.
    expect(wire).toHaveLength(scenario.holders.length);
    for (const holder of scenario.holders) {
      const banlist = extractIdentifiers(holder.records, 'email').values;
      const entry = wire.find((w) => w.from === holder.institution.id)!;
      expect(entry).toMatchObject({ to: querier, type: BANLIST_MESSAGE, bytes: payloadBytes(banlist) });
      expect(entry.preview).toContain(banlist[0]);
    }
  });

  it('role_and_input_mismatch_is_protocol_error', async () => {
    const [querier, holder] = screeningParties(smallScenario(), 'email');
    await expect(
      runInMemory(plaintextProtocol, [{ ...holder!, role: 'querier', input: holder!.input }, querier!]),
    ).rejects.toMatchObject({ name: 'ProtocolError' });
  });
});
