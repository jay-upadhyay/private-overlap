import { act, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { resetSessionForTests } from './ui/session';
import { App } from './App';
import { STAGES } from './stages';

describe('App', () => {
  afterEach(resetSessionForTests);

  it('renders_stage_nav', () => {
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Stages' });
    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(STAGES.length + 2);
    expect(links[0]).toHaveTextContent('Home');
    STAGES.forEach((stage, i) => expect(links[i + 1]).toHaveTextContent(stage.title));
    expect(links.at(-1)).toHaveTextContent('Summary');
    expect(within(nav).getByTestId('nav-walkthrough')).toHaveTextContent('Walkthrough');
  });

  it('defaults_to_landing_page', () => {
    render(<App />);
    expect(screen.getByTestId('landing')).toBeInTheDocument();
    expect(screen.getByTestId('start-walkthrough')).toBeInTheDocument();
  });

  it('walkthrough_carries_scenario_and_links_on', async () => {
    render(<App />);
    act(() => screen.getByTestId('start-walkthrough').click());
    act(() => window.dispatchEvent(new HashChangeEvent('hashchange')));
    expect(screen.getByTestId('stage-plaintext')).toBeInTheDocument();
    expect(screen.getByTestId('walkthrough-banner')).toHaveTextContent('stage 1 of 5');
    expect(screen.getByTestId('walkthrough-banner')).toHaveTextContent('Consortium screen');
    expect(screen.getByTestId('next-stage')).toHaveAttribute('href', '#/stage/hashing');
    act(() => screen.getByTestId('exit-walkthrough').click());
    expect(screen.queryByTestId('walkthrough-banner')).toBeNull();
  });

  it('renders_every_theory_page_with_references', () => {
    render(<App />);
    for (const stage of STAGES) {
      act(() => {
        window.location.hash = `#/theory/${stage.id}`;
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });
      expect(screen.getByTestId(`theory-${stage.id}`)).toBeInTheDocument();
      expect(screen.getByTestId('theory-example')).toBeInTheDocument();
      const refs = within(screen.getByTestId('references')).getAllByRole('link');
      expect(refs.length, stage.id).toBeGreaterThanOrEqual(2);
      for (const a of refs) expect(a.getAttribute('href'), stage.id).toMatch(/^https:\/\//);
      expect(screen.getByTestId('theory-to-stage')).toHaveAttribute('href', `#/stage/${stage.id}`);
    }
  });

  it('summary_lists_every_stage_as_not_run', () => {
    render(<App />);
    act(() => {
      window.location.hash = '#/summary';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    for (const stage of STAGES)
      expect(screen.getByTestId(`summary-${stage.id}-scenario`)).toHaveTextContent('Not run yet');
    expect(screen.queryByTestId('bottom-line')).toBeNull();
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
