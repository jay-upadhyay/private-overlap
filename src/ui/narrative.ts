import { extractIdentifiers } from '../data/identifiers';
import type { MatchField } from '../data/normalize';
import type { Scenario } from '../data/scenario';
import type { QuerierResult } from '../protocol/screening';
import type { WireEntry } from '../protocol/types';
import type { StageId } from '../stages';
import { formatBytes, formatPercent } from './format';
import { involvedHolders, tierMatchRate } from './results';

/**
 * The same measures for every stage, taken from one completed run, so stages can be compared
 * like for like. Everything here comes from the run itself or from ground truth.
 */
export interface RunFacts {
  stageId: StageId;
  querier: string;
  /** The holders this stage's protocol talked to (stage 2 uses only the first). */
  holders: string[];
  field: MatchField;
  customers: number;
  banlistEntries: number;
  /** Customers the querier now knows are flagged (stage 4: scored Review or High risk). */
  flaggedFound: number;
  /** Customers truly on at least one involved banlist. */
  flaggedTruth: number;
  /** Banned people who are not the querier's customers, handed to the querier in readable or hashed form. */
  nonCustomersExposed: number;
  /** One flagged customer and the institutions the querier learned flagged them. */
  attributionExample?: { customer: string; by: string[] };
  exact?: { correct: number; missed: number; extra: number };
  tiers?: { clear: number; review: number; high: number; accuracy: number; epsilon: number; cost: number };
  messages: number;
  bytes: number;
  durationMs: number;
}

export function runFacts(
  stageId: StageId,
  scenario: Scenario,
  field: MatchField,
  result: QuerierResult,
  wire: readonly WireEntry[],
  durationMs: number,
  epsilon: number,
  exact?: RunFacts['exact'],
): RunFacts {
  const involvedIds = new Set(involvedHolders(stageId, scenario));
  const involved = scenario.holders.filter((h) => involvedIds.has(h.institution.id));
  const names = new Map(scenario.holders.map((h) => [h.institution.id, h.institution.name]));
  const customerValues = new Set(extractIdentifiers(scenario.querier.records, field).values);
  const banned = new Set(involved.flatMap((h) => extractIdentifiers(h.records, field).values));
  const exposes = stageId === 'plaintext' || stageId === 'hashing';
  const flaggedTruth = Object.values(scenario.truth.flaggedBy).filter((by) =>
    by.some((h) => involvedIds.has(h)),
  ).length;

  let attributionExample: RunFacts['attributionExample'];
  if (!result.scores) {
    // The customer flagged by the most institutions shows attribution most clearly.
    const [rowId, by] = Object.entries(result.flaggedBy).sort((a, b) => b[1].length - a[1].length)[0] ?? [];
    const record = scenario.querier.records.find((r) => r.rowId === rowId);
    if (record && by) {
      attributionExample = {
        customer: `${record.firstName} ${record.lastName}`,
        by: by.map((h) => names.get(h) ?? h),
      };
    }
  }

  let tiers: RunFacts['tiers'];
  if (result.scores) {
    const counts = { clear: 0, review: 0, high: 0 };
    for (const s of Object.values(result.scores)) counts[s.tier]++;
    const scored = Object.keys(result.scores).length;
    tiers = { ...counts, accuracy: tierMatchRate(scenario, result.scores), epsilon, cost: scored * epsilon };
  }

  return {
    stageId,
    querier: scenario.querier.institution.name,
    holders: involved.map((h) => h.institution.name),
    field,
    customers: scenario.querier.records.length,
    banlistEntries: involved.reduce((n, h) => n + h.records.length, 0),
    flaggedFound: tiers ? tiers.review + tiers.high : Object.keys(result.flaggedBy).length,
    flaggedTruth,
    nonCustomersExposed: exposes ? [...banned].filter((v) => !customerValues.has(v)).length : 0,
    attributionExample,
    exact,
    tiers,
    messages: wire.length,
    bytes: wire.reduce((n, e) => n + e.bytes, 0),
    durationMs,
  };
}

const n = (x: number) => x.toLocaleString();
const list = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

/** A plain account of what just happened, one sentence per step. */
export function describeRun(f: RunFacts): string[] {
  const wire = `${n(f.messages)} messages, ${formatBytes(f.bytes)}, ${(f.durationMs / 1000).toFixed(1)} s`;
  const found = `${f.querier} found ${n(f.flaggedFound)} of its ${n(f.customers)} customers on a banlist (ground truth: ${n(f.flaggedTruth)}).`;
  const attribution = f.attributionExample
    ? `For each one it also knows who flagged them, for example ${f.attributionExample.customer}: ${list(f.attributionExample.by)}.`
    : '';
  switch (f.stageId) {
    case 'plaintext':
      return [
        `${list(f.holders)} sent their banlists, ${n(f.banlistEntries)} ${f.field} entries in readable form, to ${f.querier} (${wire}).`,
        found,
        `${f.querier} now also holds ${n(f.nonCustomersExposed)} banned people who were never its customers. ${list(f.holders)} learned nothing about ${f.querier}'s customers.`,
      ];
    case 'hashing':
      return [
        `Both sides normalized each ${f.field} and hashed it with SHA-256. ${list(f.holders)} sent ${n(f.banlistEntries)} banlist hashes and ${f.querier} sent ${n(f.customers)} customer hashes per holder (${wire}).`,
        found,
        `No identifier crossed the wire readably, but ${f.querier} holds hashes of ${n(f.nonCustomersExposed)} banned non-customers, and each holder holds hashes of all ${n(f.customers)} customers. Anyone can check a guessed identifier against them.`,
      ];
    case 'psi':
      return [
        `${f.querier} blinded its ${n(f.customers)} customers with a secret exponent and sent the points to ${list(f.holders)}, which raised them to its own secret and sent them back together with its ${n(f.banlistEntries)} blinded banlist entries (${wire}).`,
        found,
        `${list(f.holders)} learned only that ${n(f.customers)} values were screened. The banned people who are not ${f.querier}'s customers stayed hidden: nothing on the wire can be matched to an identifier without the secrets.`,
      ];
    case 'multi-psi':
      return [
        `${f.querier} ran a separate blinded session with each of ${f.holders.length} institutions, with fresh secrets each time (${wire}).`,
        `${found} ${attribution}`.trim(),
        `Each institution learned only how many values were screened, and banned non-customers stayed hidden everywhere. What leaks is attribution: which institution flagged each customer.`,
      ];
    case 'dp-risk': {
      const t = f.tiers!;
      return [
        `The ${f.holders.length} institutions re-blinded ${f.querier}'s points and sent them to a coordinator, which counted matches per customer, added noise at ε ${t.epsilon} per score, and returned only noisy counts (${wire}).`,
        `${f.querier} received ${n(f.customers)} risk tiers: ${n(t.high)} High risk, ${n(t.review)} Review, ${n(t.clear)} Clear. ${formatPercent(t.accuracy)} match the tier of the exact count; ${n(f.flaggedTruth)} customers are truly flagged.`,
        `No institution is named and no exact count is revealed. The run cost ε ${n(t.cost)} of the privacy budget.`,
      ];
    }
  }
}
