import { bytesToHex } from '../../../crypto/bytes';
import { hashIdentifier, hmacIdentifier } from '../../../crypto/sha256';
import { normalizeEmail } from '../../../data/normalize';
import { Tex } from '../Tex';
import type { Theory } from '../types';

const short = (bytes: Uint8Array) => `${bytesToHex(bytes).slice(0, 16)}…`;

function Example() {
  const a = normalizeEmail(' Alice.Smith+kyc@GMAIL.com ')!;
  const b = normalizeEmail('alicesmith@googlemail.com')!;
  const c = normalizeEmail('bob@outlook.com')!;
  const key1 = new Uint8Array(32).fill(1);
  const key2 = new Uint8Array(32).fill(2);
  const rows = [
    { label: 'Querier stores " Alice.Smith+kyc@GMAIL.com "', value: a, hash: hashIdentifier(a) },
    { label: 'Holder stores "alicesmith@googlemail.com"', value: b, hash: hashIdentifier(b) },
    { label: 'Another customer', value: c, hash: hashIdentifier(c) },
  ];
  return (
    <div className="theory-example" data-testid="theory-example">
      <table className="results-table">
        <thead>
          <tr>
            <th scope="col">Input</th>
            <th scope="col">Normalized</th>
            <th scope="col">SHA-256 (first 8 bytes)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td>
                <code>{r.value}</code>
              </td>
              <td>
                <code>{short(r.hash)}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        The first two hashes are identical, so the match is found without sending the email. With a shared key
        the hash changes completely: HMAC under key 1 gives <code>{short(hmacIdentifier(key1, a))}</code>,
        under key 2 <code>{short(hmacIdentifier(key2, a))}</code>.
      </p>
    </div>
  );
}

function Body() {
  return (
    <>
      <h3>The math</h3>
      <p>Each party sends a hash of every normalized identifier instead of the identifier:</p>
      <Tex block tex="h(x) = \mathrm{SHA\text{-}256}\big(\mathrm{norm}(x)\big)" />
      <p>
        SHA-256 is collision resistant, so equal hashes mean equal inputs, and the querier intersects hashes:
      </p>
      <Tex block tex="x \in L \iff h(x) \in h(L)" />
      <p>
        The keyed variant uses <Tex tex="\mathrm{HMAC}_K(x)" /> with a key <Tex tex="K" /> shared by every
        member, so only key holders can compute it.
      </p>
      <p>
        The weakness is that <Tex tex="h" /> is public and deterministic. Hiding <Tex tex="x" /> depends
        entirely on how hard <Tex tex="x" /> is to guess, and identifiers are easy to guess: an email follows
        a few name patterns, and one North American area code holds 8 million phone numbers. Checking a set{' '}
        <Tex tex="S" /> of guesses costs only <Tex tex="|S|" /> hash computations.
      </p>
      <h3>Worked example (computed live)</h3>
      <Example />
      <h3>What it guarantees</h3>
      <ul>
        <li>Correct matching, and the wire no longer shows readable identifiers.</li>
        <li>
          Not anonymity: a hash of a guessable identifier is a pseudonym. HMAC keeps outsiders out, but every
          member holds the key.
        </li>
      </ul>
    </>
  );
}

export const hashingTheory: Theory = {
  oneLine:
    'Send SHA-256 of each identifier instead of the identifier. It looks hidden, but it is only renamed.',
  Body,
  references: [
    {
      who: 'NIST',
      title: 'FIPS 180-4: Secure Hash Standard (SHS)',
      where: 'Federal Information Processing Standard, 2015',
      url: 'https://csrc.nist.gov/publications/detail/fips/180/4/final',
      why: 'The specification of SHA-256.',
    },
    {
      who: 'H. Krawczyk, M. Bellare, R. Canetti',
      title: 'RFC 2104: HMAC: Keyed-Hashing for Message Authentication',
      where: 'IETF, 1997',
      url: 'https://www.rfc-editor.org/rfc/rfc2104',
      why: 'The keyed variant shown in the example.',
    },
    {
      who: 'US Federal Trade Commission',
      title: 'No, hashing still doesn’t make your data anonymous',
      where: 'FTC Technology Blog, July 2024',
      url: 'https://www.ftc.gov/policy/advocacy-research/tech-at-ftc/2024/07/no-hashing-still-doesnt-make-your-data-anonymous',
      why: 'A regulator’s explanation of why hashed identifiers still identify people.',
    },
  ],
};
