import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MatchField } from '../data/normalize';
import { buildPreset, customerRange, getPreset, type PresetId } from '../data/presets';
import { DEFAULT_SCORE_EPSILON } from '../dp';
import { tierMatchRate } from './results';
import type { Progress, WireEntry } from '../protocol/types';
import type { AttackOutcome, StageDefinition } from '../stages';
import type { CompletedRun } from './ResultsPanel';

export type RunStatus = 'idle' | 'running' | 'done' | 'cancelled' | 'error';

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Tracks one AbortController at a time, so a newer run makes older callbacks no-ops. */
function useLatestRun() {
  const ref = useRef<AbortController | null>(null);
  useEffect(() => () => ref.current?.abort(), []);
  return useMemo(
    () => ({
      start() {
        ref.current?.abort();
        const controller = new AbortController();
        ref.current = controller;
        return controller;
      },
      isLatest: (controller: AbortController) => ref.current === controller,
      cancel: () => ref.current?.abort(new DOMException('Cancelled', 'AbortError')),
      /** Aborts silently: the aborted run reports nothing, not even 'cancelled'. */
      discard() {
        ref.current?.abort();
        ref.current = null;
      },
    }),
    [],
  );
}

/** All state behind a stage page: scenario choice, the protocol run and the attack run. */
export function useStageRun(stage: StageDefinition) {
  const [presetId, setPresetIdState] = useState<PresetId>(stage.defaultPreset);
  const [field, setFieldState] = useState<MatchField>('email');
  const [seed, setSeedState] = useState(() => String(getPreset(stage.defaultPreset).config.seed));
  const defaultCustomers = (id: PresetId) => {
    const { min, max } = customerRange(id);
    return String(Math.max(min, Math.round(max * stage.defaultFraction)));
  };
  const [customers, setCustomersState] = useState(() => defaultCustomers(stage.defaultPreset));
  const [epsilon, setEpsilon] = useState(DEFAULT_SCORE_EPSILON);
  /** Stage 4: tier accuracy of each completed run, at the ε it used. */
  const [runHistory, setRunHistory] = useState<{ epsilon: number; accuracy: number }[]>([]);
  const [godView, setGodView] = useState(false);

  const [status, setStatus] = useState<RunStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [wire, setWire] = useState<WireEntry[]>([]);
  const [completed, setCompleted] = useState<CompletedRun | null>(null);

  const [attackStatus, setAttackStatus] = useState<RunStatus>('idle');
  const [attackOutcome, setAttackOutcome] = useState<AttackOutcome | null>(null);
  const [attackError, setAttackError] = useState<string | null>(null);

  const protocolRun = useLatestRun();
  const attackRun = useLatestRun();

  const parsedSeed = Number.parseInt(seed, 10);
  const effectiveSeed = Number.isFinite(parsedSeed) && parsedSeed >= 0 ? parsedSeed : undefined;
  const range = customerRange(presetId);
  const parsedCustomers = Number.parseInt(customers, 10);
  // Out-of-range or half-typed values clamp to the nearest allowed size.
  const effectiveCustomers = Number.isFinite(parsedCustomers)
    ? Math.min(range.max, Math.max(range.min, parsedCustomers))
    : range.max;
  const scenario = useMemo(
    () => buildPreset(presetId, effectiveSeed, effectiveCustomers),
    [presetId, effectiveSeed, effectiveCustomers],
  );

  // Results and attacks describe one scenario; changing it clears them.
  const reset = () => {
    protocolRun.discard();
    attackRun.discard();
    setStatus('idle');
    setProgress(0);
    setProgressLabel('');
    setError(null);
    setWire([]);
    setCompleted(null);
    setAttackStatus('idle');
    setAttackOutcome(null);
    setAttackError(null);
  };
  const setPresetId = (id: PresetId) => {
    reset();
    setPresetIdState(id);
    setSeedState(String(getPreset(id).config.seed));
    setCustomersState(defaultCustomers(id));
    setRunHistory([]);
  };
  const setField = (f: MatchField) => {
    reset();
    setFieldState(f);
  };
  const setSeed = (s: string) => {
    reset();
    setSeedState(s);
  };
  const setCustomers = (c: string) => {
    reset();
    setCustomersState(c);
  };

  const run = useCallback(async () => {
    const controller = protocolRun.start();
    const live = () => protocolRun.isLatest(controller);
    const parties = 1 + scenario.holders.length;
    const fractions = new Map<string, number>();
    setStatus('running');
    setProgress(0);
    setProgressLabel('');
    setError(null);
    setWire([]);
    setCompleted(null);
    const onProgress = (p: Progress) => {
      if (!live()) return;
      fractions.set(p.party, p.fraction);
      setProgress([...fractions.values()].reduce((a, b) => a + b, 0) / parties);
      if (p.label) setProgressLabel(p.label);
    };
    try {
      if (!stage.runProtocol) throw new Error('This stage has no protocol yet.');
      const querier = await stage.runProtocol({
        scenario,
        field,
        epsilon,
        signal: controller.signal,
        onMessage: (entry) => live() && setWire((w) => [...w, entry]),
        onProgress,
      });
      if (!live()) return;
      setCompleted({ scenario, querier, epsilon });
      if (querier.scores) {
        const accuracy = tierMatchRate(scenario, querier.scores);
        setRunHistory((h) => [...h, { epsilon, accuracy }]);
      }
      setProgress(1);
      setStatus('done');
    } catch (e) {
      if (!live()) return;
      setStatus(controller.signal.aborted ? 'cancelled' : 'error');
      setError(message(e));
    }
  }, [protocolRun, scenario, field, stage, epsilon]);

  const runAttack = useCallback(async () => {
    if (stage.explainer.breaks.kind !== 'attack' || !stage.runAttack) return;
    const controller = attackRun.start();
    const live = () => attackRun.isLatest(controller);
    setAttackStatus('running');
    setAttackOutcome(null);
    setAttackError(null);
    try {
      const outcome = await stage.runAttack({
        scenario,
        field,
        epsilon,
        signal: controller.signal,
        wire,
        onMessage: (entry) => live() && setWire((w) => [...w, entry]),
        onProgress: () => {},
      });
      if (!live()) return;
      setAttackOutcome(outcome);
      setAttackStatus('done');
    } catch (e) {
      if (!live()) return;
      setAttackStatus(controller.signal.aborted ? 'cancelled' : 'error');
      setAttackError(message(e));
    }
  }, [attackRun, scenario, field, stage, wire, epsilon]);

  return {
    presetId,
    setPresetId,
    field,
    setField,
    seed,
    setSeed,
    customers,
    setCustomers,
    customerRange: range,
    epsilon,
    setEpsilon,
    runHistory,
    godView,
    setGodView,
    scenario,
    status,
    progress,
    progressLabel,
    error,
    wire,
    completed,
    run,
    cancel: protocolRun.cancel,
    attackStatus,
    attackOutcome,
    attackError,
    runAttack,
    attackAvailable: !!stage.runAttack,
  };
}
