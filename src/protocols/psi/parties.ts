import type { MatchField } from '../../data/normalize';
import type { Scenario } from '../../data/scenario';
import { screeningParties, type ScreeningInput } from '../../protocol/screening';
import type { PartySpec } from '../../protocol/types';

/**
 * The querier and one holder (by id; defaults to the first), for two-party PSI on a scenario
 * that may have several holders. Multi-party runs use screeningParties directly.
 */
export function twoPartyParties(
  scenario: Scenario,
  field: MatchField,
  holderId: string = scenario.holders[0]!.institution.id,
): PartySpec<ScreeningInput>[] {
  const [querier, ...holders] = screeningParties(scenario, field);
  const holder = holders.find((h) => h.id === holderId);
  if (!querier || !holder) throw new Error(`no holder ${holderId}`);
  return [{ ...querier, input: { ...querier.input, holders: [holderId] } as ScreeningInput }, holder];
}
