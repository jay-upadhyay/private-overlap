// The fishing attack: a querier pads its real customers with candidate identities, runs PSI
// exactly as specified, and reads off which candidates are banned. The protocol is followed to
// the letter; the holder sees only a larger count, which it cannot tell apart from a big customer base.

import { scoreRecovery, type RecoveryScore } from '../score';
import { extractIdentifiers } from '../../data/identifiers';
import type { MatchField } from '../../data/normalize';
import type { CustomerRecord, Scenario } from '../../data/scenario';
import { runInMemory, type RunOptions } from '../../protocol/run';
import {
  screeningParties,
  type QuerierResult,
  type ScreeningInput,
  type ScreeningProtocol,
} from '../../protocol/screening';
import type { PartySpec, WireEntry } from '../../protocol/types';
import { multiPartyPsi } from '../../protocols/psi/multiParty';
import { twoPartyParties } from '../../protocols/psi/parties';
import { twoPartyPsi } from '../../protocols/psi/twoParty';

const FISH_PREFIX = 'fish-';

/** Candidate identifiers dressed up as customer rows. */
export function candidateRecords(candidates: readonly string[], field: MatchField): CustomerRecord[] {
  return candidates.map((value, i) => ({
    rowId: `${FISH_PREFIX}${i}`,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dob: '',
    wallet: '',
    [field]: value,
  }));
}

export interface FishingResult {
  /** Rows the querier sent: real customers plus candidates. */
  sent: number;
  /** Per holder: candidates that holder's list contains. */
  hitsByHolder: Record<string, string[]>;
  /** The querier's legitimate output (real customers only), unchanged by the padding. */
  flaggedCustomers: QuerierResult['flaggedBy'];
  wire: WireEntry[];
}

async function fish(
  protocol: ScreeningProtocol,
  parties: PartySpec<ScreeningInput>[],
  candidates: readonly string[],
  field: MatchField,
  runOptions: RunOptions,
): Promise<FishingResult> {
  const [querier, ...holders] = parties;
  if (querier?.input.kind !== 'querier') throw new Error('querier must come first');
  const records = [...querier.input.records, ...candidateRecords(candidates, field)];
  const padded = { ...querier, input: { ...querier.input, records } };
  const { results, wire } = await runInMemory(protocol, [padded, ...holders], runOptions);
  const result = results[querier.id] as QuerierResult;

  const hitsByHolder: Record<string, string[]> = Object.fromEntries(
    querier.input.holders.map((h) => [h, [] as string[]]),
  );
  const flaggedCustomers: QuerierResult['flaggedBy'] = {};
  for (const [rowId, by] of Object.entries(result.flaggedBy)) {
    if (!rowId.startsWith(FISH_PREFIX)) {
      flaggedCustomers[rowId] = by;
      continue;
    }
    const value = candidates[Number(rowId.slice(FISH_PREFIX.length))]!;
    for (const h of by) hitsByHolder[h]!.push(value);
  }
  return { sent: records.length, hitsByHolder, flaggedCustomers, wire };
}

/** Fishing against one holder with two-party PSI. */
export function runFishing(
  scenario: Scenario,
  options: { field: MatchField; candidates: readonly string[]; holderId?: string },
  runOptions: RunOptions = {},
): Promise<FishingResult> {
  const parties = twoPartyParties(scenario, options.field, options.holderId);
  return fish(twoPartyPsi, parties, options.candidates, options.field, runOptions);
}

/** Fishing against every holder at once with multi-party PSI: one run scrapes every list. */
export function runMultiFishing(
  scenario: Scenario,
  options: { field: MatchField; candidates: readonly string[] },
  runOptions: RunOptions = {},
): Promise<FishingResult> {
  const parties = screeningParties(scenario, options.field);
  return fish(multiPartyPsi, parties, options.candidates, options.field, runOptions);
}

/** How much of a holder's (normalized) banlist the hits recover, from ground truth. */
export function scoreFishing(
  scenario: Scenario,
  holderId: string,
  field: MatchField,
  hits: readonly string[],
): RecoveryScore {
  const holder = scenario.holders.find((h) => h.institution.id === holderId);
  if (!holder) throw new Error(`no holder ${holderId}`);
  return scoreRecovery(hits, extractIdentifiers(holder.records, field).values);
}
