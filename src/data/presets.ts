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

/**
 * 'full' is the preset as written. 'small' divides customers and banlists by 10 and keeps every
 * overlap fraction, so the story is the same at a size elliptic-curve PSI runs in seconds.
 */
export type PresetSize = 'full' | 'small';

export const SIZE_DIVISOR: Readonly<Record<PresetSize, number>> = { full: 1, small: 10 };

export function scaledConfig(config: ScenarioConfig, size: PresetSize): ScenarioConfig {
  const d = SIZE_DIVISOR[size];
  if (d === 1) return config;
  return {
    ...config,
    querier: { ...config.querier, customers: Math.max(1, Math.round(config.querier.customers / d)) },
    holders: config.holders.map((h) => ({ ...h, banlistSize: Math.max(1, Math.round(h.banlistSize / d)) })),
  };
}

export function buildPreset(id: PresetId, seed?: number, size: PresetSize = 'full'): Scenario {
  const config = scaledConfig(getPreset(id).config, size);
  return buildScenario(seed === undefined ? config : { ...config, seed });
}
