// Real protocol runs for the stage pages: every party in its own Web Worker.

import type { QuerierResult } from '../protocol/screening';
import { screeningParties, type ScreeningInput } from '../protocol/screening';
import type { PartySpec } from '../protocol/types';
import { dpRiskParties } from '../protocols/dprisk';
import { twoPartyParties } from '../protocols/psi';
import { runInWorkers, type ProtocolId } from '../runtime';
import type { StageRunContext } from '../stages';
import { chargeBudget, checkBudget, pageLedger } from './dpBudget';

async function runScreening(
  protocolId: ProtocolId,
  parties: readonly PartySpec<ScreeningInput>[],
  ctx: StageRunContext,
): Promise<QuerierResult> {
  const { results } = await runInWorkers(protocolId, parties, {
    signal: ctx.signal,
    onMessage: ctx.onMessage,
    onProgress: ctx.onProgress,
  });
  const querier = results[ctx.scenario.querier.institution.id];
  if (querier?.kind !== 'querier') throw new Error('querier produced no result');
  return querier;
}

/** Stages 0 and 1, and multi-party PSI: the querier against every holder in the scenario. */
export const runAgainstAllHolders =
  (protocolId: 'plaintext' | 'hashing' | 'psi-mp') =>
  (ctx: StageRunContext): Promise<QuerierResult> =>
    runScreening(protocolId, screeningParties(ctx.scenario, ctx.field), ctx);

/** Stage 2: two-party PSI against the scenario's first holder. */
export const runTwoPartyPsi = (ctx: StageRunContext): Promise<QuerierResult> =>
  runScreening('psi-2p', twoPartyParties(ctx.scenario, ctx.field), ctx);

/**
 * Stage 4: the coordinator's ledger must approve ε for every score before the run starts, and
 * is charged only when the scores are released.
 */
export async function runDpRisk(ctx: StageRunContext): Promise<QuerierResult> {
  const decision = checkBudget(ctx.scenario);
  if (!decision.ok) throw new Error(`Refused by the privacy budget: ${decision.message}.`);
  const { results } = await runInWorkers(
    'dp-risk',
    dpRiskParties(ctx.scenario, ctx.field, pageLedger().scoreEpsilon),
    { signal: ctx.signal, onMessage: ctx.onMessage, onProgress: ctx.onProgress },
  );
  const querier = results[ctx.scenario.querier.institution.id];
  if (querier?.kind !== 'querier') throw new Error('querier produced no result');
  chargeBudget(ctx.scenario);
  return querier;
}
