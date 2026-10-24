import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MatchField } from '../data/normalize';
import { buildPreset, getPreset, type PresetId } from '../data/presets';
import type { Progress, WireEntry } from '../protocol/types';
import type { AttackOutcome, StageDefinition } from '../stages';
import { fixtureRunAttack, fixtureRunProtocol } from './fixtures/runners';
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
  const scenario = useMemo(() => buildPreset(presetId, effectiveSeed), [presetId, effectiveSeed]);

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
  };
  const setField = (f: MatchField) => {
    reset();
    setFieldState(f);
  };
  const setSeed = (s: string) => {
    reset();
    setSeedState(s);
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
      const querier = await (stage.runProtocol ?? fixtureRunProtocol)({
        scenario,
        field,
        signal: controller.signal,
        onMessage: (entry) => live() && setWire((w) => [...w, entry]),
        onProgress,
      });
      if (!live()) return;
      setCompleted({ scenario, querier });
      setProgress(1);
      setStatus('done');
    } catch (e) {
      if (!live()) return;
      setStatus(controller.signal.aborted ? 'cancelled' : 'error');
      setError(message(e));
    }
  }, [protocolRun, scenario, field, stage]);

  const runAttack = useCallback(async () => {
    if (stage.explainer.breaks.kind !== 'attack') return;
    const controller = attackRun.start();
    const live = () => attackRun.isLatest(controller);
    setAttackStatus('running');
    setAttackOutcome(null);
    setAttackError(null);
    try {
      const outcome = await (stage.runAttack ?? fixtureRunAttack)({
        scenario,
        field,
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
  }, [attackRun, scenario, field, stage, wire]);

  return {
    presetId,
    setPresetId,
    field,
    setField,
    seed,
    setSeed,
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
    usesFixtures: !stage.runProtocol,
  };
}
