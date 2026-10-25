import { Tex } from '../Tex';
import type { Theory } from '../types';
import { psiTheory } from './psi';

const HOLDERS = {
  Halcyon: ['alicesmith@gmail.com', 'dave@yahoo.com'],
  Copperline: ['erin@icloud.com'],
  Meridian: ['alicesmith@gmail.com', 'erin@icloud.com'],
};
const CUSTOMERS = ['alicesmith@gmail.com', 'bob@outlook.com', 'erin@icloud.com'];

function Example() {
  const names = Object.keys(HOLDERS) as (keyof typeof HOLDERS)[];
  return (
    <div className="theory-example" data-testid="theory-example">
      <table className="results-table">
        <thead>
          <tr>
            <th scope="col">Customer</th>
            {names.map((n) => (
              <th scope="col" key={n}>
                {n}
              </th>
            ))}
            <th scope="col">
              <Tex tex="c(x)" />
            </th>
          </tr>
        </thead>
        <tbody>
          {CUSTOMERS.map((x) => {
            const flags = names.map((n) => HOLDERS[n].includes(x));
            return (
              <tr key={x}>
                <th scope="row">
                  <code>{x}</code>
                </th>
                {flags.map((f, i) => (
                  <td key={names[i]}>{f ? '1' : '0'}</td>
                ))}
                <td>{flags.filter(Boolean).length}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p>
        Each row is <Tex tex="f(x)" />. Stage 3 hands the querier the whole row, so it learns that Halcyon and
        Meridian flagged Alice. Stage 4 releases only a noisy version of the last column.
      </p>
    </div>
  );
}

function Body() {
  return (
    <>
      <h3>The math</h3>
      <p>
        Run the two-party protocol once per holder <Tex tex="i = 1, \dots, n" />, with fresh secrets{' '}
        <Tex tex="q_i, k_i" /> each time so the sessions cannot be linked. For each customer the querier gets
        a vector
      </p>
      <Tex
        block
        tex="f(x) = \big(\mathbb{1}[x \in L_1],\; \mathbb{1}[x \in L_2],\; \dots,\; \mathbb{1}[x \in L_n]\big)"
      />
      <p>and the risk count is its sum:</p>
      <Tex block tex="c(x) = \sum_{i=1}^{n} \mathbb{1}[x \in L_i]" />
      <p>
        Cost grows linearly: about <Tex tex="n \cdot |C| + \sum_i |L_i|" /> blinding operations for the
        querier.
      </p>
      <h3>Worked example (computed live)</h3>
      <Example />
      <h3>What it guarantees</h3>
      <ul>
        <li>Everyone outside the querier&rsquo;s inputs stays hidden at every institution.</li>
        <li>
          Not attribution: the querier learns <em>which</em> institution flagged each customer, which a holder
          may not want to reveal.
        </li>
      </ul>
    </>
  );
}

export const multiPsiTheory: Theory = {
  oneLine:
    'Two-party PSI once per institution, combined per customer: useful, but it names who flagged whom.',
  Body,
  references: psiTheory.references.filter((r) => !r.title.startsWith('RFC 9380')),
};
