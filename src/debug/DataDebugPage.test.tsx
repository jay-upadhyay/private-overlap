import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataDebugPage } from './DataDebugPage';

describe('DataDebugPage', () => {
  it('shows_consortium_truth_and_institutions', () => {
    render(<DataDebugPage />);
    // 300 + 120 + 50 + 20 flagged of 10,000 (see the consortium preset).
    expect(screen.getByTestId('truth-summary')).toHaveTextContent(
      '490 of 10,000 customers are flagged. 300 by 1, 120 by 2, 50 by 3, 20 by 4.',
    );
    expect(screen.getByRole('heading', { name: /Meridian Bank \(banlist\)/ })).toBeInTheDocument();
  });

  it('switching_preset_updates_page', () => {
    render(<DataDebugPage />);
    fireEvent.change(screen.getByLabelText('Preset'), { target: { value: 'onboarding' } });
    expect(screen.getByTestId('truth-summary')).toHaveTextContent('1 of 1 customers are flagged.');
  });
});
