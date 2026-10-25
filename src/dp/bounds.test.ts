import { describe, expect, it } from 'vitest';
import {
  discreteLaplaceCdf,
  discreteLaplaceMeanAbsError,
  discreteLaplacePmf,
  discreteLaplaceVariance,
  membershipAccuracyBound,
  tierAccuracy,
  tierOf,
  tierProbabilities,
} from './bounds';

describe('dp/bounds', () => {
  it('membership_bound_known_values', () => {
    expect(membershipAccuracyBound(0.5)).toBeCloseTo(0.6225, 4);
    expect(membershipAccuracyBound(1)).toBeCloseTo(0.7311, 4);
    expect(membershipAccuracyBound('1/1000')).toBeCloseTo(0.50025, 5);
    expect(membershipAccuracyBound(50)).toBeCloseTo(1, 10);
  });

  it('variance_and_mae_known_values', () => {
    expect(discreteLaplaceVariance(1)).toBeCloseTo(1.8413, 4);
    expect(discreteLaplaceVariance(0.5)).toBeCloseTo(7.8354, 3);
    expect(discreteLaplaceMeanAbsError(1)).toBeCloseTo(0.8509, 4);
    // Agrees with summing the PMF directly.
    for (const e of [0.1, 0.5, 2]) {
      let mae = 0;
      let variance = 0;
      for (let k = -2000; k <= 2000; k++) {
        mae += Math.abs(k) * discreteLaplacePmf(k, e);
        variance += k * k * discreteLaplacePmf(k, e);
      }
      expect(discreteLaplaceMeanAbsError(e)).toBeCloseTo(mae, 8);
      expect(discreteLaplaceVariance(e)).toBeCloseTo(variance, 6);
    }
  });

  it('cdf_matches_pmf', () => {
    let sum = 0;
    for (let k = -200; k <= 5; k++) sum += discreteLaplacePmf(k, 0.5);
    expect(discreteLaplaceCdf(5, 0.5)).toBeCloseTo(sum, 12);
    expect(discreteLaplaceCdf(-1, 0.5) + discreteLaplacePmf(0, 0.5)).toBeCloseTo(
      discreteLaplaceCdf(0, 0.5),
      12,
    );
  });

  it('default_tiers', () => {
    expect(tierOf(-3)).toBe('clear');
    expect(tierOf(0)).toBe('clear');
    expect(tierOf(1)).toBe('review');
    expect(tierOf(2)).toBe('high');
    expect(tierOf(9)).toBe('high');
  });

  it('configurable_tiers', () => {
    const t = { review: 2, high: 4 };
    expect(tierOf(1, t)).toBe('clear');
    expect(tierOf(3, t)).toBe('review');
    expect(tierOf(4, t)).toBe('high');
    expect(() => tierOf(0, { review: 3, high: 2 })).toThrow(RangeError);
  });

  it('tier_accuracy_grows_with_epsilon', () => {
    for (const count of [0, 1, 2, 3]) {
      const p = tierProbabilities(count, 0.5);
      expect(p.clear + p.review + p.high).toBeCloseTo(1, 12);
      expect(tierAccuracy(count, 0.1)).toBeLessThan(tierAccuracy(count, 1));
      expect(tierAccuracy(count, 1)).toBeLessThan(tierAccuracy(count, 5));
      expect(tierAccuracy(count, 30)).toBeCloseTo(1, 8);
    }
    // A true Review (count 1) is only right when the noise is exactly 0.
    expect(tierAccuracy(1, 0.5)).toBeCloseTo(discreteLaplacePmf(0, 0.5), 12);
  });
});
