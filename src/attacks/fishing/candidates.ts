// How a fishing querier builds its candidate list.
//
// PSI tells the querier which of *its inputs* are on the banlist, and nothing stops it from
// inputting people who are not its customers. The candidates model a breach corpus
// (src/attacks/candidates.ts): a leaked data-broker or exchange dump that covers most of the
// population the banlists are drawn from. Here the population is every distinct person on any
// holder's banlist, whether or not they are the querier's customers. The attacker does not know
// who in the corpus is banned, only that the corpus covers `coverage` of those people. Decoys are
// people from the same generator who are on no list. Real entries and decoys are shuffled
// together, so nothing in the list marks the real ones.
// Recovery is then about `coverage`: PSI answers exactly, so the corpus is the only limit.
// Pattern enumeration (emailPatternCandidates) does not work here: phones and wallets are random,
// and even emails span millions of patterns, about a second per thousand in this PSI.

import { breachCorpus } from '../candidates';
import { extractIdentifiers } from '../../data/identifiers';
import type { MatchField } from '../../data/normalize';
import type { Scenario } from '../../data/scenario';

export interface FishingCandidateOptions {
  field: MatchField;
  /** Share of banlisted people the corpus contains. Default 0.9. */
  coverage?: number;
  /** People in the corpus who are on no banlist. Default 2,000; 50,000 is realistic but slow. */
  decoys?: number;
  /** Seed for the attacker's own (non-secret) sampling. Default 1. */
  seed?: number;
}

/** Distinct normalized values of everyone on any of the scenario's banlists. */
export function banlistPopulation(scenario: Scenario, field: MatchField): string[] {
  return [...new Set(scenario.holders.flatMap((h) => extractIdentifiers(h.records, field).values))];
}

/** The attacker's candidate identifiers (normalized), shuffled. */
export function fishingCandidates(scenario: Scenario, options: FishingCandidateOptions): string[] {
  const { field, coverage = 0.9, decoys = 2_000, seed = 1 } = options;
  return breachCorpus(banlistPopulation(scenario, field), field, { coverage, decoys, seed });
}
