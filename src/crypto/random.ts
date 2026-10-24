// Secret randomness for every stage: PSI scalars, shuffles, DP noise.
// Shipped code always uses the OS CSPRNG. Tests may pass a seeded source
// (see src/test/fixtures.ts) so statistical tests are reproducible.

export interface RandomSource {
  fill(bytes: Uint8Array): void;
}

const MAX_GET_RANDOM_VALUES = 65536;

export const secureSource: RandomSource = {
  fill(bytes) {
    for (let i = 0; i < bytes.length; i += MAX_GET_RANDOM_VALUES) {
      crypto.getRandomValues(bytes.subarray(i, i + MAX_GET_RANDOM_VALUES) as Uint8Array<ArrayBuffer>);
    }
  },
};

export function randomBytes(length: number, source: RandomSource = secureSource): Uint8Array {
  const bytes = new Uint8Array(length);
  source.fill(bytes);
  return bytes;
}

/** Uniform 32-bit unsigned integer. */
export function randomUint32(source: RandomSource = secureSource): number {
  const b = randomBytes(4, source);
  return (b[0]! | (b[1]! << 8) | (b[2]! << 16) | (b[3]! << 24)) >>> 0;
}

/** Uniform integer in [0, max), without modulo bias. max must be in [1, 2^32]. */
export function uniformInt(max: number, source: RandomSource = secureSource): number {
  if (!Number.isInteger(max) || max < 1 || max > 2 ** 32) throw new RangeError(`bad max ${max}`);
  const limit = 2 ** 32 - (2 ** 32 % max);
  for (;;) {
    const x = randomUint32(source);
    if (x < limit) return x % max;
  }
}

/** In-place Fisher-Yates shuffle with secret randomness. */
export function secureShuffle<T>(items: T[], source: RandomSource = secureSource): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = uniformInt(i + 1, source);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}
