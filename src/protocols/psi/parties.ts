// Builds runInMemory party lists from a Scenario, so callers don't wire ids by hand.

import type { MatchField } from '../../data/normalize';
import type { Scenario } from '../../data/scenario';
import type { PartySpec } from '../../protocol/types';
import type { MultiPsiInput, MultiPsiOptions } from './multiParty';
import type { PsiInput } from './twoParty';

/** Querier against one holder (by id; defaults to the first). */
export function twoPartyParties(
  scenario: Scenario,
  field: MatchField,
  holderId?: string,
): PartySpec<PsiInput>[] {
  const querier = scenario.querier.institution.id;
  const holder = holderId ? scenario.holders.find((h) => h.institution.id === holderId) : scenario.holders[0];
  if (!holder) throw new Error(`no holder ${holderId}`);
  return [
    {
      id: querier,
      role: 'querier',
      input: { field, records: scenario.querier.records, holder: holder.institution.id },
    },
    { id: holder.institution.id, role: 'holder', input: { field, records: holder.records, querier } },
  ];
}

/** Querier against every holder in the scenario (or the listed ones, in that order). */
export function multiPartyParties(
  scenario: Scenario,
  field: MatchField,
  options: MultiPsiOptions & { holderIds?: readonly string[] } = {},
): PartySpec<MultiPsiInput>[] {
  const querier = scenario.querier.institution.id;
  const ids = options.holderIds ?? scenario.holders.map((h) => h.institution.id);
  const holders = ids.map((id) => {
    const holder = scenario.holders.find((h) => h.institution.id === id);
    if (!holder) throw new Error(`no holder ${id}`);
    return holder;
  });
  return [
    {
      id: querier,
      role: 'querier',
      input: { field, records: scenario.querier.records, holders: ids, mode: options.mode },
    },
    ...holders.map((h) => ({
      id: h.institution.id,
      role: 'holder',
      input: { field, records: h.records, querier },
    })),
  ];
}
