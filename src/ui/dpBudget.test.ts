import { afterEach, describe, expect, it } from 'vitest';
import { buildPreset } from '../data/presets';
import { format } from '../dp';
import { chargeBudget, checkBudget, LEDGER_PERIOD, pageLedger, resetLedgerForTests } from './dpBudget';

afterEach(resetLedgerForTests);

describe('page privacy budget', () => {
  const small = buildPreset('consortium', undefined, 'small');

  it('full_size_run_is_refused_by_period_budget', () => {
    const decision = checkBudget(buildPreset('consortium'));
    expect(decision.ok).toBe(false);
    expect(!decision.ok && decision.reason).toBe('period_budget');
  });

  it('small_run_costs_half_epsilon_per_customer', () => {
    const decision = chargeBudget(small);
    expect(decision.ok && format(decision.total)).toBe('500');
    expect(format(pageLedger().remaining('northwind', LEDGER_PERIOD))).toBe('1500');
  });

  it('fourth_rescreen_hits_customer_cap', () => {
    for (let i = 0; i < 3; i++) expect(chargeBudget(small).ok).toBe(true);
    const fourth = checkBudget(small);
    expect(fourth.ok).toBe(false);
    expect(!fourth.ok && fourth.reason).toBe('subject_cap');
  });

  it('different_seed_is_a_different_customer_set', () => {
    for (let i = 0; i < 3; i++) chargeBudget(small);
    expect(checkBudget(buildPreset('consortium', 7, 'small')).ok).toBe(true);
  });
});
