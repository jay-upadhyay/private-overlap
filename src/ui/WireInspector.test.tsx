import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RECORDED_WIRE } from './fixtures/wireLog';
import { WireInspector } from './WireInspector';

describe('WireInspector', () => {
  it('renders_fixture_log', () => {
    render(
      <WireInspector
        entries={RECORDED_WIRE}
        names={{ northwind: 'Northwind Exchange', halcyon: 'Halcyon Brokerage' }}
      />,
    );
    const entries = screen.getAllByTestId('wire-entry');
    expect(entries).toHaveLength(RECORDED_WIRE.length);
    const first = within(entries[0]!);
    expect(first.getByText(/Northwind Exchange/)).toHaveTextContent('Northwind Exchange → Halcyon Brokerage');
    expect(first.getByText('customers')).toBeInTheDocument();
    expect(first.getByText(RECORDED_WIRE[0]!.preview)).toBeInTheDocument();
    expect(entries[0]).toHaveTextContent('Eavesdropper sees:');
    // Parties without a display name fall back to their id.
    expect(entries[2]).toHaveTextContent('Northwind Exchange → meridian');
    expect(screen.getByTestId('wire-summary')).toHaveTextContent('4 messages · 132 B');
  });

  it('uses_stage_eavesdropper_line', () => {
    render(<WireInspector entries={RECORDED_WIRE.slice(0, 1)} eavesdropperSees={() => 'only noise'} />);
    expect(screen.getByTestId('wire-entry')).toHaveTextContent('Eavesdropper sees: only noise');
  });

  it('shows_empty_state_before_a_run', () => {
    render(<WireInspector entries={[]} />);
    expect(screen.queryByTestId('wire-entry')).toBeNull();
    expect(screen.getByTestId('wire-inspector')).toHaveTextContent('No messages yet');
  });
});
