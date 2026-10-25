// Exact non-negative rationals for ε. Every privacy decision (sampling, budget checks) runs on
// these, never on floats, so 0.1 + 0.2 style rounding cannot change who gets screened.
//
// Inputs are accepted as:
// - a Rational { num, den } of bigints;
// - a string: a decimal ("0.5", "1e-3") or a fraction ("1/3");
// - a number, read through its shortest round-trip decimal (String(0.1) === "0.1", so 0.1 is
//   exactly 1/10, not the binary double nearest to it).

export interface Rational {
  readonly num: bigint;
  readonly den: bigint;
}

export type EpsilonInput = Rational | number | string;

const DECIMAL = /^(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i;
const FRACTION = /^(\d+)\s*\/\s*(\d+)$/;

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

export function rational(num: bigint, den: bigint = 1n): Rational {
  if (num < 0n || den <= 0n) throw new RangeError(`not a non-negative rational: ${num}/${den}`);
  const g = gcd(num, den);
  return g > 1n ? { num: num / g, den: den / g } : { num, den };
}

export function toRational(x: EpsilonInput): Rational {
  if (typeof x === 'object') return rational(x.num, x.den);
  if (typeof x === 'number' && (!Number.isFinite(x) || x < 0)) throw new RangeError(`bad epsilon ${x}`);
  const text = String(x).trim();
  const fraction = FRACTION.exec(text);
  if (fraction) return rational(BigInt(fraction[1]!), BigInt(fraction[2]!));
  const decimal = DECIMAL.exec(text);
  if (!decimal) throw new RangeError(`bad epsilon ${JSON.stringify(x)}`);
  const digits = decimal[2] ?? '';
  const exponent = Number(decimal[3] ?? 0) - digits.length;
  const mantissa = BigInt(decimal[1]! + digits);
  return exponent >= 0
    ? rational(mantissa * 10n ** BigInt(exponent))
    : rational(mantissa, 10n ** BigInt(-exponent));
}

export const ZERO: Rational = { num: 0n, den: 1n };

export function add(a: Rational, b: Rational): Rational {
  return rational(a.num * b.den + b.num * a.den, a.den * b.den);
}

/** a − b; throws if negative, since no ε quantity here can go below zero. */
export function sub(a: Rational, b: Rational): Rational {
  return rational(a.num * b.den - b.num * a.den, a.den * b.den);
}

export function scale(a: Rational, k: number | bigint): Rational {
  return rational(a.num * BigInt(k), a.den);
}

/** Sign of a − b: −1, 0 or 1. */
export function compare(a: Rational, b: Rational): -1 | 0 | 1 {
  const l = a.num * b.den;
  const r = b.num * a.den;
  return l < r ? -1 : l > r ? 1 : 0;
}

/** Nearest double, for display and for the float-valued accuracy helpers only. */
export function toNumber(a: Rational): number {
  return Number(a.num) / Number(a.den);
}

export function format(a: Rational): string {
  return a.den === 1n ? `${a.num}` : `${a.num}/${a.den}`;
}
