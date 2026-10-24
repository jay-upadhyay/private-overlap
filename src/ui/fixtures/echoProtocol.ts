// Stand-in protocol so the stage pages have something to run before wave 3 plugs in the
// real ones. It sends plaintext lists, so its wire log and results look real.
// Delete this folder once every stage has runProtocol and runAttack.

import { extractIdentifiers } from '../../data/identifiers';
import type {
  QuerierResult,
  ScreeningInput,
  ScreeningProtocol,
  ScreeningResult,
} from '../../protocol/screening';
import type { PartyContext, PartyId } from '../../protocol/types';

/** Pause between steps so the progress bar and Cancel are visible. */
export const ECHO_STEP_MS = 120;

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function runQuerier(
  input: ScreeningInput & { kind: 'querier' },
  ctx: PartyContext,
): Promise<QuerierResult> {
  const ids = extractIdentifiers(input.records, input.field);
  const rowOf = new Map(ids.values.map((v, i) => [v, ids.rowIds[i]!]));
  const flaggedBy: Record<string, PartyId[]> = {};
  for (const [i, holder] of input.holders.entries()) {
    ctx.send(holder, 'customers', ids.values, 1);
    const matches = await ctx.receive<string[]>(holder, 'matches');
    for (const value of matches) {
      const rowId = rowOf.get(value);
      if (rowId) (flaggedBy[rowId] ??= []).push(holder);
    }
    ctx.progress((i + 1) / input.holders.length, `screened against ${holder}`);
  }
  return { kind: 'querier', flaggedBy, skipped: ids.skipped };
}

async function runHolder(
  input: ScreeningInput & { kind: 'holder' },
  ctx: PartyContext,
): Promise<ScreeningResult> {
  const ids = extractIdentifiers(input.records, input.field);
  const banned = new Set(ids.values);
  const customers = await ctx.receive<string[]>(input.querier, 'customers');
  ctx.progress(0.5, 'matching');
  await pause(ECHO_STEP_MS, ctx.signal);
  ctx.send(
    input.querier,
    'matches',
    customers.filter((c) => banned.has(c)),
    2,
  );
  ctx.progress(1, 'done');
  return { kind: 'holder', screened: customers.length, skipped: ids.skipped };
}

export const echoProtocol: ScreeningProtocol = {
  id: 'fixture-echo',
  roles: ['querier', 'holder'],
  run: (_role, input, ctx) => (input.kind === 'querier' ? runQuerier(input, ctx) : runHolder(input, ctx)),
};
