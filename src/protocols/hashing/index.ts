import { bytesToHex, packFixed, unpackFixed } from '../../crypto/bytes';
import { hashIdentifier, hmacIdentifier, HASH_BYTES } from '../../crypto/sha256';
import { extractIdentifiers } from '../../data/identifiers';
import {
  HOLDER_ROLE,
  QUERIER_ROLE,
  type QuerierResult,
  type ScreeningProtocol,
} from '../../protocol/screening';
import type { PartyId } from '../../protocol/types';

// Stage 1: hashed matching. Every party normalizes its identifiers, hashes them with
// unsalted SHA-256 (or HMAC-SHA-256 under a key all members share) and sends the batch
// as one N×32-byte buffer.
//
// Both directions carry hashes, as the phase doc says "each party sends SHA-256":
//  - each holder sends its hashed banlist to the querier, which intersects locally;
//  - the querier sends its hashed customer list to each holder.
// So the holder learns the querier's hashed customers too. That is deliberate: it is
// what consortiums that "just hash" actually do, and it means an attacker on either
// side (or on the wire) holds a set of unsalted hashes. Holders only report how many
// hashes they received; they do not compute the intersection themselves.

export const HASHING_PROTOCOL_ID = 'hashing';

export const MSG_BANLIST = 'banlist-hashes';
export const MSG_CUSTOMERS = 'customer-hashes';

export interface HashingOptions {
  /** Switch to HMAC-SHA-256 with a key every member shares; outsiders cannot recompute it. */
  keyed?: { key: Uint8Array };
}

/** The hash each party applies to a normalized identifier under these options. */
export function identifierHasher(options: HashingOptions = {}): (normalized: string) => Uint8Array {
  const key = options.keyed?.key;
  return key ? (value) => hmacIdentifier(key, value) : hashIdentifier;
}

export function hashingProtocol(options: HashingOptions = {}): ScreeningProtocol {
  const hash = identifierHasher(options);
  return {
    id: options.keyed ? `${HASHING_PROTOCOL_ID}-hmac` : HASHING_PROTOCOL_ID,
    roles: [QUERIER_ROLE, HOLDER_ROLE],
    async run(role, input, ctx) {
      const ids = extractIdentifiers(input.records, input.field);
      const hashes = ids.values.map(hash);
      ctx.progress(0.5, 'hashed');

      if (role === QUERIER_ROLE && input.kind === 'querier') {
        const packed = packFixed(hashes, HASH_BYTES);
        for (const holder of input.holders) ctx.send(holder, MSG_CUSTOMERS, packed, 1);

        const hex = hashes.map(bytesToHex);
        const flaggedBy: QuerierResult['flaggedBy'] = {};
        for (const holder of input.holders) {
          const received = await ctx.receive<Uint8Array>(holder, MSG_BANLIST);
          const banned = new Set(unpackFixed(received, HASH_BYTES).map(bytesToHex));
          hex.forEach((h, i) => {
            if (banned.has(h)) (flaggedBy[ids.rowIds[i]!] ??= [] as PartyId[]).push(holder);
          });
        }
        ctx.progress(1, 'intersected');
        return { kind: 'querier', flaggedBy, skipped: ids.skipped };
      }

      if (role === HOLDER_ROLE && input.kind === 'holder') {
        ctx.send(input.querier, MSG_BANLIST, packFixed(hashes, HASH_BYTES), 1);
        const received = await ctx.receive<Uint8Array>(input.querier, MSG_CUSTOMERS);
        ctx.progress(1, 'sent');
        return { kind: 'holder', screened: received.length / HASH_BYTES, skipped: ids.skipped };
      }

      throw new Error(`role '${role}' does not match input kind '${input.kind}'`);
    },
  };
}
