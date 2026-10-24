import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BudgetLedger, DEFAULT_LEDGER_CONFIG, type SpendRequest } from './ledger';
import { compare, format, toRational, ZERO, type Rational } from './rational';

const isNonNegative = (r: Rational) => compare(r, ZERO) >= 0;

// Random query sequences with ε values that are all whole multiples of 1/60, so an integer
// reference model can say exactly what should fit.
const EPSILONS: [string, number][] = [
  ['0.1', 6],
  ['0.25', 15],
  ['1/3', 20],
  ['0.5', 30],
  ['1', 60],
];
const requestArb = fc.record({
  querier: fc.constantFrom('q1', 'q2'),
  period: fc.constantFrom('p1', 'p2'),
  subjects: fc.array(fc.constantFrom('a', 'b', 'c', 'd', 'e'), { maxLength: 6 }),
  epsilon: fc.constantFrom(...EPSILONS),
});
const PERIOD_UNITS = 180; // 3
const CAP_UNITS = 90; // 1.5

describe('dp/ledger', () => {
  it('never_negative', () => {
    fc.assert(
      fc.property(fc.array(requestArb, { maxLength: 40 }), (requests) => {
        const ledger = new BudgetLedger({ periodBudget: 3, subjectCap: 1.5 });
        for (const r of requests) {
          ledger.spend({ ...r, epsilon: r.epsilon[0] });
          for (const q of ['q1', 'q2'])
            for (const p of ['p1', 'p2']) expect(isNonNegative(ledger.remaining(q, p))).toBe(true);
          for (const s of 'abcde') expect(isNonNegative(ledger.subjectRemaining(s))).toBe(true);
        }
      }),
    );
  });

  it('refuses_overspend', () => {
    fc.assert(
      fc.property(fc.array(requestArb, { maxLength: 40 }), (requests) => {
        const ledger = new BudgetLedger({ periodBudget: 3, subjectCap: 1.5 });
        const periodUsed = new Map<string, number>();
        const subjectUsed = new Map<string, number>();
        for (const r of requests) {
          const [text, units] = r.epsilon;
          const key = `${r.querier}/${r.period}`;
          const fitsPeriod = (periodUsed.get(key) ?? 0) + units * r.subjects.length <= PERIOD_UNITS;
          const perSubject = new Map<string, number>();
          for (const s of r.subjects) perSubject.set(s, (perSubject.get(s) ?? 0) + units);
          const fitsCaps = [...perSubject].every(([s, u]) => (subjectUsed.get(s) ?? 0) + u <= CAP_UNITS);

          const decision = ledger.spend({ ...r, epsilon: text });
          expect(decision.ok).toBe(fitsPeriod && fitsCaps);
          if (!decision.ok) expect(decision.reason).toBe(fitsPeriod ? 'subject_cap' : 'period_budget');
          if (decision.ok) {
            periodUsed.set(key, (periodUsed.get(key) ?? 0) + units * r.subjects.length);
            for (const [s, u] of perSubject) subjectUsed.set(s, (subjectUsed.get(s) ?? 0) + u);
          }
        }
        for (const [key, used] of periodUsed) {
          const [q, p] = key.split('/') as [string, string];
          expect(format(ledger.remaining(q, p))).toBe(format(toRational(`${PERIOD_UNITS - used}/60`)));
        }
      }),
    );
  });

  it('per_customer_cap', () => {
    const ledger = new BudgetLedger();
    const cap = toRational(DEFAULT_LEDGER_CONFIG.subjectCap);
    const eps = toRational(DEFAULT_LEDGER_CONFIG.scoreEpsilon);
    const allowed = Number((cap.num * eps.den) / (cap.den * eps.num)); // cap / ε = 3
    expect(allowed).toBe(3);
    const screen = (period: string) => ledger.spend({ querier: 'exchange', period, subjects: ['alice'] });
    for (let i = 0; i < allowed; i++) expect(screen(`p${i}`).ok).toBe(true);
    const refused = screen('p-next');
    expect(refused).toMatchObject({ ok: false, reason: 'subject_cap', subjects: ['alice'] });
    // Another querier can't screen her either: the cap is per customer, not per querier.
    expect(ledger.spend({ querier: 'broker', period: 'p0', subjects: ['alice'] }).ok).toBe(false);
    expect(ledger.spend({ querier: 'exchange', period: 'p-next', subjects: ['bob'] }).ok).toBe(true);
  });

  it('batch_is_atomic', () => {
    const ledger = new BudgetLedger({ periodBudget: 2, subjectCap: 1, scoreEpsilon: 0.5 });
    expect(ledger.spend({ querier: 'q', period: 'p', subjects: ['a', 'a'] }).ok).toBe(true);
    const snapshot = () => ({
      period: format(ledger.remaining('q', 'p')),
      subjects: ['a', 'b', 'c'].map((s) => format(ledger.subjectRemaining(s))),
      history: ledger.history().length,
    });
    const before = snapshot();

    // 'a' is at its cap: the whole batch is refused, so 'b' is not charged either.
    const capped: SpendRequest = { querier: 'q', period: 'p', subjects: ['b', 'a'] };
    expect(ledger.canSpend(capped)).toMatchObject({ ok: false, reason: 'subject_cap', subjects: ['a'] });
    expect(ledger.spend(capped).ok).toBe(false);
    expect(snapshot()).toEqual(before);

    // Three more scores need 1.5 but only 1 is left in the period.
    const tooBig: SpendRequest = { querier: 'q', period: 'p', subjects: ['b', 'c', 'd'] };
    expect(ledger.spend(tooBig)).toMatchObject({ ok: false, reason: 'period_budget' });
    expect(snapshot()).toEqual(before);

    // Exactly filling the period is fine.
    expect(ledger.spend({ querier: 'q', period: 'p', subjects: ['b', 'c'] }).ok).toBe(true);
    expect(ledger.remaining('q', 'p')).toEqual(ZERO);
    expect(ledger.history().map((e) => e.subjects)).toEqual([
      ['a', 'a'],
      ['b', 'c'],
    ]);
  });

  it('exact_arithmetic', () => {
    // In floats 0.1 + 0.1 + 0.1 > 0.3 and ten 0.1s sum to 0.9999999999999999.
    const ledger = new BudgetLedger({ periodBudget: 1, subjectCap: 100, scoreEpsilon: 0.1 });
    for (let i = 0; i < 10; i++) {
      expect(ledger.spend({ querier: 'q', period: 'p', subjects: [`s${i}`] }).ok).toBe(true);
    }
    expect(ledger.remaining('q', 'p')).toEqual(ZERO);
    expect(ledger.spend({ querier: 'q', period: 'p', subjects: ['s10'] })).toMatchObject({
      ok: false,
      reason: 'period_budget',
    });

    const small = new BudgetLedger({ periodBudget: 0.3, subjectCap: 100, scoreEpsilon: 0.1 });
    for (const s of ['x', 'y', 'z'])
      expect(small.spend({ querier: 'q', period: 'p', subjects: [s] }).ok).toBe(true);
  });

  it('periods_are_independent', () => {
    const ledger = new BudgetLedger({ periodBudget: 1, subjectCap: 100 });
    expect(ledger.spend({ querier: 'q', period: '2026-10', subjects: ['a', 'b'] }).ok).toBe(true);
    expect(ledger.spend({ querier: 'q', period: '2026-10', subjects: ['c'] }).ok).toBe(false);
    expect(ledger.spend({ querier: 'q', period: '2026-11', subjects: ['c'] }).ok).toBe(true);
    expect(ledger.spend({ querier: 'other', period: '2026-10', subjects: ['c'] }).ok).toBe(true);
  });

  it('rejects_bad_epsilon', () => {
    expect(() => new BudgetLedger({ scoreEpsilon: 0 })).toThrow(RangeError);
    expect(() => new BudgetLedger({ periodBudget: -1 })).toThrow(RangeError);
    expect(() => new BudgetLedger({ subjectCap: Number.NaN })).toThrow(RangeError);
    expect(() =>
      new BudgetLedger().canSpend({ querier: 'q', period: 'p', subjects: ['a'], epsilon: '0' }),
    ).toThrow(RangeError);
  });
});
