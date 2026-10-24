// The fishing attack: a querier pads its real customers with candidate identities, runs PSI
// exactly as specified, and reads off which candidates are banned. The protocol is followed to
// the letter; the holder sees only a larger count, which it cannot tell apart from a big customer base.

import { normalizeField, type MatchField } from '../../data/normalize';
import type { Scenario } from '../../data/scenario';
import { runInMemory, type RunOptions } from '../../protocol/run';
import type { WireEntry } from '../../protocol/types';
import { multiPartyParties } from '../../protocols/psi/parties';
import { multiPartyPsi, type MultiPsiQuerierOutput } from '../../protocols/psi/multiParty';
import type { IdentifierRecord } from '../../protocols/psi/prepare';
import { twoPartyPsi, type PsiQuerierOutput } from '../../protocols/psi/twoParty';
import { twoPartyParties } from '../../protocols/psi/parties';

const FISH_PREFIX = 'fish-';

/** Candidate identifiers dressed up as customer rows. */
export function candidateRecords(candidates: readonly string[], field: MatchField): IdentifierRecord[] {
  return candidates.map((value, i) => ({
    rowId: `${FISH_PREFIX}${i}`,
    email: '',
    phone: '',
    wallet: '',
    [field]: value,
  }));
}

/** Replaces the querier's input with its real customers followed by the candidates. */
function pad<P extends { role: string; input: { records: readonly IdentifierRecord[] } }>(
  parties: P[],
  candidates: readonly string[],
  field: MatchField,
): P[] {
  return parties.map((p) =>
    p.role === 'querier'
      ? { ...p, input: { ...p.input, records: [...p.input.records, ...candidateRecords(candidates, field)] } }
      : p,
  );
}

function hitsFrom(matches: readonly string[], candidates: readonly string[]): string[] {
  return matches
    .filter((rowId) => rowId.startsWith(FISH_PREFIX))
    .map((rowId) => candidates[Number(rowId.slice(FISH_PREFIX.length))]!);
}

export interface FishingResult {
  /** Rows the querier sent: real customers plus candidates. */
  sent: number;
  /** Candidates PSI reported as on the banlist. */
  hits: string[];
  /** The querier's legitimate output, unchanged by the padding. */
  flaggedCustomers: string[];
  wire: WireEntry[];
}

export async function runFishing(
  scenario: Scenario,
  options: { field: MatchField; candidates: readonly string[]; holderId?: string },
  runOptions: RunOptions = {},
): Promise<FishingResult> {
  const { field, candidates, holderId } = options;
  const parties = pad(twoPartyParties(scenario, field, holderId), candidates, field);
  const { results, wire } = await runInMemory(twoPartyPsi, parties, runOptions);
  const querier = results[parties[0]!.id] as PsiQuerierOutput;
  return {
    sent: querier.sentCount,
    hits: hitsFrom(querier.matches, candidates),
    flaggedCustomers: querier.matches.filter((rowId) => !rowId.startsWith(FISH_PREFIX)),
    wire,
  };
}

export interface MultiFishingResult {
  sent: number;
  /** Per holder: candidates that holder's list contains. Attribution makes this per institution. */
  hitsByHolder: Record<string, string[]>;
  wire: WireEntry[];
}

export async function runMultiFishing(
  scenario: Scenario,
  options: { field: MatchField; candidates: readonly string[] },
  runOptions: RunOptions = {},
): Promise<MultiFishingResult> {
  const { field, candidates } = options;
  const parties = pad(multiPartyParties(scenario, field), candidates, field);
  const { results, wire } = await runInMemory(multiPartyPsi, parties, runOptions);
  const querier = results[parties[0]!.id] as MultiPsiQuerierOutput;
  const hitsByHolder: Record<string, string[]> = {};
  for (const [holderId, { matches }] of Object.entries(querier.perHolder)) {
    hitsByHolder[holderId] = hitsFrom(matches, candidates);
  }
  return { sent: querier.sentCount, hitsByHolder, wire };
}

/** Fraction of a holder's distinct (normalized) banlist entries that appear in `hits`. */
export function recoveryRate(
  scenario: Scenario,
  holderId: string,
  field: MatchField,
  hits: readonly string[],
): number {
  const holder = scenario.holders.find((h) => h.institution.id === holderId);
  if (!holder) throw new Error(`no holder ${holderId}`);
  const list = new Set(holder.records.map((r) => normalizeField(field, r[field])).filter((v) => v !== null));
  if (list.size === 0) return 0;
  const found = new Set(hits);
  return [...list].filter((v) => found.has(v)).length / list.size;
}
