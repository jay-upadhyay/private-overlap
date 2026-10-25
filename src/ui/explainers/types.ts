import type { ControlId } from '../controls';

export interface ExplainerStep {
  text: string;
  /** The control or panel this step happens in; the step links to it. */
  target: ControlId;
}

export type ExplainerBreak =
  | {
      kind: 'attack';
      /** Attack name, shown as a heading. */
      name: string;
      /** One line on how it works. */
      how: string;
    }
  | {
      kind: 'out-of-scope';
      /** Threats this stage does not defend against. */
      items: string[];
    };

/** The short text at the top of a stage page: how it works, what it protects, what breaks it. */
export interface Explainer {
  /** 3 to 5 steps. */
  steps: ExplainerStep[];
  /** One line. */
  protects: string;
  breaks: ExplainerBreak;
}
