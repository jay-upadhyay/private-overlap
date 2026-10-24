import { expect, test, type Page } from '@playwright/test';
import type { WireEntry } from '../src/protocol/types';
import type { HarnessOutcome } from '../src/runtime/harness/main';

// Real Web Workers in the built app, served under the Pages subpath. The harness page
// exposes window.runtimeHarness (src/runtime/harness/main.ts).

async function openHarness(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('./harness/runtime.html');
  await expect(page.locator('#status')).toHaveText('ready');
  return errors;
}

const shape = (wire: WireEntry[]) =>
  wire
    .map(({ from, to, type, round, bytes, preview }) => [from, to, type, round, bytes, preview].join('|'))
    .sort();

test('plaintext_run_in_workers', async ({ page }) => {
  await openHarness(page);
  const [memory, workers] = await page.evaluate(() =>
    Promise.all([
      window.runtimeHarness!.inMemory('portfolio', 'email'),
      window.runtimeHarness!.inWorkers('portfolio', 'email'),
    ]),
  );
  expect(workers.error).toBeUndefined();
  expect(workers.results).toEqual(memory.results);
  expect(workers).toMatchObject({ ok: true, spawned: 2, terminated: 2 });
});

test('cancel_stops_run', async ({ page }) => {
  await openHarness(page);
  const outcome: HarnessOutcome = await page.evaluate(() => window.runtimeHarness!.cancelAfterFirstMessage());
  expect(outcome).toMatchObject({
    ok: false,
    error: { message: 'cancelled by user' },
    spawned: 2,
    terminated: 2,
  });
});

test('worker_error_rejects_run', async ({ page }) => {
  await openHarness(page);
  const [mismatch, thrown, crashed] = await page.evaluate(() =>
    Promise.all([
      window.runtimeHarness!.failInWorker(),
      window.runtimeHarness!.throwInWorker(),
      window.runtimeHarness!.crashWorker(),
    ]),
  );
  expect(mismatch).toMatchObject({ ok: false, error: { name: 'ProtocolError' }, spawned: 2, terminated: 2 });
  expect(mismatch.error!.message).toContain('has role querier but holder input');
  expect(thrown).toMatchObject({ ok: false, error: { name: 'TypeError' }, spawned: 2, terminated: 2 });
  expect(crashed).toMatchObject({ ok: false, spawned: 2, terminated: 2 });
  expect(crashed.error!.message).toContain('worker crashed');
});

test('wire_log_matches_in_memory', async ({ page }) => {
  await openHarness(page);
  const [memory, workers] = await page.evaluate(() =>
    Promise.all([
      window.runtimeHarness!.inMemory('consortium', 'wallet'),
      window.runtimeHarness!.inWorkers('consortium', 'wallet'),
    ]),
  );
  expect(workers.wire).toHaveLength(memory.wire.length);
  expect(shape(workers.wire!)).toEqual(shape(memory.wire));
  expect(workers.wire!.map((w) => w.seq)).toEqual(memory.wire.map((_, i) => i));
});
