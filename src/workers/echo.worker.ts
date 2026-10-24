/// <reference lib="webworker" />

// Health-check worker: proves module workers load from the deployed base path.
self.onmessage = (event: MessageEvent<{ ping: string }>) => {
  self.postMessage({ pong: event.data.ping });
};
