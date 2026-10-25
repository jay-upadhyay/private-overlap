import {
  discreteLaplacePmf,
  membershipAccuracyBound,
  TIER_LABELS,
  tierProbabilities,
} from '../../../dp/bounds';
import { formatPercent } from '../../format';
import { Tex } from '../Tex';
import type { Theory } from '../types';

const EPS = 0.5;

function Example() {
  const zs = [-3, -2, -1, 0, 1, 2, 3];
  return (
    <div className="theory-example" data-testid="theory-example">
      <p>
        Noise at <Tex tex={`\\varepsilon = ${EPS}`} />:
      </p>
      <table className="results-table">
        <thead>
          <tr>
            <th scope="col">
              <Tex tex="z" />
            </th>
            {zs.map((z) => (
              <th scope="col" key={z}>
                {z}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">
              <Tex tex="\Pr[Z = z]" />
            </th>
            {zs.map((z) => (
              <td key={z}>{formatPercent(discreteLaplacePmf(z, EPS))}</td>
            ))}
          </tr>
        </tbody>
      </table>
      <p>Released tier for a customer with true count c:</p>
      <table className="results-table">
        <thead>
          <tr>
            <th scope="col">True count</th>
            {(['clear', 'review', 'high'] as const).map((t) => (
              <th scope="col" key={t}>
                {TIER_LABELS[t]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2].map((c) => {
            const p = tierProbabilities(c, EPS);
            return (
              <tr key={c}>
                <th scope="row">{c}</th>
                <td>{formatPercent(p.clear)}</td>
                <td>{formatPercent(p.review)}</td>
                <td>{formatPercent(p.high)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p>
        Best possible guess from one score: <Tex tex={`\\tfrac{e^{${EPS}}}{1+e^{${EPS}}}`} /> ={' '}
        {formatPercent(membershipAccuracyBound(EPS))}. Scoring 1,000 customers costs{' '}
        <Tex tex={`1000 \\times ${EPS} = ${1000 * EPS}`} /> of the budget.
      </p>
    </div>
  );
}

function Body() {
  return (
    <>
      <h3>The math</h3>
      <p>
        A mechanism <Tex tex="M" /> is <Tex tex="\varepsilon" />
        -differentially private if, for any two inputs <Tex tex="D, D'" /> that differ in one
        institution&rsquo;s decision about one person, and any set of outputs <Tex tex="S" />,
      </p>
      <Tex block tex="\Pr[M(D) \in S] \;\le\; e^{\varepsilon}\, \Pr[M(D') \in S]" />
      <p>
        One such change moves a count <Tex tex="c(x)" /> by at most 1 (sensitivity <Tex tex="\Delta = 1" />
        ), so the coordinator adds discrete Laplace noise:
      </p>
      <Tex
        block
        tex="\tilde c(x) = c(x) + Z, \qquad \Pr[Z = z] = \frac{1 - e^{-\varepsilon}}{1 + e^{-\varepsilon}}\, e^{-\varepsilon |z|}"
      />
      <p>From one released score, no test guesses membership better than</p>
      <Tex block tex="\frac{e^{\varepsilon}}{1 + e^{\varepsilon}}" />
      <p>and repeated releases add up (basic composition), which is what the budget ledger tracks:</p>
      <Tex block tex="\varepsilon_{\text{total}} = \sum_j \varepsilon_j" />
      <h3>Worked example (computed live)</h3>
      <Example />
      <h3>What it guarantees</h3>
      <ul>
        <li>The querier learns a noisy count, never which institution flagged a customer.</li>
        <li>The budget caps how many identities can be probed and how often one customer is re-scored.</li>
        <li>
          It assumes the coordinator does not collude with a member, and that parties follow the protocol.
        </li>
      </ul>
    </>
  );
}

export const dpRiskTheory: Theory = {
  oneLine:
    'Release only a noisy count of flagging institutions, and charge every release to a privacy budget.',
  Body,
  references: [
    {
      who: 'C. Dwork, F. McSherry, K. Nissim, A. Smith',
      title: 'Calibrating Noise to Sensitivity in Private Data Analysis',
      where: 'TCC 2006',
      url: 'https://people.csail.mit.edu/asmith/PS/sensitivity-tcc-final.pdf',
      why: 'The definition of differential privacy and noise scaled to sensitivity.',
    },
    {
      who: 'C. Dwork, A. Roth',
      title: 'The Algorithmic Foundations of Differential Privacy',
      where: 'Foundations and Trends in Theoretical Computer Science, 2014',
      url: 'https://www.cis.upenn.edu/~aaroth/Papers/privacybook.pdf',
      why: 'The standard textbook, including composition.',
    },
    {
      who: 'A. Ghosh, T. Roughgarden, M. Sundararajan',
      title: 'Universally Utility-Maximizing Privacy Mechanisms',
      where: 'arXiv 0811.2841; SIAM J. Computing 2012',
      url: 'https://arxiv.org/abs/0811.2841',
      why: 'The geometric (discrete Laplace) mechanism for counts.',
    },
    {
      who: 'C. L. Canonne, G. Kamath, T. Steinke',
      title: 'The Discrete Gaussian for Differential Privacy',
      where: 'arXiv 2004.00010; NeurIPS 2020',
      url: 'https://arxiv.org/abs/2004.00010',
      why: 'Exact integer sampling, the method the noise sampler follows.',
    },
    {
      who: 'I. Mironov',
      title: 'On Significance of the Least Significant Bits for Differential Privacy',
      where: 'ACM CCS 2012',
      url: 'https://www.microsoft.com/en-us/research/wp-content/uploads/2012/10/lsbs.pdf',
      why: 'Why floating-point noise is unsafe, and why the sampler uses integers only.',
    },
    {
      who: 'P. Kairouz, S. Oh, P. Viswanath',
      title: 'The Composition Theorem for Differential Privacy',
      where: 'ICML 2015',
      url: 'https://arxiv.org/abs/1311.0776',
      why: 'The hypothesis-testing view behind the e^ε/(1+e^ε) bound.',
    },
  ],
};
