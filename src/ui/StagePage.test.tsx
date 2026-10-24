import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectedQuerierResult } from '../protocol/screening';
import { STAGES, type StageDefinition } from '../stages';
import { StagePage } from './StagePage';

const psiStage = STAGES.find((s) => s.id === 'psi')!;

describe('StagePage', () => {
  it('fixture_run_fills_wire_and_results', async () => {
    render(<StagePage stage={psiStage} />);
    await userEvent.selectOptions(screen.getByTestId('preset-picker'), 'onboarding');
    await userEvent.click(screen.getByTestId('run-button'));
    await waitFor(() => expect(screen.getByTestId('run-status')).toHaveAttribute('data-status', 'done'));
    expect(screen.getAllByTestId('wire-entry')).toHaveLength(2);
    expect(screen.getByTestId('results-tally')).toHaveTextContent('Correct1Missed0Extra0');
  });

  it('uses_stage_hooks_when_set', async () => {
    const runProtocol = vi.fn<NonNullable<StageDefinition['runProtocol']>>(async (ctx) => {
      ctx.onMessage({
        seq: 0,
        from: 'northwind',
        to: 'halcyon',
        type: 'blinded',
        round: 1,
        bytes: 32,
        preview: 'ab',
      });
      return { kind: 'querier', flaggedBy: expectedQuerierResult(ctx.scenario), skipped: [] };
    });
    const runAttack = vi.fn<NonNullable<StageDefinition['runAttack']>>(async (ctx) => ({
      target: 'banlist',
      score: { truePositives: 3, falsePositives: 1, missed: 1, recall: 0.75, precision: 0.75 },
      examples: [`wire had ${ctx.wire.length}`],
    }));
    render(<StagePage stage={{ ...psiStage, runProtocol, runAttack }} />);
    expect(screen.queryByTestId('fixture-note')).toBeNull();

    await userEvent.click(screen.getByTestId('run-button'));
    await waitFor(() => expect(screen.getByTestId('wire-entry')).toHaveTextContent('blinded'));
    await userEvent.click(screen.getByTestId('run-attack'));
    await waitFor(() => expect(screen.getByTestId('attack-score')).toHaveTextContent('Recall75%'));
    expect(screen.getByTestId('attack-score')).toHaveTextContent('wire had 1');
    expect(runProtocol).toHaveBeenCalledOnce();
  });

  it('cancel_stops_a_run', async () => {
    const runProtocol = vi.fn<NonNullable<StageDefinition['runProtocol']>>(
      (ctx) =>
        new Promise((_, reject) => ctx.signal.addEventListener('abort', () => reject(ctx.signal.reason))),
    );
    render(<StagePage stage={{ ...psiStage, runProtocol }} />);
    await userEvent.click(screen.getByTestId('run-button'));
    expect(screen.getByTestId('run-status')).toHaveAttribute('data-status', 'running');
    await userEvent.click(screen.getByTestId('cancel-button'));
    await waitFor(() => expect(screen.getByTestId('run-status')).toHaveAttribute('data-status', 'cancelled'));
    expect(screen.getByTestId('run-button')).toBeEnabled();
  });

  it('god_view_reveals_rows', async () => {
    render(<StagePage stage={psiStage} />);
    expect(screen.queryAllByTestId('party-rows')).toHaveLength(0);
    await userEvent.click(screen.getByTestId('god-view-toggle'));
    expect(screen.getAllByTestId('party-rows')).toHaveLength(2);
  });
});
