import { normalizeEmail } from '../../../data/normalize';
import { Tex } from '../Tex';
import type { Theory } from '../types';

const CUSTOMERS = [' Alice.Smith@Gmail.com', 'bob@outlook.com', 'carol+kyc@proton.me'];
const BANLIST = ['alicesmith+trading@googlemail.com', 'dave@yahoo.com'];

function Example() {
  const customers = CUSTOMERS.map((raw) => ({ raw, norm: normalizeEmail(raw)! }));
  const banned = BANLIST.map((raw) => ({ raw, norm: normalizeEmail(raw)! }));
  const bannedSet = new Set(banned.map((b) => b.norm));
  const matches = customers.filter((c) => bannedSet.has(c.norm));
  const customerSet = new Set(customers.map((c) => c.norm));
  const leaked = banned.filter((b) => !customerSet.has(b.norm));
  return (
    <div className="theory-example" data-testid="theory-example">
      <table className="results-table">
        <thead>
          <tr>
            <th scope="col">Stored as</th>
            <th scope="col">Normalized</th>
            <th scope="col">List</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.raw}>
              <td>
                <code>{JSON.stringify(c.raw)}</code>
              </td>
              <td>
                <code>{c.norm}</code>
              </td>
              <td>Querier&rsquo;s customers</td>
            </tr>
          ))}
          {banned.map((b) => (
            <tr key={b.raw}>
              <td>
                <code>{JSON.stringify(b.raw)}</code>
              </td>
              <td>
                <code>{b.norm}</code>
              </td>
              <td>Holder&rsquo;s banlist</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Match: <code>{matches.map((m) => m.norm).join(', ')}</code>. But the querier also now holds{' '}
        <code>{leaked.map((l) => l.norm).join(', ')}</code>, someone who was never its customer.
      </p>
    </div>
  );
}

function Body() {
  return (
    <>
      <h3>The math</h3>
      <p>
        With the querier&rsquo;s customers <Tex tex="C" /> and the holder&rsquo;s banlist <Tex tex="L" />, the
        answer the querier needs is the intersection:
      </p>
      <Tex block tex="I = C \cap L" />
      <p>
        To compute it, the holder sends all of <Tex tex="L" />, so the querier also learns
      </p>
      <Tex block tex="L \setminus C \quad (\text{every banned person who is not its customer})" />
      <p>
        Matching only works on a canonical form. Every stage first applies the same normalization{' '}
        <Tex tex="\mathrm{norm}(x)" />: lowercase, trim, Gmail dots and <code>+tags</code> removed, phones to
        E.164, wallets to lowercase hex.
      </p>
      <h3>Worked example (computed live)</h3>
      <Example />
      <h3>What it guarantees</h3>
      <ul>
        <li>The correct answer, exactly.</li>
        <li>No privacy at all: the whole banlist leaves the holder.</li>
      </ul>
    </>
  );
}

export const plaintextTheory: Theory = {
  oneLine: 'The baseline: send the list and intersect. Correct, and it reveals everything.',
  Body,
  references: [
    {
      who: 'Regulation (EU) 2016/679',
      title: 'GDPR Article 5: principles relating to processing of personal data',
      where: 'Official Journal of the EU, 2016',
      url: 'https://gdpr-info.eu/art-5-gdpr/',
      why: 'Data minimisation: share only what the purpose needs, which plaintext sharing fails.',
    },
    {
      who: 'E. De Cristofaro, G. Tsudik',
      title:
        'Practical Private Set Intersection Protocols with Linear Computational and Bandwidth Complexity',
      where: 'IACR ePrint 2009/491; Financial Cryptography 2010',
      url: 'https://eprint.iacr.org/2009/491',
      why: 'Frames the problem every later stage solves: computing C ∩ L without revealing the rest.',
    },
  ],
};
