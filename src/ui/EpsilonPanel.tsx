import { useMemo, useState, type PointerEvent } from 'react';
import type { Scenario } from '../data/scenario';
import { membershipAccuracyBound } from '../dp/bounds';
import {
  EPSILON_MAX,
  EPSILON_MIN,
  EPSILON_STEP,
  expectedTierAccuracy,
  flagCountMix,
  GRID,
  TABLE_EPSILONS,
} from './epsilon';
import { formatPercent } from './format';

// Stage 4: choose ε per score and see what it buys: the expected share of customers whose
// released tier equals the tier of their exact count, for this scenario's mix of flag counts.
// The attacker's bound e^ε / (1 + e^ε) is stated in words and in the table rather than drawn:
// for customers nobody flags (most of them) tier accuracy is exactly that bound, so the two
// curves would sit on top of each other.

interface EpsilonPanelProps {
  scenario: Scenario;
  epsilon: number;
  onEpsilonChange(epsilon: number): void;
  disabled: boolean;
  /** Measured tier accuracy of completed runs, at the ε each used. */
  runs: readonly { epsilon: number; accuracy: number }[];
}

export function EpsilonPanel({ scenario, epsilon, onEpsilonChange, disabled, runs }: EpsilonPanelProps) {
  const mix = useMemo(() => flagCountMix(scenario), [scenario]);
  const expected = expectedTierAccuracy(mix, epsilon);
  const bound = membershipAccuracyBound(epsilon);

  return (
    <section className="panel epsilon-panel" data-testid="epsilon-panel" aria-labelledby="epsilon-heading">
      <header className="panel-header">
        <h3 id="epsilon-heading">Privacy vs accuracy</h3>
      </header>
      <div className="epsilon-control">
        <label htmlFor="epsilon-slider">
          ε per score: <strong data-testid="epsilon-value">{epsilon.toFixed(1)}</strong>
        </label>
        <input
          id="epsilon-slider"
          data-testid="epsilon-slider"
          type="range"
          min={EPSILON_MIN}
          max={EPSILON_MAX}
          step={EPSILON_STEP}
          value={epsilon}
          disabled={disabled}
          onChange={(e) => onEpsilonChange(Number(e.target.value))}
        />
      </div>
      <p data-testid="epsilon-summary">
        At ε {epsilon.toFixed(1)}, about <strong>{formatPercent(expected)}</strong> of tiers match the exact
        count. The same ε lets an attacker guess from one score whether a customer is flagged, right at most{' '}
        <strong>{formatPercent(bound)}</strong> of the time (50% is a coin flip). Accuracy and exposure rise
        together.
      </p>
      <AccuracyChart mix={mix} epsilon={epsilon} runs={runs} />
      {runs.length > 0 && (
        <ul className="chart-legend" aria-label="Legend">
          <li>
            <span className="swatch" style={{ background: 'var(--series-1)' }} />
            Expected
          </li>
          <li>
            <span className="swatch dot" style={{ border: '2px solid var(--series-1)' }} />
            Your runs (measured)
          </li>
        </ul>
      )}
      <details className="small">
        <summary>Show as a table</summary>
        <table className="results-table" data-testid="epsilon-table">
          <thead>
            <tr>
              <th scope="col">ε per score</th>
              <th scope="col">Tier accuracy</th>
              <th scope="col">Attacker&rsquo;s best guess</th>
            </tr>
          </thead>
          <tbody>
            {TABLE_EPSILONS.map((e) => (
              <tr key={e}>
                <th scope="row">{e}</th>
                <td>{formatPercent(expectedTierAccuracy(mix, e))}</td>
                <td>{formatPercent(membershipAccuracyBound(e))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

// Chart geometry, in viewBox units; the SVG scales to the panel width.
const W = 600;
const H = 240;
const PAD = { left: 44, right: 96, top: 16, bottom: 36 };
const X = (e: number) =>
  PAD.left + ((e - EPSILON_MIN) / (EPSILON_MAX - EPSILON_MIN)) * (W - PAD.left - PAD.right);
const Y = (p: number) => PAD.top + (1 - p) * (H - PAD.top - PAD.bottom);
const TIP_W = 132;

function AccuracyChart({
  mix,
  epsilon,
  runs,
}: {
  mix: readonly number[];
  epsilon: number;
  runs: EpsilonPanelProps['runs'];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const line = GRID.map(
    (e, i) => `${i === 0 ? 'M' : 'L'}${X(e).toFixed(1)} ${Y(expectedTierAccuracy(mix, e)).toFixed(1)}`,
  ).join(' ');
  const last = GRID.at(-1)!;

  const onMove = (event: PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * W;
    const e = EPSILON_MIN + ((x - PAD.left) / (W - PAD.left - PAD.right)) * (EPSILON_MAX - EPSILON_MIN);
    setHover(GRID.reduce((a, b) => (Math.abs(b - e) < Math.abs(a - e) ? b : a)));
  };

  const tipX = hover === null ? 0 : Math.min(X(hover) + 8, W - PAD.right - TIP_W);

  return (
    <svg
      className="accuracy-chart"
      data-testid="accuracy-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Expected tier accuracy for ε from ${EPSILON_MIN} to ${EPSILON_MAX}`}
    >
      <g aria-hidden="true" fontSize="11" fill="var(--muted)">
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <g key={p}>
            <line x1={PAD.left} x2={W - PAD.right} y1={Y(p)} y2={Y(p)} stroke="var(--grid)" />
            <text x={PAD.left - 6} y={Y(p) + 4} textAnchor="end">
              {p * 100}%
            </text>
          </g>
        ))}
        {[0.5, 1, 1.5, 2].map((e) => (
          <text key={e} x={X(e)} y={H - PAD.bottom + 16} textAnchor="middle">
            {e}
          </text>
        ))}
        <text x={(PAD.left + W - PAD.right) / 2} y={H - 4} textAnchor="middle">
          ε per score
        </text>
      </g>

      <line
        x1={X(epsilon)}
        x2={X(epsilon)}
        y1={PAD.top}
        y2={H - PAD.bottom}
        stroke="var(--muted)"
        strokeDasharray="4 4"
        data-testid="epsilon-marker"
      />
      <path d={line} fill="none" stroke="var(--series-1)" strokeWidth="2" />
      <text x={X(last) + 6} y={Y(expectedTierAccuracy(mix, last)) + 4} fontSize="11" fill="var(--text)">
        Tier accuracy
      </text>
      <circle
        cx={X(epsilon)}
        cy={Y(expectedTierAccuracy(mix, epsilon))}
        r="5"
        fill="var(--series-1)"
        stroke="var(--surface)"
        strokeWidth="2"
      />
      {runs.map((r, i) => (
        <circle
          key={i}
          data-testid="run-dot"
          cx={X(r.epsilon)}
          cy={Y(r.accuracy)}
          r="4"
          fill="var(--surface)"
          stroke="var(--series-1)"
          strokeWidth="2"
        >
          <title>
            Run {i + 1}: ε {r.epsilon.toFixed(1)}, {formatPercent(r.accuracy)} of tiers matched
          </title>
        </circle>
      ))}

      {hover !== null && (
        <g pointerEvents="none" data-testid="chart-tooltip">
          <line x1={X(hover)} x2={X(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--border)" />
          <rect
            x={tipX}
            y={PAD.top}
            width={TIP_W}
            height="36"
            rx="4"
            fill="var(--surface)"
            stroke="var(--border)"
          />
          <text x={tipX + 8} y={PAD.top + 15} fontSize="11" fill="var(--text)">
            ε {hover.toFixed(2)}
          </text>
          <text x={tipX + 8} y={PAD.top + 29} fontSize="11" fill="var(--text)">
            Tiers right: {formatPercent(expectedTierAccuracy(mix, hover))}
          </text>
        </g>
      )}

      {/* Hit area larger than the line, for the crosshair. */}
      <rect
        x={PAD.left}
        y={PAD.top}
        width={W - PAD.left - PAD.right}
        height={H - PAD.top - PAD.bottom}
        fill="transparent"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      />
    </svg>
  );
}
