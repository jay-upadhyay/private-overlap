import type { Explainer } from './types';

export const psi: Explainer = {
  steps: [
    {
      text: 'The querier blinds each customer as H(x)^q with a secret q, and shuffles them.',
      target: 'party-cards',
    },
    {
      text: 'The holder raises those points to its secret k and returns them, then sends its banlist as H(b)^k.',
      target: 'wire-inspector',
    },
    {
      text: 'The querier raises the holder’s points to q and compares: equal points are the same identifier.',
      target: 'results-panel',
    },
  ],
  protects: 'Banlist entries outside your customer base, and your customer list itself.',
  breaks: {
    kind: 'attack',
    name: 'Fishing',
    how: 'The querier pads its list with made-up customers, so each match leaks a banlist entry. List sizes also show.',
  },
};
