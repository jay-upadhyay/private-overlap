import { formatRoute } from '../routing';
import { STAGES } from '../stages';
import { REVEALS } from './reveals';
import { startWalkthrough } from './session';

export function Landing() {
  const start = () => {
    startWalkthrough();
    window.location.hash = formatRoute({ kind: 'stage', stage: STAGES[0]!.id });
  };
  return (
    <main className="stage-page landing" data-testid="landing">
      <h2>Find shared bad actors without sharing your lists</h2>
      <p>
        A bank, broker or crypto exchange wants to know which of its customers other institutions have banned.
        Nobody will hand over a customer list or a banlist, so the institutions compute the overlap with
        cryptography instead, in your browser, with each institution in its own Web Worker.
      </p>
      <p>
        Five stages, each a stronger technique. Every stage ends on what breaks it, which is why the next one
        exists.
      </p>
      <p>
        <button type="button" className="button primary" data-testid="start-walkthrough" onClick={start}>
          Start the walkthrough
        </button>{' '}
        <span className="muted small">One scenario carried through all five stages, about 5 minutes.</span>
      </p>
      <ol className="stage-cards">
        {STAGES.map((s) => (
          <li key={s.id} className="stage-card" data-testid={`card-${s.id}`}>
            <h3>
              <span className="stage-number">{s.number}</span> {s.title}
            </h3>
            <p>{s.summary}</p>
            <p className="small muted">The querier learns: {REVEALS[s.id]}</p>
            <p className="card-links">
              <a href={formatRoute({ kind: 'stage', stage: s.id })}>Try it</a>
              <a href={formatRoute({ kind: 'theory', stage: s.id })}>Theory and math</a>
            </p>
          </li>
        ))}
      </ol>
      <p className="small">
        <a href={formatRoute({ kind: 'summary' })}>Summary of your runs</a>
      </p>
    </main>
  );
}
