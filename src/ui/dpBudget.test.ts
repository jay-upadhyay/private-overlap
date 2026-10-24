import { afterEach, describe, expect, it } from 'vitest';
import { buildPreset } from '../data/presets';
import { format } from '../dp';
import {
  chargeBudget,
  checkBudget,
  epsilonText,
  LEDGER_PERIOD,
  pageLedger,
  resetLedgerForTests,
} from './dpBudget';

afterEach(resetLedgerForTests);

describe('page privacy budget', () => {
  const small = buildPreset('consortium', undefined, 1000);

  it('full_size_run_is_refused_by_period_budget', () => {
    const decision = checkBudget(buildPreset('consortium'), 0.5);
    expect(decision.ok).toBe(false);
    expect(!decision.ok && decision.reason).toBe('period_budget');
  });

  it('small_run_costs_half_epsilon_per_customer', () => {
    const decision = chargeBudget(small, 0.5);
    expect(decision.ok && format(decision.total)).toBe('500');
    expect(format(pageLedger().remaining('northwind', LEDGER_PERIOD))).toBe('1500');
  });

  it('fourth_rescreen_hits_customer_cap', () => {
    for (let i = 0; i < 3; i++) expect(chargeBudget(small, 0.5).ok).toBe(true);
    const fourth = checkBudget(small, 0.5);
    expect(fourth.ok).toBe(false);
    expect(!fourth.ok && fourth.reason).toBe('subject_cap');
  });

  it('epsilon_sets_the_cost', () => {
    const decision = checkBudget(small, 0.1);
    expect(decision.ok && format(decision.total)).toBe('100');
    expect(epsilonText(0.1)).toBe('0.1');
    expect(epsilonText(1)).toBe('1');
  });

  it('different_seed_is_a_different_customer_set', () => {
    for (let i = 0; i < 3; i++) chargeBudget(small, 0.5);
    expect(checkBudget(buildPreset('consortium', 7, 1000), 0.5).ok).toBe(true);
  });
});
