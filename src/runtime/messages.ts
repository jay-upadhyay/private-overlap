import { ProtocolError, type Envelope, type PartyId } from '../protocol/types';

// What crosses the boundary between the main thread and a party worker. The worker gets
// its input once, at setup, and only ever posts back envelopes, progress and its outcome.

export interface SetupMessage {
  kind: 'setup';
  protocolId: string;
  partyId: PartyId;
  role: string;
  input: unknown;
}

export type ToWorker =
  SetupMessage | { kind: 'deliver'; envelope: Envelope } | { kind: 'cancel'; reason: SerializedError };

export type FromWorker =
  | { kind: 'send'; envelope: Envelope }
  | { kind: 'progress'; fraction: number; label?: string }
  | { kind: 'done'; output: unknown }
  | { kind: 'failed'; error: SerializedError };

export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
}

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error || error instanceof DOMException) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: 'Error', message: String(error) };
}

/** Rebuilds an error with its original class where the protocol code can test for it. */
export function deserializeError({ name, message, stack }: SerializedError): Error {
  if (name === 'AbortError') return new DOMException(message, name);
  const error = name === 'ProtocolError' ? new ProtocolError(message) : new Error(message);
  error.name = name;
  if (stack) error.stack = stack;
  return error;
}

const MAX_DEPTH = 4;

/** ArrayBuffers inside a payload (top level, arrays and plain objects), each listed once. */
export function transferables(payload: unknown): ArrayBuffer[] {
  const found = new Set<ArrayBuffer>();
  const visit = (value: unknown, depth: number) => {
    if (value instanceof ArrayBuffer) found.add(value);
    else if (ArrayBuffer.isView(value)) {
      if (value.buffer instanceof ArrayBuffer) found.add(value.buffer);
    } else if (depth < MAX_DEPTH && Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
    } else if (depth < MAX_DEPTH && value !== null && typeof value === 'object') {
      if (Object.getPrototypeOf(value) !== Object.prototype) return;
      for (const item of Object.values(value)) visit(item, depth + 1);
    }
  };
  visit(payload, 0);
  return [...found];
}
