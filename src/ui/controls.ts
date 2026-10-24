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

export type ControlId = keyof typeof CONTROLS;

export const CONTROL_IDS = Object.keys(CONTROLS) as ControlId[];
