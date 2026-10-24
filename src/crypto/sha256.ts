import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from './bytes';

// Identifier hashing as consortiums commonly do it: SHA-256 of the normalized value,
// with no salt, so anyone who can guess an identifier can recompute its hash.

export const HASH_BYTES = 32;

export function hashIdentifier(normalized: string): Uint8Array {
  return sha256(utf8ToBytes(normalized));
}

/** Keyed variant: only holders of `key` can recompute it. */
export function hmacIdentifier(key: Uint8Array, normalized: string): Uint8Array {
  return hmac(sha256, key, utf8ToBytes(normalized));
}
