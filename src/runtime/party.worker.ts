/// <reference lib="webworker" />
import type { ToWorker } from './messages';
import { servePartyWorker } from './partyWorker';
import { PROTOCOLS } from './registry';

// Entry point for one party's Web Worker.
servePartyWorker(
  {
    post: (message, transfer) => self.postMessage(message, { transfer }),
    listen: (onMessage) => {
      self.onmessage = (event: MessageEvent<ToWorker>) => onMessage(event.data);
    },
  },
  PROTOCOLS,
);
