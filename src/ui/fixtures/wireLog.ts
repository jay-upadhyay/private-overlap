import type { WireEntry } from '../../protocol/types';

/** A recorded two-holder exchange, for rendering the wire inspector without running anything. */
export const RECORDED_WIRE: readonly WireEntry[] = [
  {
    seq: 0,
    from: 'northwind',
    to: 'halcyon',
    type: 'customers',
    round: 1,
    bytes: 52,
    preview: '["ada.lovelace@gmail.com","alan.turing@proton.me"]',
  },
  {
    seq: 1,
    from: 'halcyon',
    to: 'northwind',
    type: 'matches',
    round: 2,
    bytes: 26,
    preview: '["alan.turing@proton.me"]',
  },
  {
    seq: 2,
    from: 'northwind',
    to: 'meridian',
    type: 'customers',
    round: 1,
    bytes: 52,
    preview: '["ada.lovelace@gmail.com","alan.turing@proton.me"]',
  },
  { seq: 3, from: 'meridian', to: 'northwind', type: 'matches', round: 2, bytes: 2, preview: '[]' },
];
