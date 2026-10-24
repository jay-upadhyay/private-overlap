import { EMAIL_DOMAINS, FIRST_NAMES, LAST_NAMES } from './names';
import type { Rng } from './rng';

/** A synthetic person in canonical form. `personId` exists only in ground truth. */
export interface Person {
  personId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  wallet: string;
}

const HEX = '0123456789abcdef';

function emailLocal(rng: Rng, first: string, last: string, domain: string): string {
  const f = first.toLowerCase();
  const l = last.toLowerCase();
  // Gmail's canonical form has no dots, so dotted patterns are only used elsewhere.
  const sep = domain === 'gmail.com' ? '' : rng.pick(['.', '', '_']);
  const base = rng.pick([`${f}${sep}${l}`, `${f[0]}${sep}${l}`, `${f}${sep}${l[0]}`, `${l}${sep}${f}`]);
  const suffix = rng.pick(['', '', String(rng.int(100)), String(1950 + rng.int(56))]);
  return base + suffix;
}

function phone(rng: Rng): string {
  const area = `${2 + rng.int(8)}${rng.int(10)}${rng.int(10)}`;
  const exchange = `${2 + rng.int(8)}${rng.int(10)}${rng.int(10)}`;
  const line = String(rng.int(10000)).padStart(4, '0');
  return `+1${area}${exchange}${line}`;
}

function dob(rng: Rng): string {
  const year = 1950 + rng.int(56);
  const month = String(1 + rng.int(12)).padStart(2, '0');
  const day = String(1 + rng.int(28)).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function wallet(rng: Rng): string {
  let hex = '0x';
  for (let i = 0; i < 40; i++) hex += HEX[rng.int(16)];
  return hex;
}

/**
 * Generates people with unique email, phone and wallet, so matching on any field
 * identifies exactly one person.
 */
export class PersonFactory {
  private readonly emails = new Set<string>();
  private readonly phones = new Set<string>();
  private readonly wallets = new Set<string>();
  private count = 0;

  constructor(private readonly rng: Rng) {}

  create(): Person {
    const { rng } = this;
    const firstName = rng.pick(FIRST_NAMES);
    const lastName = rng.pick(LAST_NAMES);
    const domain = rng.pick(EMAIL_DOMAINS);

    let local = emailLocal(rng, firstName, lastName, domain);
    while (this.emails.has(`${local}@${domain}`)) local += rng.int(10);
    const email = `${local}@${domain}`;

    let tel = phone(rng);
    while (this.phones.has(tel)) tel = phone(rng);

    let addr = wallet(rng);
    while (this.wallets.has(addr)) addr = wallet(rng);

    this.emails.add(email);
    this.phones.add(tel);
    this.wallets.add(addr);

    return {
      personId: `p${this.count++}`,
      firstName,
      lastName,
      email,
      phone: tel,
      dob: dob(rng),
      wallet: addr,
    };
  }
}
