import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Explainer } from './Explainer';
import { dpRisk } from './explainers/dp-risk';
import { psi } from './explainers/psi';

// Node's own localStorage shadows jsdom's and does not work without a file, so use a map.
function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
  };
}

beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
afterEach(() => vi.unstubAllGlobals());

describe('Explainer', () => {
  it('renders_steps_protects_breaks', async () => {
    const onRunAttack = vi.fn();
    render(<Explainer stageId="psi" explainer={psi} onRunAttack={onRunAttack} />);
    const steps = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(steps).toHaveLength(psi.steps.length);
    expect(steps[0]).toHaveTextContent('H(x)^q');
    expect(screen.getByTestId('explainer-protects')).toHaveTextContent(psi.protects);
    const breaks = screen.getByTestId('explainer-breaks');
    expect(breaks).toHaveTextContent('What breaks it: Fishing');
    await userEvent.click(within(breaks).getByRole('button', { name: 'Run attack' }));
    expect(onRunAttack).toHaveBeenCalledOnce();
  });

  it('out_of_scope_stage_has_no_attack_button', () => {
    render(<Explainer stageId="dp-risk" explainer={dpRisk} onRunAttack={() => {}} />);
    const breaks = screen.getByTestId('explainer-breaks');
    expect(breaks).toHaveTextContent('Out of scope');
    expect(within(breaks).queryByRole('button')).toBeNull();
  });

  it('collapse_is_remembered_per_stage', async () => {
    const { unmount } = render(<Explainer stageId="psi" explainer={psi} />);
    const toggle = screen.getByRole('button', { name: 'How this stage works' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(toggle);
    expect(screen.getByTestId('explainer-body')).not.toBeVisible();
    unmount();

    render(<Explainer stageId="psi" explainer={psi} />);
    expect(screen.getByTestId('explainer-body')).not.toBeVisible();
    render(<Explainer stageId="dp-risk" explainer={dpRisk} />);
    expect(screen.getAllByTestId('explainer-body')[1]).toBeVisible();
  });

  it('works_when_storage_throws', async () => {
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    const getItem = vi.fn(blocked);
    vi.stubGlobal('localStorage', { getItem, setItem: blocked });
    render(<Explainer stageId="psi" explainer={psi} />);
    expect(screen.getByTestId('explainer-body')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'How this stage works' }));
    expect(screen.getByTestId('explainer-body')).not.toBeVisible();
    expect(getItem).toHaveBeenCalled();
  });
});
