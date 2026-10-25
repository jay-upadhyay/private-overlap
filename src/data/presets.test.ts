import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { buildPreset, customerRange, PRESETS } from './presets';
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
    const small = buildPreset(
      preset.id,
      undefined,
      Math.max(1, Math.round(preset.config.querier.customers / 10)),
    );
    const n = (s: typeof full) => s.querier.records.length;
    const flagged = (s: typeof full) => Object.keys(s.truth.flaggedBy).length;
    expect(n(small)).toBe(Math.max(1, Math.round(n(full) / 10)));
    // Banlists scale by the same factor as customers (a single applicant cannot shrink).
    const factor = n(small) / n(full);
    small.holders.forEach((h, i) =>
      expect(h.records.length).toBe(Math.max(1, Math.round(full.holders[i]!.records.length * factor))),
    );
    // Same flagged share, up to rounding to whole customers.
    expect(Math.abs(flagged(small) / n(small) - flagged(full) / n(full))).toBeLessThanOrEqual(
      preset.config.flaggedByCount.length / n(small),
    );
  });
});

describe('custom sizes', () => {
  it('every_size_in_range_builds', () => {
    fc.assert(
      fc.property(fc.constantFrom(...PRESETS), fc.double({ min: 0, max: 1, noNaN: true }), (preset, t) => {
        const { min, max } = customerRange(preset.id);
        const n = Math.round(min + t * (max - min));
        expect(buildPreset(preset.id, undefined, n).querier.records).toHaveLength(n);
      }),
      { numRuns: 25 },
    );
  });
});
