import type { Scenario } from '../data/scenario';
import { tierOf } from '../dp/bounds';
import { expectedQuerierResult, type QuerierResult } from '../protocol/screening';
import type { PartyId } from '../protocol/types';

export type CellVerdict = 'correct' | 'missed' | 'extra';

export interface ResultRow {
  rowId: string;
  /** Holder id -> verdict, only for holders that flag the row in the result, the truth, or both. */
  cells: Partial<Record<PartyId, CellVerdict>>;
}

export interface ResultComparison {
  holders: PartyId[];
  /** Rows the querier learned or should have learned, in the querier's record order. */
  rows: ResultRow[];
  /** Counts over (customer, holder) pairs. */
  correct: number;
  missed: number;
  extra: number;
}

/** Checks what the querier learned against ground truth, per customer and holder. */
export function compareResults(scenario: Scenario, flaggedBy: QuerierResult['flaggedBy']): ResultComparison {
  const holders = scenario.holders.map((h) => h.institution.id);
  const expected = expectedQuerierResult(scenario);
  const totals = { correct: 0, missed: 0, extra: 0 };
  const rows: ResultRow[] = [];
  for (const { rowId } of scenario.querier.records) {
    const got = new Set(flaggedBy[rowId] ?? []);
    const want = new Set(expected[rowId] ?? []);
    if (got.size === 0 && want.size === 0) continue;
    const cells: ResultRow['cells'] = {};
    for (const h of holders) {
      const verdict: CellVerdict | null =
        got.has(h) && want.has(h) ? 'correct' : want.has(h) ? 'missed' : got.has(h) ? 'extra' : null;
      if (verdict) {
        cells[h] = verdict;
        totals[verdict]++;
      }
    }
    rows.push({ rowId, cells });
  }
  return { holders, rows, ...totals };
}

/** Stage 4: share of scored customers whose released tier equals the tier of their exact count. */
export function tierMatchRate(scenario: Scenario, scores: NonNullable<QuerierResult['scores']>): number {
  let scored = 0;
  let matching = 0;
  for (const { rowId } of scenario.querier.records) {
    const score = scores[rowId];
    if (!score) continue;
    scored++;
    if (score.tier === tierOf(scenario.truth.flaggedBy[rowId]?.length ?? 0)) matching++;
  }
  return scored === 0 ? 0 : matching / scored;
}
