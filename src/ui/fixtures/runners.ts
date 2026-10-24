// Fallback runProtocol and runAttack for stages that have not plugged in their own.

import { scoreRecovery } from '../../attacks/score';
import { extractIdentifiers } from '../../data/identifiers';
import type { QuerierResult } from '../../protocol/screening';
import { screeningParties } from '../../protocol/screening';
import { runInMemory } from '../../protocol/run';
import type { AttackOutcome, AttackRunContext, StageRunContext } from '../../stages';
import { echoProtocol } from './echoProtocol';

export async function fixtureRunProtocol(ctx: StageRunContext): Promise<QuerierResult> {
  const { results } = await runInMemory(echoProtocol, screeningParties(ctx.scenario, ctx.field), {
    signal: ctx.signal,
    onMessage: ctx.onMessage,
    onProgress: ctx.onProgress,
  });
  const querier = results[ctx.scenario.querier.institution.id];
  if (querier?.kind !== 'querier') throw new Error('querier produced no result');
  return querier;
}

/** Pretends the eavesdropper read the first holder's banlist off the wire, as it could in plaintext. */
export async function fixtureRunAttack(ctx: AttackRunContext): Promise<AttackOutcome> {
  const holder = ctx.scenario.holders[0]!;
  const banlist = extractIdentifiers(holder.records, ctx.field).values;
  ctx.onProgress({ party: 'attacker', fraction: 1, label: 'done' });
  return {
    target: `${holder.institution.name}’s banlist (${ctx.field})`,
    score: scoreRecovery(banlist, banlist),
    examples: banlist.slice(0, 5),
    note: 'Stand-in result: the real attack for this stage is not wired in yet.',
  };
}
