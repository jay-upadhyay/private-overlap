import { PersonFactory, type Person } from './identity';
import { noisyEmail, noisyPhone, noisyWallet } from './noise';
import { createRng, sample, shuffle, type Rng } from './rng';

export type InstitutionKind = 'exchange' | 'broker' | 'bank';
export type BanReason = 'fraud' | 'chargeback-abuse' | 'aml-hold' | 'sanctions-match';

export interface Institution {
  id: string;
  name: string;
  kind: InstitutionKind;
}

/** A row as an institution stores it: identifiers may carry formatting noise. */
export interface CustomerRecord {
  rowId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  wallet: string;
}

export interface BanlistRecord extends CustomerRecord {
  reason: BanReason;
  listedOn: string;
}

export interface ScenarioConfig {
  seed: number;
  querier: Institution & { customers: number };
  holders: (Institution & { banlistSize: number })[];
  /** Entry k-1 is the fraction of the querier's customers flagged by exactly k holders. */
  flaggedByCount: number[];
  /** 0..1: how much the non-customer part of each banlist is shared with other holders. Default 0.3. */
  outsiderOverlap?: number;
  /** Probability that each stored identifier is reformatted. Default 0.5. */
  noiseRate?: number;
}

/** Known answers, kept apart from the parties' data. Only tests and god view read it. */
export interface GroundTruth {
  /** Aligned with querier.records. */
  querierPersonIds: string[];
  /** Per holder id, aligned with that holder's records. */
  holderPersonIds: Record<string, string[]>;
  /** Querier rowId -> ids of holders that list that customer. Only flagged customers appear. */
  flaggedBy: Record<string, string[]>;
}

export interface Scenario {
  config: ScenarioConfig;
  querier: { institution: Institution; records: CustomerRecord[] };
  holders: { institution: Institution; records: BanlistRecord[] }[];
  truth: GroundTruth;
}

const REASONS: readonly BanReason[] = [
  'fraud',
  'fraud',
  'fraud',
  'fraud',
  'chargeback-abuse',
  'chargeback-abuse',
  'aml-hold',
  'aml-hold',
  'aml-hold',
  'sanctions-match',
];

function toRecord(rng: Rng, person: Person, rowId: string, noiseRate: number): CustomerRecord {
  return {
    rowId,
    firstName: person.firstName,
    lastName: person.lastName,
    email: rng.chance(noiseRate) ? noisyEmail(rng, person.email) : person.email,
    phone: rng.chance(noiseRate) ? noisyPhone(rng, person.phone) : person.phone,
    dob: person.dob,
    wallet: rng.chance(noiseRate) ? noisyWallet(rng, person.wallet) : person.wallet,
  };
}

function listedOn(rng: Rng): string {
  const year = 2023 + rng.int(4);
  const month = String(1 + rng.int(12)).padStart(2, '0');
  const day = String(1 + rng.int(28)).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function validateConfig(config: ScenarioConfig): void {
  const { querier, holders, flaggedByCount } = config;
  if (querier.customers < 1) throw new Error('querier needs at least one customer');
  if (holders.length < 1) throw new Error('at least one banlist holder is required');
  if (flaggedByCount.length > holders.length) {
    throw new Error(`flaggedByCount has ${flaggedByCount.length} entries but only ${holders.length} holders`);
  }
  if (flaggedByCount.some((f) => f < 0)) throw new Error('flaggedByCount fractions must be non-negative');
  const total = flaggedByCount.reduce((a, b) => a + b, 0);
  if (total > 1 + 1e-9) throw new Error(`flaggedByCount sums to ${total}, more than 1`);
  const ids = new Set([querier.id, ...holders.map((h) => h.id)]);
  if (ids.size !== holders.length + 1) throw new Error('institution ids must be unique');
}

/** Number of customers flagged by exactly k holders, for k = 1..flaggedByCount.length. */
export function flaggedCounts(config: ScenarioConfig): number[] {
  return config.flaggedByCount.map((f) => Math.round(f * config.querier.customers));
}

export function buildScenario(config: ScenarioConfig): Scenario {
  validateConfig(config);
  const rng = createRng(config.seed);
  const factory = new PersonFactory(rng);
  const noiseRate = config.noiseRate ?? 0.5;
  const overlap = config.outsiderOverlap ?? 0.3;
  const holderIds = config.holders.map((h) => h.id);

  const customers = Array.from({ length: config.querier.customers }, () => factory.create());

  // Decide which customers each holder lists: exactly k holders for customers in bucket k.
  const assigned = new Map<string, Person[]>(holderIds.map((id) => [id, []]));
  const order = shuffle(
    rng,
    customers.map((_, i) => i),
  );
  let cursor = 0;
  flaggedCounts(config).forEach((count, i) => {
    for (let n = 0; n < count; n++) {
      const person = customers[order[cursor++]!]!;
      for (const holderId of sample(rng, holderIds, i + 1)) assigned.get(holderId)!.push(person);
    }
  });
  if (cursor > customers.length) throw new Error('flagged counts exceed the number of customers');

  // Fill each banlist with people who are not the querier's customers, partly shared between holders.
  const fills = config.holders.map((h) => {
    const need = h.banlistSize - assigned.get(h.id)!.length;
    if (need < 0) throw new Error(`banlist ${h.id} is smaller than the customers assigned to it`);
    return need;
  });
  const maxFill = Math.max(0, ...fills);
  const sumFill = fills.reduce((a, b) => a + b, 0);
  const poolSize = maxFill + Math.round((sumFill - maxFill) * (1 - overlap));
  const outsiders = Array.from({ length: poolSize }, () => factory.create());

  const holderPersonIds: Record<string, string[]> = {};
  const holders = config.holders.map((h, i) => {
    const people = shuffle(rng, [...assigned.get(h.id)!, ...sample(rng, outsiders, fills[i]!)]);
    holderPersonIds[h.id] = people.map((p) => p.personId);
    const records: BanlistRecord[] = people.map((p, r) => ({
      ...toRecord(rng, p, `${h.id}-r${r}`, noiseRate),
      reason: rng.pick(REASONS),
      listedOn: listedOn(rng),
    }));
    return { institution: { id: h.id, name: h.name, kind: h.kind }, records };
  });

  const querierRecords = customers.map((p, i) => toRecord(rng, p, `${config.querier.id}-c${i}`, noiseRate));

  const assignedIds = new Map(holderIds.map((id) => [id, new Set(assigned.get(id)!.map((p) => p.personId))]));
  const flaggedBy: Record<string, string[]> = {};
  customers.forEach((person, i) => {
    const by = holderIds.filter((id) => assignedIds.get(id)!.has(person.personId));
    if (by.length > 0) flaggedBy[querierRecords[i]!.rowId] = by;
  });

  const { id, name, kind } = config.querier;
  return {
    config,
    querier: { institution: { id, name, kind }, records: querierRecords },
    holders,
    truth: { querierPersonIds: customers.map((p) => p.personId), holderPersonIds, flaggedBy },
  };
}

/** Querier rowIds that a holder lists, from ground truth. */
export function truthMatches(scenario: Scenario, holderId: string): Set<string> {
  return new Set(
    Object.entries(scenario.truth.flaggedBy)
      .filter(([, by]) => by.includes(holderId))
      .map(([rowId]) => rowId),
  );
}
