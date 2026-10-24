import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { normalizeEmail, normalizeField, normalizePhone, normalizeWallet, MATCH_FIELDS } from './normalize';

describe('normalize', () => {
  it.each([
    ['John.Doe@Gmail.com', 'johndoe@gmail.com'],
    ['  john.doe+kyc@gmail.com\t', 'johndoe@gmail.com'],
    ['j.o.h.n.d.o.e@googlemail.com', 'johndoe@gmail.com'],
    ['Jane.Roe+news@Outlook.com', 'jane.roe@outlook.com'],
    ['jane.roe@yahoo.com', 'jane.roe@yahoo.com'],
    ['jane+roe@yahoo.com', 'jane+roe@yahoo.com'], // yahoo does not use plus addressing
    ['a@b@proton.me', 'a@b@proton.me'],
    ['no-at-sign', null],
    ['@gmail.com', null],
    ['user@', null],
    ['user@localhost', null],
    ['+tag@gmail.com', null],
    ['us er@gmail.com', null],
  ])('email_cases %s', (input, expected) => {
    expect(normalizeEmail(input)).toBe(expected);
  });

  it.each([
    ['+12015550123', '+12015550123'],
    ['+1 (201) 555-0123', '+12015550123'],
    ['(201) 555-0123', '+12015550123'],
    ['201-555-0123', '+12015550123'],
    ['1.201.555.0123', '+12015550123'],
    ['  2015550123 ', '+12015550123'],
    ['+44 20 7946 0958', '+442079460958'],
    ['555-0123', null],
    ['+0 123 456 7890', null],
    ['201-555-0123 ext 4', null],
    ['', null],
  ])('phone_cases %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  const addr = '0x52908400098527886e0f7030069857d2e4169ee7';
  it.each([
    [addr, addr],
    ['0x52908400098527886E0F7030069857D2E4169EE7', addr],
    ['52908400098527886e0f7030069857d2e4169ee7', addr],
    [` ${addr.toUpperCase().replace('0X', '0x')} `, addr],
    ['0x1234', null],
    [`${addr}00`, null],
    ['0xzz908400098527886e0f7030069857d2e4169ee7', null],
  ])('wallet_cases %s', (input, expected) => {
    expect(normalizeWallet(input)).toBe(expected);
  });

  it('idempotent', () => {
    fc.assert(
      fc.property(fc.constantFrom(...MATCH_FIELDS), fc.string({ maxLength: 60 }), (field, raw) => {
        const once = normalizeField(field, raw);
        if (once !== null) expect(normalizeField(field, once)).toBe(once);
      }),
    );
  });

  it('idempotent_on_realistic_inputs', () => {
    const email = fc.emailAddress().map((e) => ` ${e.toUpperCase()} `);
    fc.assert(
      fc.property(email, (raw) => {
        const once = normalizeEmail(raw);
        if (once !== null) expect(normalizeEmail(once)).toBe(once);
      }),
    );
  });
});
