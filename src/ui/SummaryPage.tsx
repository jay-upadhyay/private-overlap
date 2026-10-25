import type { ReactNode } from 'react';
import { formatRoute } from '../routing';
import { STAGES, type StageId } from '../stages';
import { formatBytes, formatPercent } from './format';
import type { RunFacts } from './narrative';
import { startWalkthrough, useSession, type StageRunRecord } from './session';

// Stages side by side, the same question in every row. Rows marked "measured" come from your
// runs; the others are properties of the technique.

const HOLDER_LEARNS: Record<StageId, string> = {
  plaintext: 'Nothing',
  hashing: 'Every customer, as an unsalted hash',
  psi: 'Only how many values were screened',
  'multi-psi': 'Only how many values were screened',
  'dp-risk': 'Only how many values were screened',
};

const ATTRIBUTION: Record<StageId, string> = {
  plaintext: 'Yes: each list arrives from its institution',
  hashing: 'Yes: each hash list arrives from its institution',
  psi: 'Yes, trivially: there is one institution',
  'multi-psi': 'Yes: a separate answer per institution',
  'dp-risk': 'No: one noisy count, no names',
};

const CHANGED: Record<StageId, string> = {
  plaintext: 'The baseline: everything is shared.',
  hashing:
    'Identifiers no longer cross the wire readably, but a hash of a guessable identifier can be matched by anyone who guesses it.',
  psi: 'Blinding with secret exponents means only the querier’s own customers can match. Banned non-customers stop leaking. The cost is about 1 ms of elliptic-curve work per value.',
  'multi-psi':
    'Same protection, against several institutions at once. New leak: the querier sees which institution flagged whom.',
  'dp-risk':
    'Exact per-institution answers become one noisy count, so no institution is named. The cost is accuracy, and every score spends privacy budget.',
};

const n = (x: number) => x.toLocaleString();

interface Row {
  label: string;
  measured: boolean;
  cell: (stage: StageId, run: StageRunRecord | undefined) => ReactNode;
}

const ROWS: Row[] = [
  { label: 'Scenario', measured: true, cell: (_s, r) => r?.scenarioLabel },
  {
    label: 'Flagged customers found',
    measured: true,
    cell: (s, r) =>
      r &&
      (s === 'dp-risk'
        ? `${n(r.facts.flaggedFound)} scored Review or High risk; ${n(r.facts.flaggedTruth)} truly flagged`
        : `${n(r.facts.flaggedFound)} of ${n(r.facts.flaggedTruth)} truly flagged${
            s === 'psi' ? ` (two-party: checks ${r.facts.holders[0]} only)` : ''
          }`),
  },
  {
    label: 'Accuracy against ground truth',
    measured: true,
    cell: (_s, r) =>
      r &&
      (r.facts.tiers
        ? `Noisy: ${formatPercent(r.facts.tiers.accuracy)} of tiers match the exact count (ε ${r.facts.tiers.epsilon})`
        : r.facts.exact
          ? `Exact: ${n(r.facts.exact.missed)} missed, ${n(r.facts.exact.extra)} extra`
          : ''),
  },
  {
    label: 'Banned non-customers handed to the querier',
    measured: true,
    cell: (s, r) =>
      r &&
      (s === 'plaintext'
        ? `${n(r.facts.nonCustomersExposed)}, readable`
        : s === 'hashing'
          ? `${n(r.facts.nonCustomersExposed)}, as hashes`
          : 'None'),
  },
  { label: 'Querier learns who flagged whom', measured: false, cell: (s) => ATTRIBUTION[s] },
  { label: 'What each holder learns', measured: false, cell: (s) => HOLDER_LEARNS[s] },
  {
    label: 'On the wire',
    measured: true,
    cell: (s, r) =>
      r &&
      `${n(r.facts.messages)} messages, ${formatBytes(r.facts.bytes)}; ${s === 'plaintext' ? 'identifiers readable' : 'no readable identifiers'}`,
  },
  { label: 'Run time', measured: true, cell: (_s, r) => r && `${(r.facts.durationMs / 1000).toFixed(1)} s` },
  {
    label: 'Attack result',
    measured: true,
    cell: (s, r) => {
      const stage = STAGES.find((x) => x.id === s)!;
      if (stage.explainer.breaks.kind === 'out-of-scope') return 'No attack in scope';
      if (!stage.runAttack) return 'Demo not built yet';
      if (!r?.attack) return r ? 'Not run' : undefined;
      return `${n(r.attack.recovered)} of ${n(r.attack.total)} recovered (${formatPercent(r.attack.recall)})`;
    },
  },
  { label: 'What changed from the previous stage', measured: false, cell: (s) => CHANGED[s] },
];

function bottomLine(runs: Partial<Record<StageId, StageRunRecord>>): string | null {
  const f = (s: StageId): RunFacts | undefined => runs[s]?.facts;
  if (!STAGES.every((s) => runs[s.id])) return null;
  // Comparisons (counts, time ratios) only mean something on one shared scenario.
  if (new Set(STAGES.map((s) => runs[s.id]!.scenarioKey)).size !== 1) return null;
  const exactStages: StageId[] = ['plaintext', 'hashing', 'psi', 'multi-psi'];
  const dp = f('dp-risk')!.tiers!;
  return (
    (exactStages.every((st) => f(st)!.exact?.missed === 0 && f(st)!.exact?.extra === 0)
      ? `Stages 0 to 3 all found exactly the right customers; what differs is what else they gave away. `
      : `Stages 0 to 3 did not all match ground truth exactly; check the accuracy row. `) +
    `Plaintext handed the querier ${n(f('plaintext')!.nonCustomersExposed)} banned non-customers in readable form and hashing ${n(f('hashing')!.nonCustomersExposed)} as hashes; ` +
    `both PSI stages handed over none, at ${(f('psi')!.durationMs / Math.max(1, f('plaintext')!.durationMs)).toFixed(0)}× the plaintext run time. ` +
    `Multi-party PSI still named the flagging institution; DP named none, and paid for it: ${formatPercent(dp.accuracy)} of tiers were exact at ε ${dp.epsilon}.`
  );
}

/** "What each stage reveals", stage by stage, from your own runs. */
export function SummaryPage() {
  const { runs } = useSession();
  const ran = STAGES.filter((s) => runs[s.id]);
  const scenarios = new Set(ran.map((s) => runs[s.id]!.scenarioKey));
  const line = bottomLine(runs);

  return (
    <main className="stage-page summary-page" data-testid="summary">
      <h2>What each stage reveals</h2>
      <p>
        Each column is a stage, and every row asks the same question of each one. Rows marked{' '}
        <span className="measured-tag">measured</span> come from your runs in this session, checked against
        ground truth; the others are properties of the technique. {ran.length} of {STAGES.length} stages run
        so far.
      </p>
      {scenarios.size > 1 ? (
        <p className="comparison-warning" role="note" data-testid="scenario-warning">
          Your runs used {scenarios.size} different scenarios, so the measured rows are not like for like. For
          a fair comparison, run every stage on one scenario:{' '}
          <button
            type="button"
            className="button"
            onClick={() => {
              startWalkthrough();
              window.location.hash = formatRoute({ kind: 'stage', stage: STAGES[0]!.id });
            }}
          >
            Start the walkthrough
          </button>
        </p>
      ) : scenarios.size === 1 ? (
        <p className="comparison-ok" data-testid="scenario-same">
          Every run used the same scenario: {runs[ran[0]!.id]!.scenarioLabel}.
        </p>
      ) : null}
      {line && (
        <p className="bottom-line" data-testid="bottom-line">
          <strong>Bottom line.</strong> {line}
        </p>
      )}
      <div className="table-scroll">
        <table className="results-table summary-table">
          <thead>
            <tr>
              <th scope="col">Question</th>
              {STAGES.map((s) => (
                <th scope="col" key={s.id}>
                  <a href={formatRoute({ kind: 'stage', stage: s.id })}>
                    {s.number}. {s.title}
                  </a>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label}>
                <th scope="row">
                  {row.label}
                  {row.measured && <span className="measured-tag">measured</span>}
                </th>
                {STAGES.map((s) => {
                  const run = runs[s.id];
                  const value = row.cell(s.id, run);
                  return (
                    <td key={s.id} data-testid={`summary-${s.id}-${row.label.split(' ')[0]!.toLowerCase()}`}>
                      {value ??
                        (row.measured ? (
                          <span className="muted">
                            Not run yet. <a href={formatRoute({ kind: 'stage', stage: s.id })}>Run it</a>
                          </span>
                        ) : null)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
