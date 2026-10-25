import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RecoveryScore } from '../attacks/score';
import { expectedQuerierResult } from '../protocol/screening';
import { STAGES, type AttackOutcome, type StageDefinition } from '../stages';
import { resetSessionForTests, sessionState } from './session';
import { StagePage } from './StagePage';
import { ATTACK_TIMEOUT_MS } from './useStageRun';
import { SummaryPage } from './SummaryPage';

// The attacker panel as UI: buttons, states, displayed numbers and the summary row.
// The stage's attack is replaced by a stand-in returning fixed numbers, so these tests check
// what the panel shows for a given outcome, not how any attack computes it.

const psiStage = STAGES.find((s) => s.id === 'psi')!;

const score = (tp: number, missed: number, fp: number): RecoveryScore => ({
  truePositives: tp,
  falsePositives: fp,
  missed,
  recall: tp + missed === 0 ? 1 : tp / (tp + missed),
  precision: tp + fp === 0 ? 1 : tp / (tp + fp),
});

const outcome = (s: RecoveryScore, extra: Partial<AttackOutcome> = {}): AttackOutcome => ({
  target: 'Stand-in target list',
  score: s,
  examples: ['example-1', 'example-2'],
  ...extra,
});

/** Stand-in protocol: returns the exact answer and logs one message. */
const runProtocol: NonNullable<StageDefinition['runProtocol']> = async (ctx) => {
  ctx.onMessage({ seq: 0, from: 'q', to: 'h', type: 'stub', round: 1, bytes: 32, preview: '00' });
  return { kind: 'querier', flaggedBy: expectedQuerierResult(ctx.scenario), skipped: [] };
};

function renderStage(runAttack: NonNullable<StageDefinition['runAttack']>) {
  return render(<StagePage stage={{ ...psiStage, runProtocol, runAttack }} />);
}

afterEach(resetSessionForTests);

describe('attacker panel', () => {
  it('panel_button_runs_the_attack_once_and_shows_running_then_result', async () => {
    let resolve!: (o: AttackOutcome) => void;
    const runAttack = vi.fn(() => new Promise<AttackOutcome>((r) => (resolve = r)));
    renderStage(runAttack);

    await userEvent.click(screen.getByTestId('run-attack'));
    expect(runAttack).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('attack-status')).toHaveTextContent('Attacking…');
    expect(screen.getByTestId('run-attack')).toBeDisabled();

    resolve(outcome(score(3, 1, 1)));
    await waitFor(() => expect(screen.getByTestId('attack-score')).toBeInTheDocument());
    expect(screen.getByTestId('attack-status')).toHaveAttribute('data-status', 'done');
    expect(screen.getByTestId('run-attack')).toBeEnabled();
  });

  it('explainer_button_runs_the_same_attack', async () => {
    const runAttack = vi.fn(async () => outcome(score(1, 0, 0)));
    renderStage(runAttack);
    await userEvent.click(screen.getByTestId('explainer-run-attack'));
    await waitFor(() => expect(screen.getByTestId('attack-score')).toBeInTheDocument());
    expect(runAttack).toHaveBeenCalledTimes(1);
  });

  it('shows_counts_and_percentages_from_the_outcome', async () => {
    renderStage(async () => outcome(score(3, 1, 1)));
    await userEvent.click(screen.getByTestId('run-attack'));
    const panel = await screen.findByTestId('attack-score');
    expect(panel).toHaveTextContent('Target: Stand-in target list');
    expect(panel).toHaveTextContent('Recall75%');
    expect(panel).toHaveTextContent('Precision75%');
    expect(panel).toHaveTextContent('3 recovered, 1 missed, 1 wrong guesses.');
    expect(screen.getByTestId('attack-summary')).toHaveTextContent(
      'The attack recovered 3 of the 4 entries in the target (75%). 1 of its 4 claims were wrong.',
    );
    expect(screen.getByRole('list', { name: 'Recovered examples' })).toHaveTextContent('example-1');
  });

  it('rounds_percentages_and_formats_large_counts', async () => {
    renderStage(async () => outcome(score(1_998, 1, 0)));
    await userEvent.click(screen.getByTestId('run-attack'));
    expect(await screen.findByTestId('attack-score')).toHaveTextContent('Recall100%');
    expect(screen.getByTestId('attack-summary')).toHaveTextContent('recovered 1,998 of the 1,999 entries');
  });

  it('says_when_nothing_was_recovered', async () => {
    renderStage(async () => outcome(score(0, 50, 0), { examples: [] }));
    await userEvent.click(screen.getByTestId('run-attack'));
    expect(await screen.findByTestId('attack-summary')).toHaveTextContent(
      'The attack recovered nothing: none of the 50 entries in the target were exposed.',
    );
    expect(screen.getByTestId('attack-score')).toHaveTextContent('Recall0%');
    expect(screen.queryByRole('list', { name: 'Recovered examples' })).toBeNull();
  });

  it('says_when_every_claim_was_right', async () => {
    renderStage(async () => outcome(score(10, 0, 0)));
    await userEvent.click(screen.getByTestId('run-attack'));
    expect(await screen.findByTestId('attack-summary')).toHaveTextContent('Every one it claimed was right.');
  });

  it('shows_the_note_from_the_outcome', async () => {
    renderStage(async () => outcome(score(1, 1, 0), { note: 'Stand-in note for the panel.' }));
    await userEvent.click(screen.getByTestId('run-attack'));
    expect(await screen.findByTestId('attack-score')).toHaveTextContent('Stand-in note for the panel.');
  });

  it('failed_attack_shows_its_error', async () => {
    renderStage(async () => {
      throw new Error('stand-in failure');
    });
    await userEvent.click(screen.getByTestId('run-attack'));
    await waitFor(() => expect(screen.getByTestId('attack-status')).toHaveAttribute('data-status', 'error'));
    expect(screen.getByTestId('attack-status')).toHaveTextContent('Attack failed. stand-in failure');
    expect(screen.queryByTestId('attack-score')).toBeNull();
  });

  it('changing_the_scenario_clears_the_result', async () => {
    renderStage(async () => outcome(score(3, 1, 1)));
    await userEvent.click(screen.getByTestId('run-attack'));
    await screen.findByTestId('attack-score');
    await userEvent.clear(screen.getByTestId('seed-input'));
    await userEvent.type(screen.getByTestId('seed-input'), '9');
    expect(screen.queryByTestId('attack-score')).toBeNull();
    expect(screen.getByTestId('attack-status')).toHaveAttribute('data-status', 'idle');
  });

  it('result_reaches_the_summary_after_a_protocol_run', async () => {
    const { unmount } = renderStage(async () => outcome(score(3, 1, 1)));
    await userEvent.click(screen.getByTestId('run-button'));
    await waitFor(() => expect(screen.getByTestId('run-status')).toHaveAttribute('data-status', 'done'));
    await userEvent.click(screen.getByTestId('run-attack'));
    await screen.findByTestId('attack-score');
    expect(sessionState().runs.psi?.attack).toEqual({
      target: 'Stand-in target list',
      recovered: 3,
      total: 4,
      recall: 0.75,
    });
    unmount();

    render(<SummaryPage />);
    expect(screen.getByTestId('summary-psi-attack')).toHaveTextContent('3 of 4 recovered (75%)');
  });
});

describe('attacker panel never hangs', () => {
  it('a_hanging_attack_times_out_with_a_visible_error', async () => {
    let sawAbort = false;
    const hanging: NonNullable<StageDefinition['runAttack']> = (ctx) =>
      new Promise<AttackOutcome>(() => {
        ctx.signal.addEventListener('abort', () => (sawAbort = true));
      });
    render(<StagePage stage={{ ...psiStage, runProtocol, runAttack: hanging, attackTimeoutMs: 200 }} />);
    await userEvent.click(screen.getByTestId('run-attack'));
    expect(screen.getByTestId('attack-status')).toHaveTextContent('Attacking…');

    await waitFor(() => expect(screen.getByTestId('attack-status')).toHaveAttribute('data-status', 'error'));
    expect(screen.getByTestId('attack-status')).toHaveTextContent(
      'Attack timed out after 0 s and was stopped.',
    );
    // The attack was told to stop, and the buttons work again.
    expect(sawAbort).toBe(true);
    expect(screen.getByTestId('run-attack')).toBeEnabled();
  });

  it('can_run_again_after_a_timeout', async () => {
    let calls = 0;
    const firstHangsThenWorks: NonNullable<StageDefinition['runAttack']> = () =>
      ++calls === 1 ? new Promise<AttackOutcome>(() => {}) : Promise.resolve(outcome(score(2, 2, 0)));
    render(
      <StagePage
        stage={{ ...psiStage, runProtocol, runAttack: firstHangsThenWorks, attackTimeoutMs: 150 }}
      />,
    );
    await userEvent.click(screen.getByTestId('run-attack'));
    await waitFor(() => expect(screen.getByTestId('attack-status')).toHaveAttribute('data-status', 'error'));
    await userEvent.click(screen.getByTestId('run-attack'));
    expect(await screen.findByTestId('attack-summary')).toHaveTextContent('recovered 2 of the 4 entries');
  });

  it('a_normal_attack_finishes_before_the_limit_and_clears_it', async () => {
    renderStage(async () => outcome(score(3, 1, 1)));
    await userEvent.click(screen.getByTestId('run-attack'));
    await screen.findByTestId('attack-score');
    // Past where a leftover timer would fire; the result must stand.
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByTestId('attack-status')).toHaveAttribute('data-status', 'done');
  });

  it('default_limit_is_one_minute', () => {
    expect(ATTACK_TIMEOUT_MS).toBe(60_000);
  });
});
