import type { Scenario } from '../data/scenario';
import { tierAccuracy } from '../dp/bounds';

// The math behind the stage 4 ε chart.

export const EPSILON_MIN = 0.1;
export const EPSILON_MAX = 2;
export const EPSILON_STEP = 0.1;

export const GRID = Array.from({ length: 39 }, (_, i) => Math.round((EPSILON_MIN + i * 0.05) * 100) / 100);
export const TABLE_EPSILONS = [0.1, 0.25, 0.5, 1, 1.5, 2];

/** Share of customers with each exact flag count 0..holders. */
export function flagCountMix(scenario: Scenario): number[] {
  const n = scenario.querier.records.length;
  const mix = new Array<number>(scenario.holders.length + 1).fill(0);
  for (const r of scenario.querier.records) mix[scenario.truth.flaggedBy[r.rowId]?.length ?? 0]!++;
  return mix.map((c) => c / n);
}

export function expectedTierAccuracy(mix: readonly number[], epsilon: number): number {
  return mix.reduce((sum, share, k) => sum + (share > 0 ? share * tierAccuracy(k, epsilon) : 0), 0);
}
