import type { Explainer } from './types';

export const multiPsi: Explainer = {
  steps: [
    { text: 'Pick a scenario with several banlist holders.', target: 'preset-picker' },
    { text: 'The querier runs two-party PSI once with each institution.', target: 'wire-inspector' },
    {
      text: 'Matches are combined per customer, with one column per institution.',
      target: 'results-panel',
    },
  ],
  protects: 'Everyone outside your customer base, at every institution.',
  breaks: {
    kind: 'attack',
    name: 'Attribution and wide fishing',
    how: 'You learn which institution flagged whom, and one padded list fishes every banlist at once.',
  },
};
