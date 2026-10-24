// Randomness for protocol secrets and orderings. Always the platform CSPRNG, never the
// seeded data RNG in src/data/rng.ts.

/** Uniform integer in [0, max) without modulo bias. */
export function secureInt(max: number): number {
  if (!Number.isInteger(max) || max < 1 || max > 2 ** 32) throw new Error(`bad bound ${max}`);
  const limit = 2 ** 32 - (2 ** 32 % max);
  const word = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(word);
    if (word[0]! < limit) return word[0]! % max;
  }
}

/** A uniformly random permutation of 0..n-1 (Fisher–Yates). */
export function securePermutation(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = secureInt(i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}
