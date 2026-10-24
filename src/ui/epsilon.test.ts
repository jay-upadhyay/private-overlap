import { describe, expect, it } from 'vitest';
import { buildPreset } from '../data/presets';
import { membershipAccuracyBound } from '../dp/bounds';
import { estimateRunMs, formatDuration } from './estimate';
import { expectedTierAccuracy, flagCountMix, GRID } from './epsilon';

describe('epsilon chart math', () => {
  const scenario = buildPreset('consortium', undefined, 1000);
  const mix = flagCountMix(scenario);

  it('mix_sums_to_one_and_matches_truth', () => {
    expect(mix.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(mix[0]).toBeCloseTo(1 - Object.keys(scenario.truth.flaggedBy).length / 1000, 10);
  });

  it('accuracy_and_attacker_bound_both_rise_with_epsilon', () => {
    for (let i = 1; i < GRID.length; i++) {
      expect(expectedTierAccuracy(mix, GRID[i]!)).toBeGreaterThan(expectedTierAccuracy(mix, GRID[i - 1]!));
      expect(membershipAccuracyBound(GRID[i]!)).toBeGreaterThan(membershipAccuracyBound(GRID[i - 1]!));
    }
  });

  it('expected_accuracy_near_measured_runs_at_half', () => {
    // Two live runs at ε 0.5 measured 61% and 64%.
    expect(expectedTierAccuracy(mix, 0.5)).toBeGreaterThan(0.55);
    expect(expectedTierAccuracy(mix, 0.5)).toBeLessThan(0.7);
  });
});

describe('run estimate', () => {
  it('psi_cost_grows_with_size', () => {
    const small = estimateRunMs('psi', buildPreset('portfolio', undefined, 1000));
    const full = estimateRunMs('psi', buildPreset('portfolio'));
    expect(full).toBeGreaterThan(5 * small);
    // Calibrated on a 1.6 s measured run at 1,000 customers.
    expect(small).toBeGreaterThan(800);
    expect(small).toBeLessThan(3200);
  });

  it('formats_durations', () => {
    expect(formatDuration(400)).toBe('under a second');
    expect(formatDuration(1600)).toBe('about 1.5 s');
    expect(formatDuration(25_000)).toBe('about 25 s');
    expect(formatDuration(90_000)).toBe('about 1.5 min');
  });
});
