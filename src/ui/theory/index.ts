import type { StageId } from '../../stages';
import { dpRiskTheory } from './content/dpRisk';
import { hashingTheory } from './content/hashing';
import { multiPsiTheory } from './content/multiPsi';
import { plaintextTheory } from './content/plaintext';
import { psiTheory } from './content/psi';
import type { Theory } from './types';

export const THEORY: Readonly<Record<StageId, Theory>> = {
  plaintext: plaintextTheory,
  hashing: hashingTheory,
  psi: psiTheory,
  'multi-psi': multiPsiTheory,
  'dp-risk': dpRiskTheory,
};
