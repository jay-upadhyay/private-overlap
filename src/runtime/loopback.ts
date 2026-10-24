import type { FromWorker, ToWorker } from './messages';
import { servePartyWorker } from './partyWorker';
import { PROTOCOLS, type ProtocolRegistry } from './registry';
import type { SpawnParty } from './relay';

/**
 * Runs each party's worker code on this thread behind a real MessageChannel, so messages are
 * structured-cloned and buffers transferred exactly as with Web Workers. For tests and for
 * environments without Worker.
 */
export function loopbackSpawn(registry: ProtocolRegistry = PROTOCOLS): SpawnParty {
  return () => {
    const channel = new MessageChannel();
    const worker = servePartyWorker(
      {
        post: (message, transfer) => channel.port2.postMessage(message, transfer),
        listen: (onMessage) => {
          channel.port2.onmessage = (event: MessageEvent<ToWorker>) => onMessage(event.data);
        },
      },
      registry,
    );
    return {
      post: (message, transfer) => channel.port1.postMessage(message, transfer),
      listen: (onMessage) => {
        channel.port1.onmessage = (event: MessageEvent<FromWorker>) => onMessage(event.data);
      },
      terminate: () => {
        worker.dispose();
        channel.port1.close();
        channel.port2.close();
      },
    };
  };
}
