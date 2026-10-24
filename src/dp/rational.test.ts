import { describe, expect, it } from 'vitest';
import { add, compare, format, sub, toRational } from './rational';

describe('dp/rational', () => {
  it('parses_decimals_exactly', () => {
    expect(format(toRational(0.1))).toBe('1/10');
    expect(format(toRational('0.25'))).toBe('1/4');
    expect(format(toRational('1/3'))).toBe('1/3');
    expect(format(toRational('6/4'))).toBe('3/2');
    expect(format(toRational(1e-7))).toBe('1/10000000');
    expect(format(toRational('2.5e2'))).toBe('250');
    expect(format(toRational(500))).toBe('500');
    expect(() => toRational('abc')).toThrow(RangeError);
    expect(() => toRational(Infinity)).toThrow(RangeError);
    expect(() => toRational('1/0')).toThrow(RangeError);
  });

  it('adds_without_rounding', () => {
    const sum = add(toRational(0.1), toRational(0.2));
    expect(compare(sum, toRational(0.3))).toBe(0);
    expect(() => sub(toRational(0.1), toRational(0.2))).toThrow(RangeError);
  });
});
