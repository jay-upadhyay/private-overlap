// Stage 4: DP risk scores through a coordinator.
//
//   querier                     holder h                         coordinator
//   q_h <- random, one order π  k_h <- random
//   H(x)^q_h in order π  ---->
//                               (H(x)^q_h)^k_h, order π  ----------->
//                        <----  H(b)^k_h, shuffled
//   (H(b)^k_h)^q_h  ------------------------------------------------->
//                                                  for each position j: count holders whose set
//                                                  contains H(x_j)^(q_h k_h), add discrete Laplace
//                                                  noise (scale 1/ε), send the noisy counts
//   <-----------------------------------------------------------------  noisy count per position
//   map positions back through π; tier each customer.
//
// The querier never holds both doubly blinded sets, so it cannot compare them itself and learns
// neither which holder flagged a customer nor the exact count. Holders learn only how many points
// they re-blinded. The coordinator sees only doubly blinded points and positions, never
// identifiers; it must not collude with the querier or a holder (stated on the page).

import { bytesToHex, unpackFixed } from '../../crypto/bytes';
import { secureShuffle, secureSource, type RandomSource } from '../../crypto/random';
import {
  POINT_BYTES,
  encodePoint,
  hashToGroup,
  multiply,
  packPoints,
  randomScalar,
  unpackPoints,
} from '../../crypto/ristretto';
import type { MatchField } from '../../data/normalize';
import type { BanlistRecord, CustomerRecord, Scenario } from '../../data/scenario';
import { addNoise } from '../../dp/noise';
import { tierOf } from '../../dp/bounds';
import type { EpsilonInput } from '../../dp/rational';
import type { QuerierResult, RiskScore } from '../../protocol/screening';
import { ProtocolError, type PartyId, type PartySpec, type Protocol } from '../../protocol/types';
import { prepareSet } from '../psi/session';

export const DP_RISK_PROTOCOL_ID = 'dp-risk';

export const DP_MESSAGES = {
  blinded: 'dp/blinded',
  reblinded: 'dp/reblinded',
  holderSet: 'dp/holder-set',
  doubleBlindedHolderSet: 'dp/holder-set-qk',
  noisyCounts: 'dp/noisy-counts',
} as const;

export interface DpQuerierInput {
  kind: 'querier';
  field: MatchField;
  records: CustomerRecord[];
  holders: PartyId[];
  coordinator: PartyId;
}

export interface DpHolderInput {
  kind: 'holder';
  field: MatchField;
  records: BanlistRecord[];
  querier: PartyId;
  coordinator: PartyId;
}

export interface DpCoordinatorInput {
  kind: 'coordinator';
  querier: PartyId;
  holders: PartyId[];
  /** ε per released score. The page's ledger has already approved the spend. */
  epsilon: EpsilonInput;
}

export type DpRiskInput = DpQuerierInput | DpHolderInput | DpCoordinatorInput;

export type DpRiskResult =
  | QuerierResult
  | { kind: 'holder'; screened: number; skipped: string[] }
  | { kind: 'coordinator'; released: number };

export interface DpRiskOptions {
  /** Secret randomness; tests may inject a seeded source. */
  source?: RandomSource;
  /** Test only: release exact counts, to check the matching apart from the noise. */
  exactCounts?: boolean;
}

export const QUERIER = 'querier';
export const HOLDER = 'holder';
export const COORDINATOR = 'coordinator';

export function createDpRiskProtocol(options: DpRiskOptions = {}): Protocol<DpRiskInput, DpRiskResult> {
  const source = options.source ?? secureSource;
  return {
    id: DP_RISK_PROTOCOL_ID,
    roles: [QUERIER, HOLDER, COORDINATOR],
    async run(role, input, ctx) {
      if (role === QUERIER && input.kind === 'querier') {
        const set = prepareSet(input.records, input.field);
        const order = secureShuffle(
          Array.from({ length: set.values.length }, (_, i) => i),
          source,
        );
        const points = order.map((i) => hashToGroup(set.values[i]!));
        const scalars = input.holders.map(() => randomScalar(source));
        input.holders.forEach((h, i) =>
          ctx.send(h, DP_MESSAGES.blinded, packPoints(points.map((p) => multiply(p, scalars[i]!))), 1),
        );
        ctx.progress(0.3, `blinded ${points.length} customers for ${input.holders.length} institutions`);

        // In holder order, so the coordinator can pair each set with its re-blinded customers.
        for (const [i, h] of input.holders.entries()) {
          const theirs = unpackPoints(await ctx.receive<Uint8Array>(h, DP_MESSAGES.holderSet));
          const doubled = theirs.map((p) => multiply(p, scalars[i]!));
          ctx.send(input.coordinator, DP_MESSAGES.doubleBlindedHolderSet, packPoints(doubled), 3);
        }
        ctx.progress(0.7, 'forwarded blinded banlists to the coordinator');

        const counts = await ctx.receive<Int32Array>(input.coordinator, DP_MESSAGES.noisyCounts);
        if (counts.length !== order.length) {
          throw new ProtocolError(
            `coordinator returned ${counts.length} scores for ${order.length} customers`,
          );
        }
        const scores: Record<string, RiskScore> = {};
        order.forEach((valueIndex, j) => {
          const noisy = counts[j]!;
          for (const rowId of set.rowIds[valueIndex]!) scores[rowId] = { noisy, tier: tierOf(noisy) };
        });
        ctx.progress(1, 'scored');
        return { kind: 'querier', flaggedBy: {}, scores, skipped: set.skipped };
      }

      if (role === HOLDER && input.kind === 'holder') {
        const k = randomScalar(source);
        const incoming = unpackPoints(await ctx.receive<Uint8Array>(input.querier, DP_MESSAGES.blinded));
        ctx.send(
          input.coordinator,
          DP_MESSAGES.reblinded,
          packPoints(incoming.map((p) => multiply(p, k))),
          2,
        );
        const set = prepareSet(input.records, input.field);
        const own = secureShuffle(
          set.values.map((v) => multiply(hashToGroup(v), k)),
          source,
        );
        ctx.send(input.querier, DP_MESSAGES.holderSet, packPoints(own), 2);
        ctx.progress(1, `re-blinded ${incoming.length} points`);
        return { kind: 'holder', screened: incoming.length, skipped: set.skipped };
      }

      if (role === COORDINATOR && input.kind === 'coordinator') {
        let positions = -1;
        const counts: number[] = [];
        for (const h of input.holders) {
          const reblinded = unpackFixed(await ctx.receive<Uint8Array>(h, DP_MESSAGES.reblinded), POINT_BYTES);
          const listed = new Set(
            unpackPoints(
              await ctx.receive<Uint8Array>(input.querier, DP_MESSAGES.doubleBlindedHolderSet),
            ).map((p) => bytesToHex(encodePoint(p))),
          );
          if (positions === -1) {
            positions = reblinded.length;
            counts.push(...new Array<number>(positions).fill(0));
          } else if (reblinded.length !== positions) {
            throw new ProtocolError(`${h} re-blinded ${reblinded.length} points, expected ${positions}`);
          }
          reblinded.forEach((bytes, j) => {
            if (listed.has(bytesToHex(bytes))) counts[j]!++;
          });
        }
        const released = Int32Array.from(counts, (c) =>
          options.exactCounts ? c : addNoise(c, input.epsilon, source),
        );
        ctx.send(input.querier, DP_MESSAGES.noisyCounts, released, 4);
        ctx.progress(1, `released ${released.length} noisy scores`);
        return { kind: 'coordinator', released: released.length };
      }

      throw new ProtocolError(`role '${role}' does not match input kind '${input.kind}'`);
    },
  };
}

export const dpRiskProtocol = createDpRiskProtocol();

export const COORDINATOR_ID = 'coordinator';

/** Querier, every holder, and the coordinator, for one scored run over the scenario. */
export function dpRiskParties(
  scenario: Scenario,
  field: MatchField,
  epsilon: EpsilonInput,
): PartySpec<DpRiskInput>[] {
  const querier = scenario.querier.institution.id;
  const holders = scenario.holders.map((h) => h.institution.id);
  return [
    {
      id: querier,
      role: QUERIER,
      input: {
        kind: 'querier',
        field,
        records: scenario.querier.records,
        holders,
        coordinator: COORDINATOR_ID,
      },
    },
    ...scenario.holders.map((h) => ({
      id: h.institution.id,
      role: HOLDER,
      input: { kind: 'holder' as const, field, records: h.records, querier, coordinator: COORDINATOR_ID },
    })),
    { id: COORDINATOR_ID, role: COORDINATOR, input: { kind: 'coordinator', querier, holders, epsilon } },
  ];
}
