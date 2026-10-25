import type { Scenario } from '../data/scenario';
import type { QuerierResult } from '../protocol/screening';
import { TIER_LABELS, tierOf, type Tier } from '../dp/bounds';
import { compareResults, perHolder, truthCustomers, type CellVerdict } from './results';

/** Customers listed in the table; the counts always cover every row. */
export const RESULT_ROWS = 25;

export interface CompletedRun {
  scenario: Scenario;
  querier: QuerierResult;
  /** ε per score the run used (stage 4 only). */
  epsilon?: number;
  /** Holders the stage queried; results are checked against these only. */
  holders?: string[];
  /** Plain account of what just happened, from the run's own facts. */
  narrative?: string[];
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
      {run?.narrative && (
        <div className="what-happened" data-testid="what-happened">
          <h4>What just happened</h4>
          <ol>
            {run.narrative.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </div>
      )}
      {run?.querier.scores ? (
        <RiskResultsBody run={run} scores={run.querier.scores} />
      ) : run ? (
        <ResultsBody run={run} />
      ) : (
        <p className="muted empty">Run the protocol to see who gets flagged.</p>
      )}
    </section>
  );
}

function ResultsBody({ run }: { run: CompletedRun }) {
  const { scenario } = run;
  const cmp = compareResults(scenario, run.querier.flaggedBy, run.holders);
  const names = new Map(scenario.holders.map((h) => [h.institution.id, h.institution.name]));
  const customers = new Map(scenario.querier.records.map((r) => [r.rowId, `${r.firstName} ${r.lastName}`]));
  const flagged = Object.keys(run.querier.flaggedBy).length;
  const truth = truthCustomers(cmp);
  const pairs = cmp.correct + cmp.extra;
  const checked = cmp.holders.map((h) => names.get(h) ?? h);
  const skipped = scenario.holders.length - cmp.holders.length;
  const scope =
    checked.length === 1 ? checked[0]! : `any of the ${checked.length.toLocaleString()} institutions`;

  return (
    <>
      {skipped > 0 && (
        <p className="checked-scope small" data-testid="checked-scope">
          Checked against {checked.join(', ')} only. Two-party PSI queries one institution, so the other{' '}
          {skipped} in this preset are not consulted on this page.
        </p>
      )}
      <p data-testid="results-summary">
        <strong>{flagged.toLocaleString()}</strong> of {scenario.querier.records.length.toLocaleString()}{' '}
        customers are flagged by {scope} (ground truth: {truth.toLocaleString()}).
      </p>
      <h4 className="tally-heading">Checked per customer and institution</h4>
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
      <p className="muted small" data-testid="tally-explainer">
        Each (customer, institution) flag is checked against ground truth separately.
        {pairs !== flagged &&
          ` A customer flagged by two institutions counts twice, so ${flagged.toLocaleString()} customers make ${pairs.toLocaleString()} flags.`}
      </p>
      {cmp.holders.length > 1 && (
        <div className="table-scroll">
          <table className="results-table" data-testid="per-holder-breakdown">
            <caption className="small">Per institution</caption>
            <thead>
              <tr>
                <th scope="col">Institution</th>
                <th scope="col">Banlist entries</th>
                <th scope="col">Customers it flagged</th>
                <th scope="col">Correct</th>
                <th scope="col">Missed</th>
                <th scope="col">Extra</th>
              </tr>
            </thead>
            <tbody>
              {perHolder(cmp).map((t) => (
                <tr key={t.holder}>
                  <th scope="row">{names.get(t.holder) ?? t.holder}</th>
                  <td>
                    {(
                      scenario.holders.find((h) => h.institution.id === t.holder)?.records.length ?? 0
                    ).toLocaleString()}
                  </td>
                  <td>{t.flagged.toLocaleString()}</td>
                  <td>{t.correct}</td>
                  <td>{t.missed}</td>
                  <td>{t.extra}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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

const TIERS: readonly Tier[] = ['clear', 'review', 'high'];

/** Stage 4: noisy risk tiers, checked against the tier the exact count would give. */
function RiskResultsBody({
  run,
  scores,
}: {
  run: CompletedRun;
  scores: NonNullable<QuerierResult['scores']>;
}) {
  const { scenario } = run;
  const rows = scenario.querier.records.flatMap((r) => {
    const score = scores[r.rowId];
    if (!score) return [];
    const exact = scenario.truth.flaggedBy[r.rowId]?.length ?? 0;
    return [{ record: r, score, exact, exactTier: tierOf(exact) }];
  });
  const byTier = Object.fromEntries(TIERS.map((t) => [t, rows.filter((r) => r.score.tier === t).length]));
  const matching = rows.filter((r) => r.score.tier === r.exactTier).length;
  const interesting = rows.filter((r) => r.score.tier !== 'clear' || r.exact > 0);

  return (
    <>
      <p data-testid="results-summary">
        {rows.length.toLocaleString()} customers scored. No institution is named: each score is a noisy count
        of how many flagged the customer.
      </p>
      <dl className="tally" data-testid="risk-tally">
        {TIERS.map((t) => (
          <div key={t} className={`tier-${t}`}>
            <dt>{TIER_LABELS[t]}</dt>
            <dd>{byTier[t]}</dd>
          </div>
        ))}
      </dl>
      <p className="muted small" data-testid="risk-accuracy">
        Tier matches the exact count for {matching.toLocaleString()} of {rows.length.toLocaleString()}{' '}
        customers ({rows.length === 0 ? 0 : Math.round((100 * matching) / rows.length)}%), checked against
        ground truth.
      </p>
      {interesting.length > 0 && (
        <div className="table-scroll">
          <table className="results-table">
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Tier</th>
                <th scope="col">Noisy</th>
                <th scope="col">Exact</th>
              </tr>
            </thead>
            <tbody>
              {interesting.slice(0, RESULT_ROWS).map((r) => (
                <tr key={r.record.rowId}>
                  <th scope="row">
                    {r.record.firstName} {r.record.lastName}
                  </th>
                  <td className={`tier-${r.score.tier}`}>{TIER_LABELS[r.score.tier]}</td>
                  <td>{r.score.noisy}</td>
                  <td>{r.exact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {interesting.length > RESULT_ROWS && (
        <p className="muted small">
          and {(interesting.length - RESULT_ROWS).toLocaleString()} more customers
        </p>
      )}
    </>
  );
}
