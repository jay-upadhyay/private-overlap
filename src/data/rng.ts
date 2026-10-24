/**
 * Seeded PRNG for synthetic data. Generated datasets must be reproducible from a seed,
 * so this is deliberately not cryptographic. Secrets (scalars, DP noise) never use it.
 */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [0, max). */
  int(max: number): number;
  pick<T>(items: readonly T[]): T;
  /** Returns true with probability p. */
  chance(p: number): boolean;
}

/** mulberry32: small, fast, good enough statistical quality for test data. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (max: number) => Math.floor(next() * max);
  return {
    next,
    int,
    pick: (items) => {
      if (items.length === 0) throw new Error('pick from empty list');
      return items[int(items.length)]!;
    },
    chance: (p) => next() < p,
  };
}

/** In-place Fisher-Yates shuffle. */
export function shuffle<T>(rng: Rng, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

/** k distinct items, in random order. */
export function sample<T>(rng: Rng, items: readonly T[], k: number): T[] {
  if (k > items.length) throw new Error(`cannot sample ${k} of ${items.length}`);
  return shuffle(rng, [...items]).slice(0, k);
}
