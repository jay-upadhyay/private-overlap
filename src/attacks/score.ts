/** How well an attack recovered a secret set, measured against ground truth. */
export interface RecoveryScore {
  truePositives: number;
  falsePositives: number;
  missed: number;
  /** Share of the secret set recovered. */
  recall: number;
  /** Share of claimed items that are really in the set (1 when nothing is claimed). */
  precision: number;
}

export function scoreRecovery(recovered: Iterable<string>, truth: Iterable<string>): RecoveryScore {
  const secret = new Set(truth);
  const claimed = new Set(recovered);
  let truePositives = 0;
  for (const item of claimed) if (secret.has(item)) truePositives++;
  const falsePositives = claimed.size - truePositives;
  return {
    truePositives,
    falsePositives,
    missed: secret.size - truePositives,
    recall: secret.size === 0 ? 1 : truePositives / secret.size,
    precision: claimed.size === 0 ? 1 : truePositives / claimed.size,
  };
}
