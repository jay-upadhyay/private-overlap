import { describe, expect, it } from 'vitest';
import { buildPreset, PRESETS } from './presets';
import { flaggedCounts } from './scenario';

describe('presets', () => {
  it.each(PRESETS.map((p) => [p.id, p] as const))('presets_build: %s', (_id, preset) => {
    const scenario = buildPreset(preset.id);
    const { config } = preset;
    expect(scenario.querier.records).toHaveLength(config.querier.customers);
    expect(scenario.holders.map((h) => h.records.length)).toEqual(config.holders.map((h) => h.banlistSize));
    const flagged = flaggedCounts(config).reduce((a, b) => a + b, 0);
    expect(Object.keys(scenario.truth.flaggedBy)).toHaveLength(flagged);
  });

  it('onboarding_applicant_is_flagged', () => {
    const scenario = buildPreset('onboarding');
    expect(Object.keys(scenario.truth.flaggedBy)).toEqual([scenario.querier.records[0]!.rowId]);
  });

  it('seed_override_changes_data', () => {
    expect(buildPreset('portfolio', 1).querier.records[0]).not.toEqual(
      buildPreset('portfolio').querier.records[0],
    );
  });
});
