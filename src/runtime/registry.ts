import { dpRiskProtocol } from '../protocols/dprisk';
import { hashingProtocol } from '../protocols/hashing';
import { plaintextProtocol } from '../protocols/plaintext/plaintext';
import { multiPartyPsi, twoPartyPsi } from '../protocols/psi';
import type { PartySpec, Protocol } from '../protocol/types';

// Protocols a party worker can run, by id. Workers receive only the id, so every stage
// that runs in workers must be listed here.

export const PROTOCOLS = {
  plaintext: plaintextProtocol,
  hashing: hashingProtocol(),
  'psi-2p': twoPartyPsi,
  'psi-mp': multiPartyPsi,
  'dp-risk': dpRiskProtocol,
} satisfies Record<string, Protocol<never, unknown>>;

export type ProtocolRegistry = Readonly<Record<string, Protocol<never, unknown>>>;
export type ProtocolId = keyof typeof PROTOCOLS;
export type InputOf<K extends ProtocolId> =
  (typeof PROTOCOLS)[K] extends Protocol<infer I, unknown> ? I : never;
export type OutputOf<K extends ProtocolId> =
  (typeof PROTOCOLS)[K] extends Protocol<never, infer O> ? O : never;
export type PartiesOf<K extends ProtocolId> = readonly PartySpec<InputOf<K>>[];

export function getProtocol(registry: ProtocolRegistry, id: string): Protocol<never, unknown> {
  const protocol = Object.hasOwn(registry, id) ? registry[id] : undefined;
  if (!protocol) throw new Error(`unknown protocol '${id}'`);
  return protocol;
}
