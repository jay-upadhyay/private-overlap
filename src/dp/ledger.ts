// Privacy budget ledger for stage 4 risk scores.
//
// Two limits, checked on every batch:
// - Period budget, per querier and period: the total ε a querier may spend on scores in one
//   period. Each score costs its ε, so this caps how many customers can be screened (fishing).
// - Lifetime cap, per subject (customer key), across all queriers and periods: the total ε ever
//   spent on one customer. Re-screening the same person and averaging the noisy answers is the
//   way to strip DP noise, so this is what stops averaging attacks.
//
// All amounts are exact rationals (see rational.ts). The ledger has no clock: the caller names
// the period ("2026-10", "week-43", …) on every call, and a new period name starts a fresh
// budget. Subject caps never reset.

import {
  add,
  compare,
  format,
  scale,
  sub,
  toRational,
  ZERO,
  type EpsilonInput,
  type Rational,
} from './rational';

/** ε charged for one released score. */
export const DEFAULT_SCORE_EPSILON = 0.5;
/** ε per querier per period: 1,000 scores at the default per-score ε. */
export const DEFAULT_PERIOD_BUDGET = 500;
/**
 * Lifetime ε per customer: 3 scores at the default ε, so the 4th re-screen is refused. Total
 * leakage then stays at ε = 1.5, where no attacker can guess membership with better than about
 * 82% accuracy (membershipAccuracyBound(1.5)), however they combine the three answers.
 */
export const DEFAULT_SUBJECT_CAP = 1.5;

export interface LedgerConfig {
  periodBudget: EpsilonInput;
  subjectCap: EpsilonInput;
  /** ε per score when a spend request doesn't name one. */
  scoreEpsilon: EpsilonInput;
}

export const DEFAULT_LEDGER_CONFIG: Readonly<LedgerConfig> = {
  periodBudget: DEFAULT_PERIOD_BUDGET,
  subjectCap: DEFAULT_SUBJECT_CAP,
  scoreEpsilon: DEFAULT_SCORE_EPSILON,
};

export interface SpendRequest {
  querier: string;
  period: string;
  /** One entry per score. A subject listed twice is charged twice. */
  subjects: readonly string[];
  /** ε per score; defaults to the ledger's scoreEpsilon. */
  epsilon?: EpsilonInput;
}

export type SpendDecision =
  | { ok: true; epsilonPerScore: Rational; total: Rational }
  | {
      ok: false;
      reason: 'period_budget';
      message: string;
      needed: Rational;
      remaining: Rational;
    }
  | {
      ok: false;
      reason: 'subject_cap';
      message: string;
      /** Every subject in the batch that would exceed its lifetime cap. */
      subjects: string[];
    };

export interface LedgerEntry {
  /** 1-based order of the spend; stands in for a timestamp. */
  seq: number;
  querier: string;
  period: string;
  subjects: readonly string[];
  epsilonPerScore: Rational;
  total: Rational;
}

export class BudgetLedger {
  readonly periodBudget: Rational;
  readonly subjectCap: Rational;
  readonly scoreEpsilon: Rational;
  private readonly periodSpent = new Map<string, Rational>();
  private readonly subjectSpent = new Map<string, Rational>();
  private readonly entries: LedgerEntry[] = [];

  constructor(config: Partial<LedgerConfig> = {}) {
    const full = { ...DEFAULT_LEDGER_CONFIG, ...config };
    this.periodBudget = toRational(full.periodBudget);
    this.subjectCap = toRational(full.subjectCap);
    this.scoreEpsilon = positive(toRational(full.scoreEpsilon));
  }

  /** ε the querier can still spend in this period. */
  remaining(querier: string, period: string): Rational {
    return sub(this.periodBudget, this.periodSpent.get(periodKey(querier, period)) ?? ZERO);
  }

  /** ε that can still be spent on this subject, ever. */
  subjectRemaining(subject: string): Rational {
    return sub(this.subjectCap, this.subjectSpent.get(subject) ?? ZERO);
  }

  /** Spends so far, oldest first. Refused requests are not recorded. */
  history(): readonly LedgerEntry[] {
    return this.entries;
  }

  /**
   * Would this batch fit? The period budget is checked first, then every subject's cap; the
   * decision names the first limit that fails.
   */
  canSpend(request: SpendRequest): SpendDecision {
    const epsilonPerScore = positive(
      request.epsilon === undefined ? this.scoreEpsilon : toRational(request.epsilon),
    );
    const total = scale(epsilonPerScore, request.subjects.length);
    const remaining = this.remaining(request.querier, request.period);
    if (compare(total, remaining) > 0) {
      return {
        ok: false,
        reason: 'period_budget',
        message: `${request.querier} needs ε ${format(total)} for ${request.subjects.length} scores but has ε ${format(remaining)} left in ${request.period}`,
        needed: total,
        remaining,
      };
    }
    const overCap = [...countSubjects(request.subjects)]
      .filter(([subject, n]) => compare(scale(epsilonPerScore, n), this.subjectRemaining(subject)) > 0)
      .map(([subject]) => subject);
    if (overCap.length > 0) {
      return {
        ok: false,
        reason: 'subject_cap',
        message: `${overCap.length} customer(s) would pass the lifetime cap of ε ${format(this.subjectCap)}`,
        subjects: overCap,
      };
    }
    return { ok: true, epsilonPerScore, total };
  }

  /** Charge the whole batch, or nothing: a refused batch leaves the ledger unchanged. */
  spend(request: SpendRequest): SpendDecision {
    const decision = this.canSpend(request);
    if (!decision.ok || request.subjects.length === 0) return decision;
    const key = periodKey(request.querier, request.period);
    this.periodSpent.set(key, add(this.periodSpent.get(key) ?? ZERO, decision.total));
    for (const [subject, n] of countSubjects(request.subjects)) {
      const charge = scale(decision.epsilonPerScore, n);
      this.subjectSpent.set(subject, add(this.subjectSpent.get(subject) ?? ZERO, charge));
    }
    this.entries.push({
      seq: this.entries.length + 1,
      querier: request.querier,
      period: request.period,
      subjects: [...request.subjects],
      epsilonPerScore: decision.epsilonPerScore,
      total: decision.total,
    });
    return decision;
  }
}

function positive(r: Rational): Rational {
  if (r.num === 0n) throw new RangeError('epsilon per score must be positive');
  return r;
}

function periodKey(querier: string, period: string): string {
  return JSON.stringify([querier, period]);
}

function countSubjects(subjects: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const s of subjects) counts.set(s, (counts.get(s) ?? 0) + 1);
  return counts;
}
