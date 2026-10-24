// Canonical forms for identifiers, so the same person matches across institutions that
// format data differently. Every protocol matches on normalized values.

export type MatchField = 'email' | 'phone' | 'wallet';

export const MATCH_FIELDS: readonly MatchField[] = ['email', 'phone', 'wallet'];

/** Providers that ignore everything after '+' in the local part. */
export const PLUS_ADDRESSING: ReadonlySet<string> = new Set([
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'proton.me',
]);

export function normalizeEmail(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  const at = value.lastIndexOf('@');
  if (at <= 0 || at === value.length - 1) return null;
  let local = value.slice(0, at);
  let domain = value.slice(at + 1);
  if (!domain.includes('.') || /\s/.test(value)) return null;
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (PLUS_ADDRESSING.has(domain)) local = local.split('+')[0]!;
  // Gmail ignores dots in the local part.
  if (domain === 'gmail.com') local = local.replaceAll('.', '');
  if (local.length === 0) return null;
  return `${local}@${domain}`;
}

/** E.164. Numbers without a country code are assumed to be North American (+1). */
export function normalizePhone(raw: string): string | null {
  const value = raw.trim();
  if (/[^\d\s().+-]/.test(value)) return null;
  const digits = value.replace(/\D/g, '');
  let e164: string;
  if (value.startsWith('+')) e164 = `+${digits}`;
  else if (digits.length === 10) e164 = `+1${digits}`;
  else if (digits.length === 11 && digits.startsWith('1')) e164 = `+${digits}`;
  else return null;
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

/** Lowercase 0x-prefixed 20-byte hex (EIP-55 checksum casing is dropped). */
export function normalizeWallet(raw: string): string | null {
  let value = raw.trim().toLowerCase();
  if (!value.startsWith('0x')) value = `0x${value}`;
  return /^0x[0-9a-f]{40}$/.test(value) ? value : null;
}

export function normalizeField(field: MatchField, raw: string): string | null {
  switch (field) {
    case 'email':
      return normalizeEmail(raw);
    case 'phone':
      return normalizePhone(raw);
    case 'wallet':
      return normalizeWallet(raw);
  }
}
