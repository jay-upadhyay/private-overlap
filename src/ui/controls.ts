// Test ids of the controls and panels every stage page renders. Explainer steps point
// at these, so a step can never name a control that is not on the page.

export const CONTROLS = {
  'preset-picker': 'Preset',
  'match-field': 'Match field',
  'seed-input': 'Seed',
  'run-button': 'Run',
  'cancel-button': 'Cancel',
  'run-progress': 'Progress',
  'party-cards': 'Party cards',
  'god-view-toggle': 'God view',
  'wire-inspector': 'Wire inspector',
  'results-panel': 'Results',
  'attacker-panel': 'Attacker',
  'run-attack': 'Run attack',
} as const;

/** Panels only some stages render; a step may point at them only on those stages. */
export const STAGE_CONTROLS = {
  'epsilon-panel': 'Privacy vs accuracy',
  'budget-panel': 'Privacy budget',
} as const;

export type ControlId = keyof typeof CONTROLS | keyof typeof STAGE_CONTROLS;

/** Controls every stage page renders. */
export const CONTROL_IDS = Object.keys(CONTROLS) as (keyof typeof CONTROLS)[];

/** Display name of any control a step can point at. */
export const CONTROL_LABELS: Readonly<Record<ControlId, string>> = { ...CONTROLS, ...STAGE_CONTROLS };
