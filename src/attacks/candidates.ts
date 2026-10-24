import {
  emailBases,
  emailSeparators,
  EMAIL_NUMBER_SUFFIX_MAX,
  EMAIL_YEAR_SUFFIX_RANGE,
  PersonFactory,
} from '../data/identity';
import { EMAIL_DOMAINS, FIRST_NAMES, LAST_NAMES } from '../data/names';
import type { MatchField } from '../data/normalize';
import { createRng, sample } from '../data/rng';

// Candidate identities an attacker can test: the input to the dictionary attack
// (stage 1) and to fishing (stages 2-3). Two models of attacker knowledge:
//  - pattern enumeration: public name lists x common email patterns, no outside data;
//  - a breach corpus: a leaked or purchased list that covers part of the population.

export interface EmailPatternOptions {
  /** Append 0-99 to each base. Multiplies the space by about 100. */
  numberSuffixes?: boolean;
  /** Append birth-year-like 1950-2005. Multiplies the space by about 56. */
  yearSuffixes?: boolean;
}

/** Canonical (normalized) emails the generator could produce, without duplicates. */
export function* emailPatternCandidates(options: EmailPatternOptions = {}): Generator<string> {
  const suffixes = [''];
  if (options.numberSuffixes) for (let n = 0; n < EMAIL_NUMBER_SUFFIX_MAX; n++) suffixes.push(String(n));
  if (options.yearSuffixes) {
    for (let y = EMAIL_YEAR_SUFFIX_RANGE[0]; y <= EMAIL_YEAR_SUFFIX_RANGE[1]; y++) suffixes.push(String(y));
  }
  for (const domain of new Set(EMAIL_DOMAINS)) {
    const seen = new Set<string>();
    for (const first of FIRST_NAMES) {
      for (const last of LAST_NAMES) {
        for (const sep of emailSeparators(domain)) {
          for (const base of emailBases(first, last, sep)) {
            for (const suffix of suffixes) {
              const local = base + suffix;
              if (seen.has(local)) continue;
              seen.add(local);
              yield `${local}@${domain}`;
            }
          }
        }
      }
    }
  }
}

/**
 * Every North American number under the given prefixes, in canonical E.164 form.
 * A prefix is 3 digits (area code: 8 million numbers, exchanges 200-999) or 6 digits
 * (area code + exchange: 10,000 numbers).
 */
export function* phoneRangeCandidates(prefixes: readonly string[]): Generator<string> {
  for (const prefix of prefixes) {
    if (!/^[2-9]\d{2}(?:[2-9]\d{2})?$/.test(prefix)) throw new RangeError(`bad phone prefix ${prefix}`);
    const exchanges =
      prefix.length === 6 ? [prefix.slice(3)] : Array.from({ length: 800 }, (_, i) => String(200 + i));
    for (const exchange of exchanges) {
      for (let line = 0; line < 10_000; line++) {
        yield `+1${prefix.slice(0, 3)}${exchange}${String(line).padStart(4, '0')}`;
      }
    }
  }
}

export interface BreachCorpusOptions {
  /** Share of `population` the leaked list contains, 0..1. */
  coverage: number;
  /** Extra identities in the list that belong to nobody in the scenario. */
  decoys: number;
  seed: number;
}

/**
 * A leaked list: part of the real population plus unrelated identities, shuffled.
 * `population` is everyone the outside world could know about (normalized values),
 * not any one institution's private list.
 */
export function breachCorpus(
  population: readonly string[],
  field: MatchField,
  options: BreachCorpusOptions,
): string[] {
  const rng = createRng(options.seed);
  const known = sample(rng, population, Math.round(options.coverage * population.length));
  // Decoys are fresh people from a separate seed; any that happen to collide with
  // the population are dropped so coverage stays exact.
  const inPopulation = new Set(population);
  const factory = new PersonFactory(createRng(options.seed ^ 0x5eed));
  const decoys: string[] = [];
  while (decoys.length < options.decoys) {
    const value = factory.create()[field];
    if (!inPopulation.has(value)) decoys.push(value);
  }
  return sample(rng, [...known, ...decoys], known.length + decoys.length);
}
