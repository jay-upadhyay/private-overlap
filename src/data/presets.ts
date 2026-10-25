import { buildScenario, type Scenario, type ScenarioConfig } from './scenario';

export type PresetId = 'onboarding' | 'portfolio' | 'consortium';

export interface Preset {
  id: PresetId;
  title: string;
  description: string;
  config: ScenarioConfig;
}

// Institution names are fictional.
export const PRESETS: readonly Preset[] = [
  {
    id: 'onboarding',
    title: 'Onboarding check',
    description: 'A new exchange screens one applicant against a broker’s banlist.',
    config: {
      seed: 101,
      querier: { id: 'northwind', name: 'Northwind Exchange', kind: 'exchange', customers: 1 },
      holders: [{ id: 'halcyon', name: 'Halcyon Brokerage', kind: 'broker', banlistSize: 500 }],
      flaggedByCount: [1],
    },
  },
  {
    id: 'portfolio',
    title: 'Portfolio sweep',
    description: 'A broker screens 10,000 customers against an exchange’s banlist of 2,000.',
    config: {
      seed: 202,
      querier: { id: 'halcyon', name: 'Halcyon Brokerage', kind: 'broker', customers: 10_000 },
      holders: [{ id: 'copperline', name: 'Copperline Exchange', kind: 'exchange', banlistSize: 2_000 }],
      flaggedByCount: [0.04],
    },
  },
  {
    id: 'consortium',
    title: 'Consortium screen',
    description: 'An exchange screens 10,000 customers against four institutions’ banlists.',
    config: {
      seed: 303,
      querier: { id: 'northwind', name: 'Northwind Exchange', kind: 'exchange', customers: 10_000 },
      holders: [
        { id: 'halcyon', name: 'Halcyon Brokerage', kind: 'broker', banlistSize: 1_500 },
        { id: 'copperline', name: 'Copperline Exchange', kind: 'exchange', banlistSize: 2_000 },
        { id: 'meridian', name: 'Meridian Bank', kind: 'bank', banlistSize: 1_200 },
        { id: 'bluewater', name: 'Bluewater Securities', kind: 'broker', banlistSize: 2_500 },
      ],
      flaggedByCount: [0.03, 0.012, 0.005, 0.002],
    },
  },
];

export function getPreset(id: PresetId): Preset {
  const preset = PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`unknown preset ${id}`);
  return preset;
}

/** Smallest custom size offered (or the preset's own size, if smaller). */
export const MIN_CUSTOMERS = 100;

/** The customer counts a preset can be scaled to: [min, the preset's own size]. */
export function customerRange(id: PresetId): { min: number; max: number } {
  const max = getPreset(id).config.querier.customers;
  return { min: Math.min(MIN_CUSTOMERS, max), max };
}

/**
 * The preset scaled to `customers`, with every banlist scaled by the same factor, so overlap
 * fractions (and the story) stay the same at a size elliptic-curve PSI runs in seconds.
 */
export function scaledConfig(config: ScenarioConfig, customers: number): ScenarioConfig {
  const full = config.querier.customers;
  if (customers === full) return config;
  if (!Number.isInteger(customers) || customers < 1) throw new RangeError(`bad customer count ${customers}`);
  const factor = customers / full;
  return {
    ...config,
    querier: { ...config.querier, customers },
    holders: config.holders.map((h) => ({
      ...h,
      banlistSize: Math.max(1, Math.round(h.banlistSize * factor)),
    })),
  };
}

/** `customers` defaults to the preset's own size. */
export function buildPreset(id: PresetId, seed?: number, customers?: number): Scenario {
  const base = getPreset(id).config;
  const config = scaledConfig(base, customers ?? base.querier.customers);
  return buildScenario(seed === undefined ? config : { ...config, seed });
}
