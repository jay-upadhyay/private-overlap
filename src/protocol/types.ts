// The contract every stage's protocol implements. Protocol code only sees a PartyContext,
// so the same code runs on the in-memory channel (tests) and across Web Workers (P2).

export type PartyId = string;

export interface Envelope<T = unknown> {
  from: PartyId;
  to: PartyId;
  type: string;
  round: number;
  payload: T;
}

/** One line in the wire inspector: what an eavesdropper on the channel would see. */
export interface WireEntry {
  seq: number;
  from: PartyId;
  to: PartyId;
  type: string;
  round: number;
  bytes: number;
  preview: string;
}

export interface Progress {
  party: PartyId;
  fraction: number;
  label?: string;
}

export interface PartyContext {
  readonly self: PartyId;
  readonly signal: AbortSignal;
  send<T>(to: PartyId, type: string, payload: T, round?: number): void;
  /** Next message from `from`. Messages on a link arrive in send order; a different type is a protocol error. */
  receive<T>(from: PartyId, type: string): Promise<T>;
  progress(fraction: number, label?: string): void;
}

export interface Protocol<I = unknown, O = unknown> {
  id: string;
  roles: readonly string[];
  run(role: string, input: I, ctx: PartyContext): Promise<O>;
}

export interface PartySpec<I = unknown> {
  id: PartyId;
  role: string;
  input: I;
}

export class ProtocolError extends Error {
  override name = 'ProtocolError';
}
