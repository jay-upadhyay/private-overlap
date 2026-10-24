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

describe('preset sizes', () => {
  it.each(PRESETS.map((p) => [p.id, p] as const))('small_keeps_proportions: %s', (_id, preset) => {
    const full = buildPreset(preset.id);
    const small = buildPreset(preset.id, undefined, 'small');
    const n = (s: typeof full) => s.querier.records.length;
    const flagged = (s: typeof full) => Object.keys(s.truth.flaggedBy).length;
    expect(n(small)).toBe(Math.max(1, Math.round(n(full) / 10)));
    small.holders.forEach((h, i) =>
      expect(h.records.length).toBe(Math.max(1, Math.round(full.holders[i]!.records.length / 10))),
    );
    // Same flagged share, up to rounding to whole customers.
    expect(Math.abs(flagged(small) / n(small) - flagged(full) / n(full))).toBeLessThanOrEqual(
      preset.config.flaggedByCount.length / n(small),
    );
  });
});
