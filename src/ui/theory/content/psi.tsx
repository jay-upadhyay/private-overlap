import { bytesToHex } from '../../../crypto/bytes';
import { encodePoint, hashToGroup } from '../../../crypto/ristretto';
import { Tex } from '../Tex';
import { TOY_G, TOY_ORDER, TOY_P, toyHash, toyPow } from '../toyGroup';
import type { Theory } from '../types';

// Fixed secrets so the example reads the same every time; real runs draw fresh 252-bit scalars.
const Q = 37n;
const K = 101n;

function Example() {
  const customer = 'alicesmith@gmail.com';
  const banned = ['alicesmith@gmail.com', 'dave@yahoo.com'];
  const hx = toyHash(customer);
  const sent = toyPow(hx, Q);
  const doubled = toyPow(sent, K);
  const holderRows = banned.map((b) => {
    const hb = toyHash(b);
    const blinded = toyPow(hb, K);
    const back = toyPow(blinded, Q);
    return { b, hb, blinded, back, match: back === doubled };
  });
  const real = bytesToHex(encodePoint(hashToGroup(customer)));
  return (
    <div className="theory-example" data-testid="theory-example">
      <p>
        Toy group: powers of <Tex tex={`g = ${TOY_G}`} /> modulo <Tex tex={`p = ${TOY_P}`} /> (order{' '}
        <Tex tex={`${TOY_ORDER}`} />
        ). Querier secret <Tex tex={`q = ${Q}`} />, holder secret <Tex tex={`k = ${K}`} />.
      </p>
      <ol>
        <li>
          Querier: <Tex tex={`H(\\texttt{${customer}}) = ${hx}`} />, sends{' '}
          <Tex tex={`${hx}^{${Q}} \\bmod ${TOY_P} = ${sent}`} />.
        </li>
        <li>
          Holder returns <Tex tex={`${sent}^{${K}} \\bmod ${TOY_P} = ${doubled}`} /> and sends its own entries
          blinded with <Tex tex="k" />:
          <table className="results-table">
            <thead>
              <tr>
                <th scope="col">Banlist entry</th>
                <th scope="col">
                  <Tex tex="H(b)" />
                </th>
                <th scope="col">
                  <Tex tex="H(b)^k" /> (sent)
                </th>
                <th scope="col">
                  <Tex tex="(H(b)^k)^q" />
                </th>
              </tr>
            </thead>
            <tbody>
              {holderRows.map((r) => (
                <tr key={r.b}>
                  <td>
                    <code>{r.b}</code>
                  </td>
                  <td>{r.hb.toString()}</td>
                  <td>{r.blinded.toString()}</td>
                  <td className={r.match ? 'tier-high' : undefined}>
                    {r.back.toString()}
                    {r.match ? ` = ${doubled} ✓ match` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </li>
        <li>
          Querier raises the holder&rsquo;s values to <Tex tex="q" /> and compares with{' '}
          <Tex tex={`${doubled}`} />. Only the shared customer matches. The values on the wire (
          {sent.toString()}, {holderRows.map((r) => r.blinded.toString()).join(', ')}) look unrelated to the
          emails.
        </li>
      </ol>
      <p className="small">
        The real thing on ristretto255: <Tex tex={`H(\\texttt{${customer}})`} /> encodes as{' '}
        <code>{real.slice(0, 32)}…</code> (32 bytes), and each secret is a random number below{' '}
        <Tex tex="\ell \approx 2^{252}" />.
      </p>
    </div>
  );
}

function Body() {
  return (
    <>
      <h3>The math</h3>
      <p>
        Work in a group <Tex tex="\mathbb{G}" /> of prime order <Tex tex="\ell" /> (ristretto255) with a hash{' '}
        <Tex tex="H : \{0,1\}^* \to \mathbb{G}" /> onto the group. The querier picks a secret <Tex tex="q" />{' '}
        and the holder a secret <Tex tex="k" />, both random in <Tex tex="\{1, \dots, \ell - 1\}" />.
        Exponents commute:
      </p>
      <Tex block tex="\big(H(x)^{q}\big)^{k} \;=\; H(x)^{qk} \;=\; \big(H(x)^{k}\big)^{q}" />
      <p>
        The querier sends <Tex tex="H(x)^q" /> for each customer and gets back <Tex tex="H(x)^{qk}" />. The
        holder sends <Tex tex="H(b)^k" /> for each entry, which the querier raises to <Tex tex="H(b)^{kq}" />.
        Because <Tex tex="H" /> is collision resistant and exponentiation by a non-zero secret is a bijection,
      </p>
      <Tex block tex="H(x)^{qk} = H(b)^{kq} \iff x = b" />
      <p>
        Why the wire reveals nothing: under the Decisional Diffie–Hellman assumption, without the exponent{' '}
        <Tex tex="H(x)^q" /> is indistinguishable from a random group element, so hashing guesses does not
        help.
      </p>
      <Tex
        block
        tex="\big(g,\; g^{a},\; g^{b},\; g^{ab}\big) \;\approx\; \big(g,\; g^{a},\; g^{b},\; g^{c}\big)"
      />
      <p className="small">
        Elliptic-curve libraries write the group additively, so <Tex tex="H(x)^q" /> appears in code as{' '}
        <Tex tex="q \cdot H(x)" />.
      </p>
      <h3>Worked example (computed live, in a toy group)</h3>
      <Example />
      <h3>What it guarantees</h3>
      <ul>
        <li>
          The querier learns which of its inputs are on the list, and the list&rsquo;s size; nothing else.
        </li>
        <li>The holder learns only how many values the querier sent.</li>
        <li>
          Semi-honest only: it assumes both sides follow the protocol, and it cannot check that the
          querier&rsquo;s inputs are real customers.
        </li>
      </ul>
    </>
  );
}

export const psiTheory: Theory = {
  oneLine: 'Blind every identifier with a secret exponent; since exponents commute, equal values still meet.',
  Body,
  references: [
    {
      who: 'B. A. Huberman, M. Franklin, T. Hogg',
      title: 'Enhancing privacy and trust in electronic communities',
      where: 'ACM Conference on Electronic Commerce, 1999',
      url: 'https://doi.org/10.1145/336992.337012',
      why: 'An early Diffie–Hellman matching protocol of the kind used here.',
    },
    {
      who: 'E. De Cristofaro, G. Tsudik',
      title:
        'Practical Private Set Intersection Protocols with Linear Computational and Bandwidth Complexity',
      where: 'IACR ePrint 2009/491; Financial Cryptography 2010',
      url: 'https://eprint.iacr.org/2009/491',
      why: 'Linear-cost PSI and its security analysis in the semi-honest model.',
    },
    {
      who: 'M. Ion, B. Kreuter, A. E. Nergiz, et al.',
      title: 'On Deploying Secure Computing: Private Intersection-Sum-with-Cardinality',
      where: 'IACR ePrint 2019/723; IEEE EuroS&P 2020',
      url: 'https://eprint.iacr.org/2019/723',
      why: 'A deployed Diffie–Hellman double-masking protocol at industry scale.',
    },
    {
      who: 'H. de Valence, J. Grigg, M. Hamburg, I. Lovecruft, G. Tankersley, F. Valsorda',
      title: 'RFC 9496: The ristretto255 and decaf448 Groups',
      where: 'IRTF CFRG, 2023',
      url: 'https://www.rfc-editor.org/rfc/rfc9496',
      why: 'The prime-order group the demo computes in.',
    },
    {
      who: 'A. Faz-Hernandez, S. Scott, N. Sullivan, R. S. Wahby, C. A. Wood',
      title: 'RFC 9380: Hashing to Elliptic Curves',
      where: 'IRTF CFRG, 2023',
      url: 'https://www.rfc-editor.org/rfc/rfc9380',
      why: 'How H maps an identifier onto the group.',
    },
  ],
};
