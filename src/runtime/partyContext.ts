import { ProtocolError, type Envelope, type PartyContext, type PartyId } from '../protocol/types';

// The receive-side semantics of a PartyContext, independent of transport: one FIFO queue
// per sender, at most one pending receive per sender, abort rejects it, and a message of
// the wrong type is a ProtocolError. The worker runtime builds every party's context here.

interface Waiter {
  resolve: (envelope: Envelope) => void;
  reject: (error: unknown) => void;
}

export class Inbox {
  private readonly queues = new Map<PartyId, Envelope[]>();
  private readonly waiters = new Map<PartyId, Waiter>();

  push(envelope: Envelope) {
    const waiter = this.waiters.get(envelope.from);
    if (waiter) {
      this.waiters.delete(envelope.from);
      waiter.resolve(envelope);
    } else {
      const queue = this.queues.get(envelope.from) ?? [];
      queue.push(envelope);
      this.queues.set(envelope.from, queue);
    }
  }

  next(self: PartyId, from: PartyId, signal: AbortSignal): Promise<Envelope> {
    const queued = this.queues.get(from)?.shift();
    if (queued) return Promise.resolve(queued);
    if (signal.aborted) return Promise.reject(signal.reason);
    if (this.waiters.has(from)) {
      return Promise.reject(new ProtocolError(`${self} is already waiting for ${from}`));
    }
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        this.waiters.delete(from);
        reject(signal.reason);
      };
      signal.addEventListener('abort', onAbort, { once: true });
      this.waiters.set(from, {
        resolve: (envelope) => {
          signal.removeEventListener('abort', onAbort);
          resolve(envelope);
        },
        reject,
      });
    });
  }
}

export interface ContextTransport {
  /** Hands an outgoing envelope to the transport. The payload has not been copied yet. */
  post(envelope: Envelope): void;
  progress(fraction: number, label?: string): void;
}

export function createPartyContext(
  self: PartyId,
  signal: AbortSignal,
  inbox: Inbox,
  transport: ContextTransport,
): PartyContext {
  return {
    self,
    signal,
    send: (to, type, payload, round = 0) => {
      if (signal.aborted) throw signal.reason;
      transport.post({ from: self, to, type, round, payload });
    },
    receive: async <T>(from: PartyId, type: string) => {
      const envelope = await inbox.next(self, from, signal);
      if (envelope.type !== type) {
        throw new ProtocolError(`${self} expected '${type}' from ${from} but got '${envelope.type}'`);
      }
      return envelope.payload as T;
    },
    progress: (fraction, label) => transport.progress(fraction, label),
  };
}
