import type { Explainer } from './types';

export const dpRisk: Explainer = {
  steps: [
    {
      text: 'Choose ε per score with the slider. Higher ε gives more accurate tiers and reveals more; the chart shows both.',
      target: 'epsilon-panel',
    },
    {
      text: 'Each holder re-blinds the querier’s points and sends them to a coordinator, never back to the querier.',
      target: 'wire-inspector',
    },
    {
      text: 'The coordinator counts matching holders per customer, adds discrete Laplace noise with scale 1/ε, and releases only the noisy counts.',
      target: 'wire-inspector',
    },
    { text: 'The querier receives a risk tier per customer, not who flagged it.', target: 'results-panel' },
    {
      text: 'A budget ledger charges ε for every score and refuses runs that would overspend or re-score a customer too often.',
      target: 'budget-panel',
    },
  ],
  protects: 'Who flagged whom, and the banlists from bulk probing.',
  breaks: {
    kind: 'out-of-scope',
    items: [
      'A coordinator that colludes with a member.',
      'Malicious parties that deviate from the protocol.',
    ],
  },
};
