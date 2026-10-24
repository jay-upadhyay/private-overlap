import { useId, useState } from 'react';
import { CONTROLS } from './controls';
import type { Explainer as ExplainerContent } from './explainers/types';
import { revealControl } from './format';
import { readStored, writeStored } from './storage';

const storageKey = (stageId: string) => `private-overlap.explainer.${stageId}`;

interface ExplainerProps {
  stageId: string;
  explainer: ExplainerContent;
  onRunAttack?: () => void;
  attackBusy?: boolean;
}

export function Explainer({ stageId, explainer, onRunAttack, attackBusy = false }: ExplainerProps) {
  // Open on the first visit to each stage; afterwards remember what the reader chose.
  const [open, setOpen] = useState(() => readStored(storageKey(stageId)) !== 'closed');
  const bodyId = useId();
  const { steps, protects, breaks } = explainer;

  const toggle = () => {
    setOpen(!open);
    writeStored(storageKey(stageId), open ? 'closed' : 'open');
  };

  return (
    <section className="explainer" data-testid="explainer" aria-label="How this stage works">
      <button
        type="button"
        className="explainer-toggle"
        data-testid="explainer-toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={toggle}
      >
        <span aria-hidden="true" className="chevron">
          {open ? '▾' : '▸'}
        </span>
        How this stage works
      </button>
      <div id={bodyId} className="explainer-body" data-testid="explainer-body" hidden={!open}>
        <div className="explainer-part">
          <h3>How it works</h3>
          <ol className="explainer-steps">
            {steps.map((step) => (
              <li key={step.text}>
                {step.text}{' '}
                <button
                  type="button"
                  className="control-link"
                  data-step-target={step.target}
                  onClick={() => revealControl(step.target)}
                  aria-label={`Show ${CONTROLS[step.target]}`}
                >
                  {CONTROLS[step.target]}
                </button>
              </li>
            ))}
          </ol>
        </div>
        <div className="explainer-part">
          <h3>What it protects</h3>
          <p data-testid="explainer-protects">{protects}</p>
        </div>
        <div className="explainer-part" data-testid="explainer-breaks">
          {breaks.kind === 'attack' ? (
            <>
              <h3>What breaks it: {breaks.name}</h3>
              <p>{breaks.how}</p>
              {onRunAttack && (
                <button
                  type="button"
                  className="button"
                  data-testid="explainer-run-attack"
                  onClick={onRunAttack}
                  disabled={attackBusy}
                >
                  Run attack
                </button>
              )}
            </>
          ) : (
            <>
              <h3>Out of scope</h3>
              <ul>
                {breaks.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
