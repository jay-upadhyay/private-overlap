import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { STAGES } from '../stages';
import { CONTROL_IDS } from './controls';
import { StagePage } from './StagePage';

describe('explainers', () => {
  it('every_stage_has_explainer', () => {
    for (const stage of STAGES) {
      const { steps, protects, breaks } = stage.explainer;
      expect(steps.length, stage.id).toBeGreaterThanOrEqual(3);
      expect(steps.length, stage.id).toBeLessThanOrEqual(5);
      expect(protects.trim(), stage.id).not.toBe('');
      if (breaks.kind === 'attack') {
        expect(breaks.name.trim(), stage.id).not.toBe('');
        expect(breaks.how.trim(), stage.id).not.toBe('');
      } else {
        expect(breaks.items.length, stage.id).toBeGreaterThan(0);
      }
    }
  });

  it('only_the_last_stage_is_out_of_scope', () => {
    expect(STAGES.map((s) => s.explainer.breaks.kind)).toEqual([
      'attack',
      'attack',
      'attack',
      'attack',
      'out-of-scope',
    ]);
  });

  it('psi_stages_have_live_attack_runners', () => {
    expect(STAGES.find((s) => s.id === 'psi')?.runAttack).toEqual(expect.any(Function));
    expect(STAGES.find((s) => s.id === 'multi-psi')?.runAttack).toEqual(expect.any(Function));
  });

  it('steps_reference_real_controls', () => {
    for (const stage of STAGES) {
      const { unmount } = render(createElement(StagePage, { stage }));
      for (const step of stage.explainer.steps) {
        expect(screen.queryByTestId(step.target), `${stage.id}: ${step.target}`).not.toBeNull();
      }
      unmount();
    }
  });

  it('every_named_control_is_on_the_page', () => {
    // A stub attack, so controls that only appear once an attack exists are rendered too.
    const stage = {
      ...STAGES[2]!,
      runAttack: async () => ({
        target: 'stub',
        score: { truePositives: 0, falsePositives: 0, missed: 0, recall: 1, precision: 1 },
        examples: [],
      }),
    };
    const { unmount } = render(createElement(StagePage, { stage }));
    for (const id of CONTROL_IDS) expect(screen.queryByTestId(id), id).not.toBeNull();
    unmount();
  });
});
