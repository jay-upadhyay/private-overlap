import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { smallScenario } from '../test/fixtures';
import { GOD_VIEW_ROWS, PartyCard } from './PartyCard';

describe('PartyCard', () => {
  const scenario = smallScenario();
  const { institution, records } = scenario.holders[0]!;

  it('hides_rows_without_god_view', () => {
    const { rerender } = render(
      <PartyCard institution={institution} role="holder" records={records} field="email" godView={false} />,
    );
    const card = screen.getByRole('article', { name: institution.name });
    expect(card).toHaveTextContent(`${records.length} banlist entries`);
    expect(card).toHaveTextContent('Private');
    expect(screen.queryByTestId('party-rows')).toBeNull();
    expect(card).not.toHaveTextContent(records[0]!.email);

    rerender(<PartyCard institution={institution} role="holder" records={records} field="email" godView />);
    expect(screen.getByTestId('party-rows')).toHaveTextContent(records[0]!.email);
    expect(screen.getAllByRole('listitem')).toHaveLength(GOD_VIEW_ROWS + 1);
  });
});
