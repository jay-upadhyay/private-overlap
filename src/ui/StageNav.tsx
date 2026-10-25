import { getPreset } from '../data/presets';
import { formatRoute } from '../routing';
import { STAGES, type StageDefinition } from '../stages';
import { endWalkthrough, useSession } from './session';

/** Shown at the top of a stage page while the guided walkthrough runs. */
export function WalkthroughBanner({ stage }: { stage: StageDefinition }) {
  const { walkthrough } = useSession();
  if (!walkthrough) return null;
  return (
    <div className="walkthrough-banner" data-testid="walkthrough-banner" role="note">
      <span>
        Guided walkthrough · stage {stage.number + 1} of {STAGES.length} · same scenario throughout:{' '}
        {getPreset(walkthrough.presetId).title}, {Number(walkthrough.customers).toLocaleString()} customers,
        seed {walkthrough.seed}, {walkthrough.field}
      </span>
      <button type="button" className="button" onClick={endWalkthrough} data-testid="exit-walkthrough">
        Exit walkthrough
      </button>
    </div>
  );
}

/** Bottom of every stage page: the theory, and the way on. */
export function StageFooter({ stage }: { stage: StageDefinition }) {
  const { walkthrough } = useSession();
  const index = STAGES.findIndex((s) => s.id === stage.id);
  const prev = STAGES[index - 1];
  const next = STAGES[index + 1];
  return (
    <nav className="stage-footer" aria-label="Stage navigation" data-testid="stage-footer">
      {prev ? (
        <a href={formatRoute({ kind: 'stage', stage: prev.id })}>
          ← Stage {prev.number}: {prev.title}
        </a>
      ) : (
        <a href={formatRoute({ kind: 'home' })}>← Home</a>
      )}
      <a href={formatRoute({ kind: 'theory', stage: stage.id })} data-testid="footer-theory">
        The theory behind stage {stage.number}
      </a>
      {next ? (
        <a href={formatRoute({ kind: 'stage', stage: next.id })} data-testid="next-stage" className="next">
          {walkthrough ? 'Next: ' : ''}Stage {next.number}: {next.title} →
        </a>
      ) : (
        <a href={formatRoute({ kind: 'summary' })} data-testid="next-stage" className="next">
          {walkthrough ? 'Finish: ' : ''}Summary of your runs →
        </a>
      )}
    </nav>
  );
}
