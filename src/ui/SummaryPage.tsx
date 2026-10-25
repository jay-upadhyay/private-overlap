import { formatRoute } from '../routing';
import { STAGES } from '../stages';
import { formatBytes, formatPercent } from './format';
import { REVEALS } from './reveals';
import { useSession } from './session';

/** "What each stage reveals", with your own runs filled in beside the design. */
export function SummaryPage() {
  const { runs } = useSession();
  const ran = STAGES.filter((s) => runs[s.id]).length;
  return (
    <main className="stage-page summary-page" data-testid="summary">
      <h2>What each stage reveals</h2>
      <p>
        The left column is what each technique lets the querier learn by design. The rest comes from your own
        runs in this session ({ran} of {STAGES.length} stages run so far), checked against ground truth.
      </p>
      <div className="table-scroll">
        <table className="results-table summary-table">
          <thead>
            <tr>
              <th scope="col">Stage</th>
              <th scope="col">The querier learns</th>
              <th scope="col">Your run</th>
              <th scope="col">Result vs truth</th>
              <th scope="col">On the wire</th>
              <th scope="col">Attack</th>
            </tr>
          </thead>
          <tbody>
            {STAGES.map((s) => {
              const r = runs[s.id];
              const stageLink = formatRoute({ kind: 'stage', stage: s.id });
              return (
                <tr key={s.id} data-testid={`summary-${s.id}`}>
                  <th scope="row">
                    <a href={stageLink}>
                      {s.number}. {s.title}
                    </a>
                  </th>
                  <td>{REVEALS[s.id]}</td>
                  {r ? (
                    <>
                      <td>
                        {r.presetTitle}, {r.customers.toLocaleString()} customers, {r.field}
                      </td>
                      <td>
                        {r.exact
                          ? `${r.exact.correct.toLocaleString()} correct, ${r.exact.missed} missed, ${r.exact.extra} extra`
                          : r.tiers
                            ? `${formatPercent(r.tiers.accuracy)} of tiers exact at ε ${r.tiers.epsilon}`
                            : ''}
                      </td>
                      <td>
                        {r.messages} messages, {formatBytes(r.bytes)}
                        {r.plaintextOnWire ? '; identifiers readable' : '; no readable identifiers'}
                      </td>
                      <td>
                        {r.attack
                          ? `${formatPercent(r.attack.recall)} of ${r.attack.target}`
                          : s.explainer.breaks.kind === 'attack'
                            ? 'Not run'
                            : 'Out of scope'}
                      </td>
                    </>
                  ) : (
                    <td colSpan={4} className="muted">
                      Not run yet. <a href={stageLink}>Run stage {s.number}</a>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
