import { describe, expect, it } from 'vitest';
import { extractIdentifiers } from '../data/identifiers';
import { buildPreset } from '../data/presets';
import { smallScenario } from '../test/fixtures';
import { expectedQuerierResult, screeningParties } from './screening';

describe('protocol/screening', () => {
  it('builds_one_party_per_institution', () => {
    const scenario = buildPreset('consortium');
    const parties = screeningParties(scenario, 'wallet');
    expect(parties.map((p) => [p.id, p.role])).toEqual([
      ['northwind', 'querier'],
      ['halcyon', 'holder'],
      ['copperline', 'holder'],
      ['meridian', 'holder'],
      ['bluewater', 'holder'],
    ]);
    expect(parties[0]!.input).toMatchObject({
      kind: 'querier',
      field: 'wallet',
      holders: ['halcyon', 'copperline', 'meridian', 'bluewater'],
    });
    expect(parties[1]!.input).toMatchObject({ kind: 'holder', querier: 'northwind' });
  });

  it('expected_result_matches_truth', () => {
    const scenario = smallScenario({ holders: 3, banlistSize: 150, flaggedByCount: [0.1, 0.05, 0.02] });
    const expected = expectedQuerierResult(scenario);
    expect(Object.keys(expected).sort()).toEqual(Object.keys(scenario.truth.flaggedBy).sort());
  });

  it('extract_identifiers_skips_invalid_values', () => {
    const records = [
      { ...smallScenario().querier.records[0]!, rowId: 'ok' },
      { ...smallScenario().querier.records[1]!, rowId: 'bad', email: 'not-an-email' },
    ];
    const ids = extractIdentifiers(records, 'email');
    expect(ids.rowIds).toEqual(['ok']);
    expect(ids.skipped).toEqual(['bad']);
    expect(ids.values[0]).toMatch(/@/);
  });
});
