import type { StageId } from '../stages';

/** By design, what each stage lets the querier learn: the left column of the summary. */
export const REVEALS: Readonly<Record<StageId, string>> = {
  plaintext: 'Every holder’s whole banlist, including people who were never its customers.',
  hashing: 'A hash of every banlist entry, which anyone can match against guessable identifiers.',
  psi: 'Which of its own customers are flagged. The holder learns only a count.',
  'multi-psi': 'Which customers are flagged, and which institution flagged each one.',
  'dp-risk': 'A noisy count of flagging institutions per customer. No institution is named.',
};
