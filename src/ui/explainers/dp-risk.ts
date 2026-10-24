import type { Explainer } from './types';

export const dpRisk: Explainer = {
  steps: [
    {
      text: 'Holders and the querier double-blind their identifiers locally, then send them to a coordinator.',
      target: 'party-cards',
    },
    {
      text: 'The coordinator counts matching holders per customer, adds discrete Laplace noise with scale 1/ε, and sends back tiers.',
      target: 'wire-inspector',
    },
    { text: 'The querier receives a risk tier per customer, not who flagged it.', target: 'results-panel' },
    {
      text: 'A budget ledger records the privacy spent by each query and refuses queries once it runs out.',
      target: 'attacker-panel',
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
