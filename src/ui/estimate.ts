import type { Scenario } from '../data/scenario';
import { format } from '../dp';
import type { StageId } from '../stages';
import { checkBudget, LEDGER_PERIOD, pageLedger } from './dpBudget';

// Rough run-time estimate shown before a run, so the reviewer sees the cost of a size first.
//
// Each PSI-style stage is dominated by elliptic-curve work: one hash-to-group plus scalar
// multiplications per point, about 1 ms each. Parties run in separate workers, so the time is the
// work on the slowest chain: the querier blinds, the holders re-blind in parallel, then the querier
// (or the coordinator) finishes. Calibrated on measured runs at 1,000 customers: two-party PSI
// 1.6 s, the four-holder consortium 2.5 s, stage 4 about 4 s.

const MS_PER_POINT_OP = 0.6;
/** Plaintext and hashing: microseconds per value; this covers the worker startup too. */
const MS_FIXED = 300;
const MS_PER_HASHED_VALUE = 0.01;

export function estimateRunMs(stage: StageId, scenario: Scenario): number {
  const n = scenario.querier.records.length;
  const banlists = scenario.holders.map((h) => h.records.length);
  const totalBanned = banlists.reduce((a, b) => a + b, 0);
  const slowestHolder = Math.max(...banlists.map((m) => n + m));
  switch (stage) {
    case 'plaintext':
    case 'hashing':
      return MS_FIXED + (n + totalBanned) * MS_PER_HASHED_VALUE;
    case 'psi': {
      const m = banlists[0] ?? 0;
      // Querier blinds n, holder re-blinds n and blinds m, querier finishes m.
      return MS_FIXED + (2 * n + 2 * m) * MS_PER_POINT_OP;
    }
    case 'multi-psi':
    case 'dp-risk':
      // Querier blinds n per holder, the slowest holder works in parallel, then m per holder.
      return MS_FIXED + (n * banlists.length + slowestHolder + totalBanned) * MS_PER_POINT_OP;
  }
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return 'under a second';
  const s = ms / 1000;
  if (s < 60) return `about ${s < 10 ? Math.round(s * 2) / 2 : Math.round(s)} s`;
  return `about ${Math.round(s / 6) / 10} min`;
}

/** The line under the scenario bar: time, and on stage 4 the ε cost against what is left. */
export function runEstimate(stage: StageId, scenario: Scenario, epsilon: number): string {
  const time = `Estimated run time: ${formatDuration(estimateRunMs(stage, scenario))}.`;
  if (stage !== 'dp-risk') return time;
  const decision = checkBudget(scenario, epsilon);
  const remaining = format(pageLedger().remaining(scenario.querier.institution.id, LEDGER_PERIOD));
  if (decision.ok) return `${time} Costs ε ${format(decision.total)} of the ε ${remaining} left.`;
  return `${time} Over budget: the run would be refused (${decision.reason === 'subject_cap' ? 'customers already scored too often' : `needs more than the ε ${remaining} left`}).`;
}
