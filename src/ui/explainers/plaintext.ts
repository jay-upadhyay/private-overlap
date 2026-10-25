import type { Explainer } from './types';

export const plaintext: Explainer = {
  steps: [
    {
      text: 'Pick a scenario: who screens whom, and how many records each side holds.',
      target: 'preset-picker',
    },
    { text: 'Press Run. The querier sends its customer list to each banlist holder.', target: 'run-button' },
    {
      text: 'Watch the raw lists cross the wire. Every identifier is readable in transit.',
      target: 'wire-inspector',
    },
    {
      text: 'The querier learns which customers are flagged, and the holder has seen every customer.',
      target: 'results-panel',
    },
  ],
  protects: 'Nothing. Every party, and anyone on the wire, sees both lists in full.',
  breaks: {
    kind: 'attack',
    name: 'Read the wire',
    how: 'No attack is needed: an eavesdropper copies the identifiers straight out of each message.',
  },
};
