import type { Scenario } from '../data/scenario';
import { format, toNumber } from '../dp';
import { LEDGER_PERIOD, checkBudget, pageLedger, useLedgerVersion } from './dpBudget';

/** Stage 4: the coordinator's privacy budget for the current querier. */
export function BudgetPanel({ scenario }: { scenario: Scenario }) {
  useLedgerVersion();
  const ledger = pageLedger();
  const querier = scenario.querier.institution;
  const remaining = ledger.remaining(querier.id, LEDGER_PERIOD);
  const budget = toNumber(ledger.periodBudget);
  const left = toNumber(remaining);
  const perScore = toNumber(ledger.scoreEpsilon);
  const next = checkBudget(scenario);
  const runs = ledger.history().filter((e) => e.querier === querier.id).length;

  return (
    <section className="panel budget-panel" data-testid="budget-panel" aria-labelledby="budget-heading">
      <header className="panel-header">
        <h3 id="budget-heading">Privacy budget</h3>
      </header>
      <p>
        Each score costs ε {format(ledger.scoreEpsilon)}. {querier.name} has ε{' '}
        <strong data-testid="budget-remaining">{format(remaining)}</strong> of {format(ledger.periodBudget)}{' '}
        left {LEDGER_PERIOD}, enough for {Math.floor(left / perScore).toLocaleString()} more scores.
      </p>
      <progress aria-label="Budget remaining" max={budget} value={left} />
      <p className="muted small">
        Each customer can be scored at most {Math.floor(toNumber(ledger.subjectCap) / perScore)} times
        (lifetime ε {format(ledger.subjectCap)}), so repeating a query to average out the noise is refused.{' '}
        {runs > 0 && `${runs} scored run${runs === 1 ? '' : 's'} so far.`}
      </p>
      <p className="small" data-testid="budget-next" data-ok={next.ok}>
        {next.ok
          ? `The next run costs ε ${format(next.total)}.`
          : `The next run would be refused: ${next.message}.`}
      </p>
    </section>
  );
}
