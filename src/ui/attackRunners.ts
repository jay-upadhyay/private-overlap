import { fishingCandidates, runFishing, runMultiFishing, scoreFishing } from '../attacks/fishing';
import type { AttackRunContext, AttackOutcome } from '../stages';

const buildFishingCandidates = (context: AttackRunContext): string[] =>
  fishingCandidates(context.scenario, {
    field: context.field,
    coverage: 0.9,
    decoys: 2_000,
    seed: 1,
  });

const targetHolder = (context: AttackRunContext) => {
  const holder = context.scenario.holders[0];
  if (!holder) throw new Error('scenario has no holders');
  return holder;
};

export const runPsiAttack = async (context: AttackRunContext): Promise<AttackOutcome> => {
  const holder = targetHolder(context);
  const candidates = buildFishingCandidates(context);
  const result = await runFishing(
    context.scenario,
    { field: context.field, candidates, holderId: holder.institution.id },
    { signal: context.signal, onProgress: context.onProgress },
  );
  const hits = result.hitsByHolder[holder.institution.id] ?? [];
  const score = scoreFishing(context.scenario, holder.institution.id, context.field, hits);

  return {
    target: `${holder.institution.name}'s ${context.field} banlist`,
    score,
    examples: hits.slice(0, 5),
    note: `Padded the query with ${result.sent.toLocaleString()} entries and recovered ${hits.length} match(es).`,
  };
};

export const runMultiPsiAttack = async (context: AttackRunContext): Promise<AttackOutcome> => {
  const holder = targetHolder(context);
  const candidates = buildFishingCandidates(context);
  const result = await runMultiFishing(
    context.scenario,
    { field: context.field, candidates },
    { signal: context.signal, onProgress: context.onProgress },
  );
  const hits = result.hitsByHolder[holder.institution.id] ?? [];
  const score = scoreFishing(context.scenario, holder.institution.id, context.field, hits);

  return {
    target: `${holder.institution.name}'s ${context.field} banlist`,
    score,
    examples: hits.slice(0, 5),
    note: `One padded query scraped ${context.scenario.holders.length} holder(s); ${hits.length} match(es) landed on ${holder.institution.name}.`,
  };
};
