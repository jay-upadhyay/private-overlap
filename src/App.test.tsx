import { act, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { STAGES } from './stages';

describe('App', () => {
  it('renders_stage_nav', () => {
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Stages' });
    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(5);
    STAGES.forEach((stage, i) => expect(links[i]).toHaveTextContent(stage.title));
  });

  it('defaults_to_first_stage', () => {
    render(<App />);
    expect(screen.getByTestId('stage-plaintext')).toBeInTheDocument();
    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('Plaintext');
  });

  it('follows_hash_changes', () => {
    render(<App />);
    act(() => {
      window.location.hash = '#/stage/psi';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByTestId('stage-psi')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Stage 2: Two-party PSI');
  });

  it('reports_failed_workers_when_unavailable', () => {
    // jsdom has no Worker, so the health check must fail visibly rather than hang.
    render(<App />);
    expect(screen.getByTestId('worker-health')).toHaveTextContent('Workers: failed');
  });
});
