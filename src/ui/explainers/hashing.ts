import type { Explainer } from './types';

export const hashing: Explainer = {
  steps: [
    {
      text: 'Each institution normalizes the chosen identifier, for example lowercasing emails.',
      target: 'match-field',
    },
    { text: 'Each institution hashes its normalized values with SHA-256, locally.', target: 'party-cards' },
    { text: 'Only the hashes cross the wire.', target: 'wire-inspector' },
    { text: 'The querier intersects the hashes to find flagged customers.', target: 'results-panel' },
  ],
  protects: 'Nothing against a member, who can hash guesses too. A shared HMAC key only stops outsiders.',
  breaks: {
    kind: 'attack',
    name: 'Dictionary reversal',
    how: 'Emails and phone numbers are guessable, so the attacker hashes likely values and looks them up.',
  },
};
