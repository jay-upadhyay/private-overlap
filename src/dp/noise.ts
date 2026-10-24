// Exact discrete Laplace noise: P(k) ∝ exp(−ε·|k|), scale 1/ε.
//
// Algorithm: Canonne, Kamath & Steinke 2020, "The Discrete Gaussian for Differential Privacy",
// Algorithm 1 (Bernoulli(exp(−γ)) for rational γ) and Algorithm 2 (discrete Laplace with scale t/s).
// With ε = s/t in lowest terms the scale is t/s. Every step is a comparison of uniform integers
// drawn through uniformInt, so there is no floating-point sampling path: a float-based sampler
// (e.g. inverting a CDF with Math.log) leaks through rounding artefacts in the low bits, the
// classic Mironov 2012 attack on naive Laplace.

import { randomUint32, secureSource, uniformInt, type RandomSource } from '../crypto/random';
import { toRational, type EpsilonInput } from './rational';

const TWO_32 = 2 ** 32;
const TWO_53 = 2 ** 53;

/** Uniform integer in [0, max) for any safe max; uniformInt covers max ≤ 2^32. */
function uniformBelow(max: number, source: RandomSource): number {
  if (max <= TWO_32) return uniformInt(max, source);
  if (!Number.isSafeInteger(max)) throw new RangeError(`bad max ${max}`);
  const limit = TWO_53 - (TWO_53 % max);
  for (;;) {
    const x = uniformInt(2 ** 21, source) * TWO_32 + randomUint32(source);
    if (x < limit) return x % max;
  }
}

/** Bernoulli(exp(−n/d)) for 0 ≤ n/d ≤ 1 (CKS Algorithm 1, first branch). */
function bernoulliExpNegAtMostOne(n: number, d: number, source: RandomSource): boolean {
  let k = 1;
  for (;;) {
    const q = d * k;
    if (!Number.isSafeInteger(q)) throw new RangeError('epsilon denominator too large');
    if (uniformBelow(q, source) >= n) break; // Bernoulli(n / (d·k)) came up 0
    k++;
  }
  return k % 2 === 1;
}

/** Bernoulli(exp(−n/d)) for any n/d ≥ 0 (CKS Algorithm 1). */
function bernoulliExpNeg(n: number, d: number, source: RandomSource): boolean {
  while (n > d) {
    if (!bernoulliExpNegAtMostOne(1, 1, source)) return false;
    n -= d;
  }
  return bernoulliExpNegAtMostOne(n, d, source);
}

/** Positive ε as safe-integer s/t in lowest terms. */
function epsilonParts(epsilon: EpsilonInput): { s: number; t: number } {
  const r = toRational(epsilon);
  const s = Number(r.num);
  const t = Number(r.den);
  if (s <= 0) throw new RangeError('epsilon must be positive');
  if (!Number.isSafeInteger(s) || !Number.isSafeInteger(t)) throw new RangeError('epsilon too precise');
  return { s, t };
}

/** One draw from the discrete Laplace distribution with scale 1/ε (CKS Algorithm 2). */
export function sampleDiscreteLaplace(epsilon: EpsilonInput, source: RandomSource = secureSource): number {
  const { s, t } = epsilonParts(epsilon);
  for (;;) {
    const u = uniformBelow(t, source);
    if (!bernoulliExpNeg(u, t, source)) continue;
    let v = 0;
    while (bernoulliExpNeg(1, 1, source)) v++;
    const x = u + t * v;
    const y = (x - (x % s)) / s; // floor(x / s) without float rounding
    const negative = uniformInt(2, source) === 1;
    if (negative && y === 0) continue;
    return negative ? -y : y;
  }
}

/** count + discrete Laplace noise with scale 1/ε. */
export function addNoise(count: number, epsilon: EpsilonInput, source: RandomSource = secureSource): number {
  if (!Number.isSafeInteger(count)) throw new RangeError(`count must be an integer, got ${count}`);
  return count + sampleDiscreteLaplace(epsilon, source);
}
