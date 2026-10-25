import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectedQuerierResult } from '../protocol/screening';
import { STAGES, type StageDefinition } from '../stages';
import { StagePage } from './StagePage';

const psiStage = STAGES.find((s) => s.id === 'psi')!;

describe('StagePage', () => {
  it('stage_without_protocol_fails_visibly', async () => {
    render(<StagePage stage={{ ...psiStage, runProtocol: undefined }} />);
    await userEvent.click(screen.getByTestId('run-button'));
    await waitFor(() => expect(screen.getByTestId('run-status')).toHaveAttribute('data-status', 'error'));
    expect(screen.getByTestId('run-status')).toHaveTextContent('This stage has no protocol yet.');
  });

  it('attack_not_built_disables_attack_controls', () => {
    render(<StagePage stage={{ ...psiStage, runAttack: undefined }} />);
    expect(screen.getByTestId('attack-not-built')).toBeInTheDocument();
    expect(screen.queryByTestId('run-attack')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Run attack' })).toBeNull();
  });

  it('custom_size_scales_the_scenario', async () => {
    render(<StagePage stage={psiStage} />);
    const input = screen.getByTestId('size-input');
    expect(screen.getByTestId('size-note')).toHaveTextContent('1,000 customers; banlists of 200.');
    await userEvent.clear(input);
    await userEvent.type(input, '2500');
    expect(screen.getByTestId('size-note')).toHaveTextContent('2,500 customers; banlists of 500.');
    expect(screen.getByTestId('run-estimate')).toHaveTextContent('Estimated run time: about');
  });

  it('out_of_range_size_clamps', async () => {
    render(<StagePage stage={psiStage} />);
    const input = screen.getByTestId('size-input');
    await userEvent.clear(input);
    await userEvent.type(input, '99999');
    expect(screen.getByTestId('size-note')).toHaveTextContent('10,000 customers');
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
