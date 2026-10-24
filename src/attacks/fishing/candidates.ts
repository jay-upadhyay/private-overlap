// How a fishing querier builds its candidate list.
//
// PSI tells the querier which of *its inputs* are on the banlist, and nothing stops it from
// inputting people who are not its customers. The attacker's candidates model a breach corpus:
// a leaked data-broker or exchange dump that covers most of the population the banlists are
// drawn from. The attacker does not know who in the corpus is banned; it only needs the corpus
// to contain them. Concretely, the corpus is
//   1. `coverage` of every distinct person on any holder's banlist in this synthetic world
//      (whether or not they are the querier's customers), taken as canonical identifiers, and
//   2. `decoys` people the attacker also has who are on no banlist, generated with the same
//      name and email-domain patterns (src/data/identity.ts) from an independent seed.
// The two parts are shuffled together, so nothing in the list marks the real entries.
// Recovery is then roughly `coverage`: PSI answers exactly, so the corpus is the only limit.

import { PersonFactory } from '../../data/identity';
import { normalizeField, type MatchField } from '../../data/normalize';
import { createRng, sample, shuffle } from '../../data/rng';
import type { Scenario } from '../../data/scenario';

export interface CandidateOptions {
  field: MatchField;
  /** Fraction of banlisted people the corpus contains. Default 0.9. */
  coverage?: number;
  /** People in the corpus who are on no banlist. Default 2,000; 50,000 is realistic but slow. */
  decoys?: number;
  /** Seed for the attacker's own (non-secret) sampling. Default 1. */
  seed?: number;
}

/** Distinct canonical identifiers of everyone on any of the scenario's banlists. */
export function banlistPopulation(scenario: Scenario, field: MatchField): string[] {
  const values = new Set<string>();
  for (const holder of scenario.holders) {
    for (const record of holder.records) {
      const value = normalizeField(field, record[field]);
      if (value !== null) values.add(value);
    }
  }
  return [...values];
}

/** The attacker's candidate identifiers (canonical form), shuffled. */
export function buildCandidates(scenario: Scenario, options: CandidateOptions): string[] {
  const { field, coverage = 0.9, decoys = 2_000, seed = 1 } = options;
  if (coverage < 0 || coverage > 1) throw new Error(`coverage ${coverage} is outside 0..1`);
  const rng = createRng(seed);
  const population = banlistPopulation(scenario, field);
  const known = sample(rng, population, Math.round(coverage * population.length));

  // Decoys come from an independent factory; skip the rare collision with a real person.
  const real = new Set(population);
  const factory = new PersonFactory(createRng(seed * 7919 + 17));
  const fake: string[] = [];
  while (fake.length < decoys) {
    const value = factory.create()[field];
    if (!real.has(value)) fake.push(value);
  }
  return shuffle(rng, [...known, ...fake]);
}
