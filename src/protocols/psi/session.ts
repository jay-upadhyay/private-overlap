// One Diffie–Hellman PSI session between the querier and one holder, on ristretto255.
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
import { extractIdentifiers } from '../../data/identifiers';
import type { MatchField } from '../../data/normalize';
import type { CustomerRecord } from '../../data/scenario';
import { ProtocolError, type PartyContext, type PartyId } from '../../protocol/types';

export const PSI_MESSAGES = {
  /** querier -> holder: H(x)^q, N×32 bytes. */
  blinded: 'psi/blinded',
  /** holder -> querier: H(x)^qk, same order, N×32 bytes. */
  reblinded: 'psi/reblinded',
  /** holder -> querier: H(b)^k, shuffled, M×32 bytes. */
  holderSet: 'psi/holder-set',
} as const;

export interface PreparedSet {
  /** Distinct normalized values. Duplicates are sent once so the other side cannot see them. */
  values: string[];
  /** values[i] -> rowIds that carry it. */
  rowIds: string[][];
  /** rowIds whose value failed normalization; they are not sent. */
  skipped: string[];
}

export function prepareSet(records: readonly CustomerRecord[], field: MatchField): PreparedSet {
  const ids = extractIdentifiers(records, field);
  const index = new Map<string, number>();
  const values: string[] = [];
  const rowIds: string[][] = [];
  ids.values.forEach((value, i) => {
    let at = index.get(value);
    if (at === undefined) {
      at = values.length;
      index.set(value, at);
      values.push(value);
      rowIds.push([]);
    }
    rowIds[at]!.push(ids.rowIds[i]!);
  });
  return { values, rowIds, skipped: ids.skipped };
}

function shuffledIndices(n: number, source: RandomSource): number[] {
  return secureShuffle(
    Array.from({ length: n }, (_, i) => i),
    source,
  );
}

/**
 * Querier side of one session. A fresh scalar and a fresh shuffle are drawn every call,
 * so two sessions (or two holders) see unlinkable points. Returns the matched rowIds.
 */
export async function querierSession(
  ctx: PartyContext,
  holder: PartyId,
  set: PreparedSet,
  source: RandomSource = secureSource,
): Promise<{ matched: Set<string>; holderSetSize: number }> {
  const q = randomScalar(source);
  const order = shuffledIndices(set.values.length, source);
  const blinded = order.map((i) => multiply(hashToGroup(set.values[i]!), q));
  ctx.send(holder, PSI_MESSAGES.blinded, packPoints(blinded), 1);
  ctx.progress(0.3, `blinded ${blinded.length} identifiers for ${holder}`);

  const reblinded = unpackFixed(await ctx.receive<Uint8Array>(holder, PSI_MESSAGES.reblinded), POINT_BYTES);
  if (reblinded.length !== blinded.length) {
    throw new ProtocolError(`${holder} returned ${reblinded.length} points for ${blinded.length} sent`);
  }
  const holderPoints = unpackPoints(await ctx.receive<Uint8Array>(holder, PSI_MESSAGES.holderSet));
  const holderKeys = new Set(holderPoints.map((p) => bytesToHex(encodePoint(multiply(p, q)))));
  ctx.progress(0.9, `compared against ${holderPoints.length} entries from ${holder}`);

  const matched = new Set<string>();
  reblinded.forEach((bytes, j) => {
    if (holderKeys.has(bytesToHex(bytes))) for (const rowId of set.rowIds[order[j]!]!) matched.add(rowId);
  });
  return { matched, holderSetSize: holderPoints.length };
}

/** Holder side of one session. Returns the number of points received. */
export async function holderSession(
  ctx: PartyContext,
  querier: PartyId,
  set: PreparedSet,
  source: RandomSource = secureSource,
): Promise<number> {
  const k = randomScalar(source);
  const incoming = unpackPoints(await ctx.receive<Uint8Array>(querier, PSI_MESSAGES.blinded));
  ctx.send(querier, PSI_MESSAGES.reblinded, packPoints(incoming.map((p) => multiply(p, k))), 2);
  ctx.progress(0.5, `re-blinded ${incoming.length} points from ${querier}`);

  const order = shuffledIndices(set.values.length, source);
  const own = order.map((i) => multiply(hashToGroup(set.values[i]!), k));
  ctx.send(querier, PSI_MESSAGES.holderSet, packPoints(own), 2);
  ctx.progress(1, `sent ${own.length} blinded banlist entries`);
  return incoming.length;
}
