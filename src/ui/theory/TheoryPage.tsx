import { formatRoute } from '../../routing';
import type { StageDefinition } from '../../stages';
import { THEORY } from '.';

/** The theory behind one stage: the math, a worked example computed live, and references. */
export function TheoryPage({ stage }: { stage: StageDefinition }) {
  const { oneLine, Body, references } = THEORY[stage.id];
  return (
    <main className="stage-page theory-page" data-testid={`theory-${stage.id}`}>
      <p className="small">
        <a href={formatRoute({ kind: 'stage', stage: stage.id })} data-testid="theory-to-stage">
          ← Back to the stage {stage.number} demo
        </a>
      </p>
      <h2>
        Stage {stage.number}: {stage.title}, the theory
      </h2>
      <p className="theory-one-line">{oneLine}</p>
      <Body />
      <h3>References</h3>
      <ol className="references" data-testid="references">
        {references.map((r) => (
          <li key={r.url}>
            {r.who.replace(/\.$/, '')}.{' '}
            <a href={r.url} target="_blank" rel="noreferrer">
              {r.title}
            </a>
            . {r.where}. <span className="muted">{r.why}</span>
          </li>
        ))}
      </ol>
    </main>
  );
}
