import { useEffect, useState } from 'react';

export type WorkerHealth = 'checking' | 'ready' | 'failed';

/** Round-trips one message through a module worker. */
export function useWorkerHealth(timeoutMs = 5000): WorkerHealth {
  const [health, setHealth] = useState<WorkerHealth>(() =>
    typeof Worker === 'undefined' ? 'failed' : 'checking',
  );

  useEffect(() => {
    if (typeof Worker === 'undefined') return;
    const worker = new Worker(new URL('./echo.worker.ts', import.meta.url), { type: 'module' });
    const timer = setTimeout(() => setHealth('failed'), timeoutMs);
    worker.onmessage = (event: MessageEvent<{ pong?: string }>) => {
      clearTimeout(timer);
      setHealth(event.data.pong === 'health' ? 'ready' : 'failed');
    };
    worker.onerror = () => {
      clearTimeout(timer);
      setHealth('failed');
    };
    worker.postMessage({ ping: 'health' });
    return () => {
      clearTimeout(timer);
      worker.terminate();
    };
  }, [timeoutMs]);

  return health;
}
