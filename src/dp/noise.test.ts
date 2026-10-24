import { describe, expect, it } from 'vitest';
import type { RandomSource } from '../crypto/random';
import { seededSource } from '../test/fixtures';
import { discreteLaplacePmf, discreteLaplaceVariance } from './bounds';
import { addNoise, sampleDiscreteLaplace } from './noise';
import type { EpsilonInput } from './rational';

function draws(n: number, epsilon: EpsilonInput, seed: number): number[] {
  const source = seededSource(seed);
  return Array.from({ length: n }, () => sampleDiscreteLaplace(epsilon, source));
}

/** Chi-square critical value at p = 0.001 (Wilson–Hilferty approximation). */
function chiSquareCritical(df: number): number {
  const z = 3.09;
  const a = 2 / (9 * df);
  return df * (1 - a + z * Math.sqrt(a)) ** 3;
}

describe('dp/noise', () => {
  it('discrete_laplace_moments', () => {
    // 10^5 draws at ε = 0.5: variance ≈ 7.84. Mean within 5 standard errors of 0; sample variance
    // within 5% of the closed form (its standard error is about 0.8% at this kurtosis).
    const n = 100_000;
    const sample = draws(n, 0.5, 1);
    const mean = sample.reduce((a, b) => a + b, 0) / n;
    const variance = sample.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
    const expected = discreteLaplaceVariance(0.5);
    expect(expected).toBeCloseTo((2 * Math.exp(-0.5)) / (1 - Math.exp(-0.5)) ** 2, 12);
    expect(Math.abs(mean)).toBeLessThan(5 * Math.sqrt(expected / n));
    expect(Math.abs(variance / expected - 1)).toBeLessThan(0.05);
  });

  it('integer_only', () => {
    for (const epsilon of [0.1, 0.5, 1, '1/3', 2.5]) {
      for (const x of draws(5_000, epsilon, 2)) {
        expect(Number.isSafeInteger(x)).toBe(true);
        expect(Object.is(x, -0)).toBe(false);
      }
    }
    expect(Number.isInteger(addNoise(3, 0.5, seededSource(3)))).toBe(true);
    expect(() => addNoise(1.5, 0.5)).toThrow(RangeError);
    expect(() => sampleDiscreteLaplace(0)).toThrow(RangeError);
  });

  it('symmetric', () => {
    // P(k) = P(−k): positive and negative counts agree, overall and for each small |k|.
    const n = 50_000;
    const sample = draws(n, 0.5, 4);
    const count = (k: number) => sample.filter((x) => x === k).length;
    const pos = sample.filter((x) => x > 0).length;
    const neg = sample.filter((x) => x < 0).length;
    expect(Math.abs(pos - neg)).toBeLessThan(5 * Math.sqrt(pos + neg));
    for (let k = 1; k <= 4; k++) {
      expect(Math.abs(count(k) - count(-k))).toBeLessThan(5 * Math.sqrt(count(k) + count(-k)));
    }
  });

  it('pmf_matches', () => {
    // Chi-square goodness of fit against the closed-form PMF, with the tails lumped so every
    // bucket expects at least 20 draws. ε = 1.5 exercises a numerator other than 1.
    const n = 40_000;
    for (const [i, epsilon] of [0.1, 0.5, 1, 1.5].entries()) {
      const sample = draws(n, epsilon, 10 + i);
      let K = 0;
      while (n * discreteLaplacePmf(K + 1, epsilon) >= 20) K++;
      const buckets = new Map<number, number>();
      for (const x of sample) {
        const b = Math.max(-K - 1, Math.min(K + 1, x));
        buckets.set(b, (buckets.get(b) ?? 0) + 1);
      }
      const tail = Array.from({ length: K + 1 }, (_, k) => discreteLaplacePmf(k, epsilon));
      const tailMass = (1 - tail[0]! - 2 * tail.slice(1).reduce((a, b) => a + b, 0)) / 2;
      let chi = 0;
      for (let b = -K - 1; b <= K + 1; b++) {
        const p = Math.abs(b) === K + 1 ? tailMass : discreteLaplacePmf(b, epsilon);
        const observed = buckets.get(b) ?? 0;
        chi += (observed - n * p) ** 2 / (n * p);
      }
      const df = 2 * K + 2;
      expect(chi, `ε = ${epsilon}`).toBeLessThan(chiSquareCritical(df));
    }
  });

  it('uses_injected_source', () => {
    expect(draws(1_000, 0.5, 42)).toEqual(draws(1_000, 0.5, 42));
    expect(draws(1_000, 0.5, 42)).not.toEqual(draws(1_000, 0.5, 43));
    let calls = 0;
    const inner = seededSource(5);
    const counting: RandomSource = { fill: (bytes) => (calls++, inner.fill(bytes)) };
    sampleDiscreteLaplace(0.5, counting);
    expect(calls).toBeGreaterThan(0);
  });
});
