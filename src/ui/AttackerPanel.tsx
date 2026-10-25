import type { AttackOutcome } from '../stages';
import type { ExplainerBreak } from './explainers/types';
import { formatPercent } from './format';
import type { RunStatus } from './useStageRun';

/** Recovered items listed; the score covers all of them. */
const EXAMPLES = 5;

interface AttackerPanelProps {
  breaks: ExplainerBreak;
  status: RunStatus;
  outcome: AttackOutcome | null;
  error: string | null;
  /** False while this stage's attack demo is not built (see BACKLOG.md). */
  available: boolean;
  onRunAttack(): void;
}

export function AttackerPanel({
  breaks,
  status,
  outcome,
  error,
  available,
  onRunAttack,
}: AttackerPanelProps) {
  return (
    <section className="panel attacker-panel" data-testid="attacker-panel" aria-labelledby="attacker-heading">
      <header className="panel-header">
        <h3 id="attacker-heading">What the attacker recovered</h3>
      </header>
      {breaks.kind === 'out-of-scope' ? (
        <p className="muted" data-testid="attack-out-of-scope">
          Out of scope. This stage stops the attacks from earlier stages; see the explainer for what it does
          not cover.
        </p>
      ) : !available ? (
        <>
          <p>
            <strong>{breaks.name}.</strong> {breaks.how}
          </p>
          <p className="muted small" data-testid="attack-not-built">
            The live demo of this attack is not built yet.
          </p>
        </>
      ) : (
        <>
          <p>
            <strong>{breaks.name}.</strong> {breaks.how}
          </p>
          <button
            type="button"
            className="button"
            data-testid="run-attack"
            onClick={onRunAttack}
            disabled={status === 'running'}
          >
            Run attack
          </button>
          <p role="status" className="muted small" data-testid="attack-status" data-status={status}>
            {status === 'running' && 'Attacking…'}
            {status === 'error' && `Attack failed. ${error ?? ''}`}
            {status === 'cancelled' && 'Attack cancelled.'}
          </p>
          {outcome && <AttackScore outcome={outcome} />}
        </>
      )}
    </section>
  );
}

function AttackScore({ outcome }: { outcome: AttackOutcome }) {
  const { score } = outcome;
  const total = score.truePositives + score.missed;
  const claimed = score.truePositives + score.falsePositives;
  return (
    <div data-testid="attack-score">
      <p>
        Target: <strong>{outcome.target}</strong>
      </p>
      <p data-testid="attack-summary">
        {score.truePositives === 0
          ? `The attack recovered nothing: none of the ${total.toLocaleString()} entries in the target were exposed.`
          : `The attack recovered ${score.truePositives.toLocaleString()} of the ${total.toLocaleString()} entries in the target (${formatPercent(score.recall)}). ${
              score.falsePositives === 0
                ? 'Every one it claimed was right.'
                : `${score.falsePositives.toLocaleString()} of its ${claimed.toLocaleString()} claims were wrong.`
            } ${score.recall >= 0.5 ? 'The defence of this stage does not hold against it.' : 'Most of the target stayed hidden.'}`}
      </p>
      <dl className="tally">
        <div>
          <dt>Recall</dt>
          <dd>{formatPercent(score.recall)}</dd>
        </div>
        <div>
          <dt>Precision</dt>
          <dd>{formatPercent(score.precision)}</dd>
        </div>
      </dl>
      <p className="muted small">
        {score.truePositives.toLocaleString()} recovered, {score.missed.toLocaleString()} missed,{' '}
        {score.falsePositives.toLocaleString()} wrong guesses.
      </p>
      {outcome.examples.length > 0 && (
        <ul className="attack-examples" aria-label="Recovered examples">
          {outcome.examples.slice(0, EXAMPLES).map((x) => (
            <li key={x}>
              <code>{x}</code>
            </li>
          ))}
        </ul>
      )}
      {outcome.note && <p className="muted small">{outcome.note}</p>}
    </div>
  );
}
