import { PLUS_ADDRESSING } from './normalize';
import type { Rng } from './rng';

// Formatting noise: the ways real institutions store the same identifier differently.
// Every variant here must normalize back to the canonical value (see normalize.ts).

function randomCase(rng: Rng, value: string): string {
  return [...value].map((c) => (rng.chance(0.3) ? c.toUpperCase() : c)).join('');
}

function padWhitespace(rng: Rng, value: string): string {
  return rng.pick(['', ' ', '  ']) + value + rng.pick(['', ' ', '\t']);
}

export function noisyEmail(rng: Rng, canonical: string): string {
  const [local, domain] = canonical.split('@') as [string, string];
  let l = local;
  let d = domain;
  if (domain === 'gmail.com') {
    if (rng.chance(0.5)) l = [...l].map((c, i) => (i > 0 && rng.chance(0.15) ? `.${c}` : c)).join('');
    if (rng.chance(0.2)) d = 'googlemail.com';
  }
  if (PLUS_ADDRESSING.has(domain) && rng.chance(0.3)) {
    l += `+${rng.pick(['crypto', 'trading', 'signup', 'kyc', 'news'])}`;
  }
  let email = `${l}@${d}`;
  if (rng.chance(0.5)) email = randomCase(rng, email);
  return padWhitespace(rng, email);
}

export function noisyPhone(rng: Rng, canonical: string): string {
  // canonical: +1AAAEEELLLL
  const a = canonical.slice(2, 5);
  const e = canonical.slice(5, 8);
  const n = canonical.slice(8);
  return padWhitespace(
    rng,
    rng.pick([
      canonical,
      `+1 ${a} ${e} ${n}`,
      `(${a}) ${e}-${n}`,
      `${a}-${e}-${n}`,
      `1.${a}.${e}.${n}`,
      `+1 (${a}) ${e}-${n}`,
      `${a}${e}${n}`,
    ]),
  );
}

export function noisyWallet(rng: Rng, canonical: string): string {
  const body = canonical.slice(2);
  const variant = rng.pick(['as-is', 'upper', 'mixed', 'no-prefix']);
  if (variant === 'upper') return `0x${body.toUpperCase()}`;
  if (variant === 'mixed') return `0x${randomCase(rng, body)}`;
  if (variant === 'no-prefix') return body;
  return canonical;
}
