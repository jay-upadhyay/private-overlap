// Closed-form accuracy facts about discrete Laplace noise, for explaining and charting ε.
// These are floats on purpose: they describe the mechanism, they never drive a privacy decision.

import { toNumber, toRational, type EpsilonInput } from './rational';

function epsilonValue(epsilon: EpsilonInput): number {
  const e = toNumber(toRational(epsilon));
  if (!(e > 0)) throw new RangeError('epsilon must be positive');
  return e;
}

/**
 * Best possible accuracy of guessing "is this customer on a banlist?" from one ε-DP release:
 * e^ε / (1 + e^ε), with a 50/50 prior. ε = 0.5 gives about 0.6225.
 */
export function membershipAccuracyBound(epsilon: EpsilonInput): number {
  return 1 / (1 + Math.exp(-epsilonValue(epsilon)));
}

/** P(noise = k) = (1 − q)/(1 + q) · q^|k| with q = e^−ε. */
export function discreteLaplacePmf(k: number, epsilon: EpsilonInput): number {
  const q = Math.exp(-epsilonValue(epsilon));
  return ((1 - q) / (1 + q)) * q ** Math.abs(k);
}

/** P(noise ≤ k). */
export function discreteLaplaceCdf(k: number, epsilon: EpsilonInput): number {
  const q = Math.exp(-epsilonValue(epsilon));
  const j = Math.floor(k);
  return j >= 0 ? 1 - q ** (j + 1) / (1 + q) : q ** -j / (1 + q);
}

/** Var = 2e^−ε / (1 − e^−ε)². */
export function discreteLaplaceVariance(epsilon: EpsilonInput): number {
  const e = epsilonValue(epsilon);
  return (2 * Math.exp(-e)) / Math.expm1(-e) ** 2;
}

/** E|noise| = 2e^−ε / (1 − e^−2ε). */
export function discreteLaplaceMeanAbsError(epsilon: EpsilonInput): number {
  const e = epsilonValue(epsilon);
  return (2 * Math.exp(-e)) / -Math.expm1(-2 * e);
}

export type Tier = 'clear' | 'review' | 'high';

export const TIER_LABELS: Readonly<Record<Tier, string>> = {
  clear: 'Clear',
  review: 'Review',
  high: 'High risk',
};

/**
 * Lowest noisy count for each tier above Clear. Defaults: Clear ≤ 0, Review = 1, High risk ≥ 2,
 * i.e. one holder's flag means "look closer", two or more means "act".
 */
export interface TierThresholds {
  readonly review: number;
  readonly high: number;
}

export const DEFAULT_TIER_THRESHOLDS: TierThresholds = { review: 1, high: 2 };

export function tierOf(noisyCount: number, thresholds: TierThresholds = DEFAULT_TIER_THRESHOLDS): Tier {
  if (thresholds.high < thresholds.review) throw new RangeError('high threshold below review threshold');
  if (noisyCount >= thresholds.high) return 'high';
  if (noisyCount >= thresholds.review) return 'review';
  return 'clear';
}

/** Probability of each released tier for a customer whose true flag count is trueCount. */
export function tierProbabilities(
  trueCount: number,
  epsilon: EpsilonInput,
  thresholds: TierThresholds = DEFAULT_TIER_THRESHOLDS,
): Record<Tier, number> {
  const belowReview = discreteLaplaceCdf(thresholds.review - 1 - trueCount, epsilon);
  const belowHigh = discreteLaplaceCdf(thresholds.high - 1 - trueCount, epsilon);
  return { clear: belowReview, review: belowHigh - belowReview, high: 1 - belowHigh };
}

/** Probability the released tier equals the tier of the true count. */
export function tierAccuracy(
  trueCount: number,
  epsilon: EpsilonInput,
  thresholds: TierThresholds = DEFAULT_TIER_THRESHOLDS,
): number {
  return tierProbabilities(trueCount, epsilon, thresholds)[tierOf(trueCount, thresholds)];
}
