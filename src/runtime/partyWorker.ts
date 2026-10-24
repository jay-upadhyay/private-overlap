import type { Envelope } from '../protocol/types';
import {
  deserializeError,
  serializeError,
  transferables,
  type FromWorker,
  type SetupMessage,
  type ToWorker,
} from './messages';
import { createPartyContext, Inbox } from './partyContext';
import { getProtocol, type ProtocolRegistry } from './registry';

/** The worker's side of its link to the main thread. */
export interface WorkerEndpoint {
  post(message: FromWorker, transfer: Transferable[]): void;
  listen(onMessage: (message: ToWorker) => void): void;
}

/**
 * Runs one party of a protocol. The input arrives once, in the setup message, and never
 * leaves: the worker posts back only envelopes it sends, progress and its outcome.
 */
export function servePartyWorker(endpoint: WorkerEndpoint, registry: ProtocolRegistry): { dispose(): void } {
  const controller = new AbortController();
  const inbox = new Inbox();
  let started = false;

  const post = (message: FromWorker, payload?: unknown) => {
    try {
      endpoint.post(message, payload === undefined ? [] : transferables(payload));
    } catch (error) {
      // For example a DataCloneError: report it rather than leave the run hanging.
      endpoint.post({ kind: 'failed', error: serializeError(error) }, []);
    }
  };

  const sendEnvelope = (envelope: Envelope) => {
    // Copy binary payloads before transferring them, so the sender keeps its buffers, as on
    // the in-memory channel. Other payloads are copied by postMessage itself.
    const owned = transferables(envelope.payload).length > 0;
    const payload = owned ? structuredClone(envelope.payload) : envelope.payload;
    endpoint.post({ kind: 'send', envelope: { ...envelope, payload } }, owned ? transferables(payload) : []);
  };

  const start = async (setup: SetupMessage) => {
    if (started) throw new Error(`party ${setup.partyId} was set up twice`);
    started = true;
    const protocol = getProtocol(registry, setup.protocolId);
    if (!protocol.roles.includes(setup.role)) {
      throw new Error(`protocol ${setup.protocolId} has no role '${setup.role}'`);
    }
    const ctx = createPartyContext(setup.partyId, controller.signal, inbox, {
      post: sendEnvelope,
      progress: (fraction, label) => post({ kind: 'progress', fraction, label }),
    });
    return protocol.run(setup.role, setup.input as never, ctx);
  };

  endpoint.listen((message) => {
    switch (message.kind) {
      case 'setup':
        start(message).then(
          (output) => post({ kind: 'done', output }, output),
          (error: unknown) => post({ kind: 'failed', error: serializeError(error) }),
        );
        break;
      case 'deliver':
        inbox.push(message.envelope);
        break;
      case 'cancel':
        controller.abort(deserializeError(message.reason));
        break;
    }
  });

  return { dispose: () => controller.abort(new DOMException('Worker disposed', 'AbortError')) };
}
