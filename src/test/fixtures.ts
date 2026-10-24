// Test-only helpers. Nothing under src/test is imported by shipped code.
import type { RandomSource } from '../crypto/random';
import { createRng } from '../data/rng';
import { buildScenario, type Scenario } from '../data/scenario';

/** Deterministic stand-in for the CSPRNG, for reproducible statistical tests. */
export function seededSource(seed: number): RandomSource {
  const rng = createRng(seed);
  return { fill: (bytes) => bytes.forEach((_, i) => (bytes[i] = rng.int(256))) };
}

export interface SmallScenarioOptions {
  seed?: number;
  customers?: number;
  holders?: number;
  banlistSize?: number;
  /** Fraction flagged by exactly k holders, k = 1..holders. Default: 10% by one holder. */
  flaggedByCount?: number[];
}

/** A fast scenario for unit tests: 200 customers, one holder, banlists of max(100, customers/2). */
export function smallScenario(options: SmallScenarioOptions = {}): Scenario {
  const holders = options.holders ?? 1;
  const customers = options.customers ?? 200;
  return buildScenario({
    seed: options.seed ?? 1,
    querier: { id: 'q', name: 'Test Querier', kind: 'exchange', customers },
    holders: Array.from({ length: holders }, (_, i) => ({
      id: `h${i + 1}`,
      name: `Test Holder ${i + 1}`,
      kind: 'broker' as const,
      banlistSize: options.banlistSize ?? Math.max(100, Math.ceil(customers / 2)),
    })),
    flaggedByCount: options.flaggedByCount ?? [0.1],
  });
}
