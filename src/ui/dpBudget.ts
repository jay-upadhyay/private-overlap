import { useSyncExternalStore } from 'react';
import type { Scenario } from '../data/scenario';
import { BudgetLedger, type SpendDecision } from '../dp';

// The coordinator's privacy-budget ledger. A real coordinator would persist it; here it lives
// for the page session, so reloading the page starts a new period.

export const LEDGER_PERIOD = 'this session';

/**
 * ε 2,000 for the session: three small consortium runs fit (1,000 scores at ε 0.5 each), the
 * fourth hits the per-customer cap, and a full-size run (10,000 scores, ε 5,000) is refused
 * outright. Both limits are visible within a few clicks.
 */
export const PAGE_PERIOD_BUDGET = 2000;

const freshLedger = () => new BudgetLedger({ periodBudget: PAGE_PERIOD_BUDGET });

let ledger = freshLedger();

export function pageLedger(): BudgetLedger {
  return ledger;
}

let version = 0;
const listeners = new Set<() => void>();

function changed() {
  version++;
  for (const l of listeners) l();
}

/** Re-renders when the ledger changes. */
export function useLedgerVersion(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
  );
}

/**
 * Ledger keys for the scenario's customers. Row ids repeat across seeds and sizes, so the key
 * includes both. Keys come from the querier, which only works for an honest querier (FUTURE_WORK.md).
 */
export function customerKeys(scenario: Scenario): string[] {
  const tag = `${scenario.config.seed}/${scenario.config.querier.customers}`;
  return scenario.querier.records.map((r) => `${tag}/${r.rowId}`);
}

/** ε as a decimal string, so the ledger converts it exactly (0.1 is not exact as a float). */
export const epsilonText = (epsilon: number) => epsilon.toFixed(2).replace(/\.?0+$/, '');

export function checkBudget(scenario: Scenario, epsilon: number): SpendDecision {
  return ledger.canSpend({
    querier: scenario.querier.institution.id,
    period: LEDGER_PERIOD,
    subjects: customerKeys(scenario),
    epsilon: epsilonText(epsilon),
  });
}

export function chargeBudget(scenario: Scenario, epsilon: number): SpendDecision {
  const decision = ledger.spend({
    querier: scenario.querier.institution.id,
    period: LEDGER_PERIOD,
    subjects: customerKeys(scenario),
    epsilon: epsilonText(epsilon),
  });
  changed();
  return decision;
}

/** Test only: a fresh ledger state between tests. */
export function resetLedgerForTests(): void {
  ledger = freshLedger();
  changed();
}
