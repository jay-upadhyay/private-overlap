// Stage 2: two-party Diffie–Hellman PSI on ristretto255.
//
//   querier                                   holder
//   q <- random scalar                        k <- random scalar
//   H(x)^q for each customer, shuffled  --->
//                                       <---  (H(x)^q)^k in the same order
//                                       <---  H(b)^k for each banlist entry, shuffled
//   (H(b)^k)^q; a customer is flagged when H(x)^qk equals some H(b)^kq.
//
// The querier learns which of its customers are on the list and the list's size. The holder
// learns only how many customers were sent. Neither side sees the other's plaintext or hashes.

import type { MatchField } from '../../data/normalize';
import { ProtocolError, type PartyContext, type PartyId, type Protocol } from '../../protocol/types';
import {
  encodePoint,
  hashToGroup,
  multiply,
  packPoints,
  randomScalar,
  securePermutation,
  splitPoints,
  toHex,
  unpackPoints,
} from '../../crypto';
import { prepareSet, type IdentifierRecord, type PreparedSet, type SkippedRecord } from './prepare';

export const PSI_MESSAGES = {
  /** querier -> holder: H(x)^q, N×32 bytes. */
  blinded: 'psi/blinded',
  /** holder -> querier: H(x)^qk, same order, N×32 bytes. */
  reblinded: 'psi/reblinded',
  /** holder -> querier: H(b)^k, shuffled, M×32 bytes. */
  holderSet: 'psi/holder-set',
} as const;

export interface PsiQuerierInput {
  field: MatchField;
  records: readonly IdentifierRecord[];
  /** Party id of the holder to run against. */
  holder: PartyId;
}

export interface PsiHolderInput {
  field: MatchField;
  records: readonly IdentifierRecord[];
  /** Party id of the querier it answers. */
  querier: PartyId;
}

export type PsiInput = PsiQuerierInput | PsiHolderInput;

export interface PsiQuerierOutput {
  role: 'querier';
  /** rowIds of flagged customers, in input order. */
  matches: string[];
  /** Customers whose identifier did not normalize; they were not sent. */
  skipped: SkippedRecord[];
  /** Distinct identifiers sent to the holder. */
  sentCount: number;
  /** Distinct banlist entries the holder sent: the one thing the querier learns besides the matches. */
  holderSetSize: number;
}

export interface PsiHolderOutput {
  role: 'holder';
  /** The only thing the holder learns about the querier. */
  receivedCount: number;
  /** Banlist entries whose identifier did not normalize; they were not sent. */
  skipped: SkippedRecord[];
}

export type PsiOutput = PsiQuerierOutput | PsiHolderOutput;

/**
 * Querier side of one PSI session. A fresh scalar and a fresh shuffle are drawn every call,
 * so two sessions (or two holders) see unlinkable points. Returns the matched rowIds.
 */
export async function querierSession(
  ctx: PartyContext,
  holder: PartyId,
  set: PreparedSet,
): Promise<{ matched: Set<string>; holderSetSize: number }> {
  const q = randomScalar();
  const order = securePermutation(set.values.length);
  const blinded = order.map((i) => multiply(hashToGroup(set.values[i]!), q));
  ctx.send(holder, PSI_MESSAGES.blinded, packPoints(blinded), 1);
  ctx.progress(0.3, `blinded ${blinded.length} identifiers for ${holder}`);

  const reblinded = splitPoints(await ctx.receive<Uint8Array>(holder, PSI_MESSAGES.reblinded));
  if (reblinded.length !== blinded.length) {
    throw new ProtocolError(`${holder} returned ${reblinded.length} points for ${blinded.length} sent`);
  }
  const holderPoints = unpackPoints(await ctx.receive<Uint8Array>(holder, PSI_MESSAGES.holderSet));
  const holderKeys = new Set(holderPoints.map((p) => toHex(encodePoint(multiply(p, q)))));
  ctx.progress(0.9, `compared against ${holderPoints.length} entries from ${holder}`);

  const matched = new Set<string>();
  reblinded.forEach((bytes, j) => {
    if (holderKeys.has(toHex(bytes))) for (const rowId of set.rowIds[order[j]!]!) matched.add(rowId);
  });
  return { matched, holderSetSize: holderPoints.length };
}

/** Holder side of one PSI session. Returns the number of points received. */
export async function holderSession(ctx: PartyContext, querier: PartyId, set: PreparedSet): Promise<number> {
  const k = randomScalar();
  const incoming = unpackPoints(await ctx.receive<Uint8Array>(querier, PSI_MESSAGES.blinded));
  ctx.send(querier, PSI_MESSAGES.reblinded, packPoints(incoming.map((p) => multiply(p, k))), 2);
  ctx.progress(0.5, `re-blinded ${incoming.length} points from ${querier}`);

  const order = securePermutation(set.values.length);
  const own = order.map((i) => multiply(hashToGroup(set.values[i]!), k));
  ctx.send(querier, PSI_MESSAGES.holderSet, packPoints(own), 2);
  ctx.progress(1, `sent ${own.length} blinded banlist entries`);
  return incoming.length;
}

export async function runHolder(input: PsiHolderInput, ctx: PartyContext): Promise<PsiHolderOutput> {
  const set = prepareSet(input.records, input.field);
  const receivedCount = await holderSession(ctx, input.querier, set);
  return { role: 'holder', receivedCount, skipped: set.skipped };
}

export const twoPartyPsi: Protocol<PsiInput, PsiOutput> = {
  id: 'psi-2p',
  roles: ['querier', 'holder'],
  async run(role, input, ctx) {
    if (role === 'holder') return runHolder(input as PsiHolderInput, ctx);
    const { records, field, holder } = input as PsiQuerierInput;
    const set = prepareSet(records, field);
    const { matched, holderSetSize } = await querierSession(ctx, holder, set);
    ctx.progress(1, `${matched.size} flagged`);
    return {
      role: 'querier',
      matches: records.filter((r) => matched.has(r.rowId)).map((r) => r.rowId),
      skipped: set.skipped,
      sentCount: set.values.length,
      holderSetSize,
    };
  },
};
