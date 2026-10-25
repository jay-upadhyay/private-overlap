import type { ComponentType } from 'react';

export interface Reference {
  /** Authors or publisher, as cited. */
  who: string;
  title: string;
  /** Venue and year, e.g. "Financial Cryptography 2010". */
  where: string;
  url: string;
  /** One line: why it is on this page. */
  why: string;
}

export interface Theory {
  /** The idea in one sentence. */
  oneLine: string;
  /** The math, a worked example computed live, and what the approach does and does not guarantee. */
  Body: ComponentType;
  references: Reference[];
}
