import { breachCorpus, emailPatternCandidates, phoneRangeCandidates } from '../attacks/candidates';
import { fishingCandidates, runFishing, runMultiFishing, scoreFishing } from '../attacks/fishing';
import { preimageSearch } from '../attacks/preimage/preimageSearch';
import { scoreRecovery } from '../attacks/score';
import { unpackFixed } from '../crypto/bytes';
import { HASH_BYTES } from '../crypto/sha256';
import {
  emailBases,
  emailSeparators,
  EMAIL_NUMBER_SUFFIX_MAX,
  EMAIL_YEAR_SUFFIX_RANGE,
} from '../data/identity';
import { extractIdentifiers } from '../data/identifiers';
import { EMAIL_DOMAINS } from '../data/names';
import { runInMemory } from '../protocol/run';
import { screeningParties, type ScreeningProtocol } from '../protocol/screening';
import { hashingProtocol, MSG_BANLIST } from '../protocols/hashing';
import type { AttackRunContext, AttackOutcome } from '../stages';

const targetHolder = (context: AttackRunContext) => {
  const holder = context.scenario.holders[0];
  if (!holder) throw new Error('scenario has no holders');
  return holder;
};

const buildFishingCandidates = (context: AttackRunContext): string[] =>
  fishingCandidates(context.scenario, {
    field: context.field,
    coverage: 0.9,
    decoys: 2_000,
    seed: 1,
  });

function takeCandidates<T>(source: Iterable<T>, limit: number): T[] {
  const out: T[] = [];
  for (const value of source) {
    if (out.length >= limit) break;
    out.push(value);
  }
  return out;
}

const buildHashingCandidates = (context: AttackRunContext): string[] => {
  switch (context.field) {
    case 'email': {
      const seen = new Set<string>();
      const candidates: string[] = [];
      const records = [
        ...context.scenario.querier.records,
        ...context.scenario.holders.flatMap((holder) => holder.records),
      ];
      for (const record of records) {
        const first = record.firstName.toLowerCase();
        const last = record.lastName.toLowerCase();
        for (const domain of EMAIL_DOMAINS) {
          for (const sep of emailSeparators(domain)) {
            for (const base of emailBases(first, last, sep)) {
              const suffixes = [''];
              for (let n = 0; n < EMAIL_NUMBER_SUFFIX_MAX; n++) suffixes.push(String(n));
              for (let y = EMAIL_YEAR_SUFFIX_RANGE[0]; y <= EMAIL_YEAR_SUFFIX_RANGE[1]; y++) {
                suffixes.push(String(y));
              }
              for (const suffix of suffixes) {
                const email = `${base}${suffix}@${domain}`;
                if (seen.has(email)) continue;
                seen.add(email);
                candidates.push(email);
              }
            }
          }
        }
      }
      return candidates.length > 0 ? candidates : takeCandidates(emailPatternCandidates(), 80_000);
    }
    case 'phone': {
      const prefixes = [
        ...new Set(
          context.scenario.holders.flatMap((holder) =>
            extractIdentifiers(holder.records, 'phone').values.map((value) => value.slice(0, 6)),
          ),
        ),
      ];
      return prefixes.length > 0
        ? takeCandidates(phoneRangeCandidates(prefixes), 120_000)
        : takeCandidates(phoneRangeCandidates(['415555']), 120_000);
    }
    case 'wallet': {
      const population = [
        ...new Set(
          context.scenario.holders.flatMap((holder) => extractIdentifiers(holder.records, 'wallet').values),
        ),
      ];
      return breachCorpus(population, 'wallet', { coverage: 0.9, decoys: 2_000, seed: 1 });
    }
  }
};

async function observeBanlistHashes(context: AttackRunContext): Promise<Uint8Array[]> {
  const captured: Uint8Array[] = [];
  const protocol: ScreeningProtocol = {
    ...hashingProtocol(),
    run: (role, input, innerCtx) =>
      hashingProtocol().run(role, input, {
        ...innerCtx,
        receive: async <T>(from: string, type: string): Promise<T> => {
          const payload = await innerCtx.receive<T>(from, type);
          if (type === MSG_BANLIST) captured.push(payload as Uint8Array);
          return payload;
        },
      }),
  };
  await runInMemory(protocol, screeningParties(context.scenario, context.field), {
    signal: context.signal,
    onProgress: context.onProgress,
  });
  return captured;
}

export const runPlaintextAttack = async (context: AttackRunContext): Promise<AttackOutcome> => {
  const truth = [
    ...new Set(
      context.scenario.holders.flatMap((holder) => extractIdentifiers(holder.records, context.field).values),
    ),
  ];
  const score = scoreRecovery(truth, truth);

  return {
    target: `every holder's ${context.field} banlist`,
    score,
    examples: truth.slice(0, 5),
    note: 'This is a passive read: every identifier is sent in the clear, so an eavesdropper recovers the full set with 100% accuracy.',
  };
};

export const runHashingAttack = async (context: AttackRunContext): Promise<AttackOutcome> => {
  const holder = targetHolder(context);
  const hashes = await observeBanlistHashes(context);
  const targets = hashes.flatMap((payload) => unpackFixed(payload, HASH_BYTES));
  const candidates = buildHashingCandidates(context);
  const result = preimageSearch(targets, candidates, {
    signal: context.signal,
    progressEvery: 10_000,
  });
  const score = scoreRecovery(result.recovered, extractIdentifiers(holder.records, context.field).values);

  return {
    target: `${holder.institution.name}'s ${context.field} banlist`,
    score,
    examples: result.recovered.slice(0, 5),
    note: `Tried ${result.tried.toLocaleString()} candidates and recovered ${result.recovered.length} hash preimage(s).`,
  };
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
