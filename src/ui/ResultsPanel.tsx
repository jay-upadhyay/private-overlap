import type { Scenario } from '../data/scenario';
import type { QuerierResult } from '../protocol/screening';
import { compareResults, type CellVerdict } from './results';

/** Customers listed in the table; the counts always cover every row. */
export const RESULT_ROWS = 25;

export interface CompletedRun {
  scenario: Scenario;
  querier: QuerierResult;
}

const VERDICT_TEXT: Record<CellVerdict, string> = { correct: '✓', missed: 'missed', extra: 'extra' };

/** "Copperline Exchange" -> "Copperline", so several holder columns fit beside the attacker panel. */
const shortName = (name: string) => name.split(' ')[0] ?? name;

export function ResultsPanel({ run }: { run: CompletedRun | null }) {
  return (
    <section className="panel results-panel" data-testid="results-panel" aria-labelledby="results-heading">
      <header className="panel-header">
        <h3 id="results-heading">What the querier learned</h3>
      </header>
      {run ? (
        <ResultsBody run={run} />
      ) : (
        <p className="muted empty">Run the protocol to see who gets flagged.</p>
      )}
    </section>
  );
}

function ResultsBody({ run }: { run: CompletedRun }) {
  const { scenario } = run;
  const cmp = compareResults(scenario, run.querier.flaggedBy);
  const names = new Map(scenario.holders.map((h) => [h.institution.id, h.institution.name]));
  const customers = new Map(scenario.querier.records.map((r) => [r.rowId, `${r.firstName} ${r.lastName}`]));
  const flagged = Object.keys(run.querier.flaggedBy).length;

  return (
    <>
      <p data-testid="results-summary">
        {flagged.toLocaleString()} of {scenario.querier.records.length.toLocaleString()} customers flagged.
      </p>
      <dl className="tally" data-testid="results-tally">
        <div className="tally-correct">
          <dt>Correct</dt>
          <dd>{cmp.correct}</dd>
        </div>
        <div className="tally-missed">
          <dt>Missed</dt>
          <dd>{cmp.missed}</dd>
        </div>
        <div className="tally-extra">
          <dt>Extra</dt>
          <dd>{cmp.extra}</dd>
        </div>
      </dl>
      <p className="muted small">Checked against ground truth, per customer and institution.</p>
      {cmp.rows.length > 0 && (
        <div className="table-scroll">
          <table className="results-table">
            <thead>
              <tr>
                <th scope="col">Customer</th>
                {cmp.holders.map((h) => (
                  <th scope="col" key={h} title={names.get(h) ?? h}>
                    {shortName(names.get(h) ?? h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cmp.rows.slice(0, RESULT_ROWS).map((row) => (
                <tr key={row.rowId}>
                  <th scope="row">{customers.get(row.rowId) ?? row.rowId}</th>
                  {cmp.holders.map((h) => {
                    const verdict = row.cells[h];
                    return (
                      <td key={h} className={verdict ? `verdict-${verdict}` : undefined} aria-label={verdict}>
                        {verdict ? VERDICT_TEXT[verdict] : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {cmp.rows.length > RESULT_ROWS && (
        <p className="muted small">and {(cmp.rows.length - RESULT_ROWS).toLocaleString()} more customers</p>
      )}
    </>
  );
}
