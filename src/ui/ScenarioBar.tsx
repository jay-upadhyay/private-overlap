import { MATCH_FIELDS, type MatchField } from '../data/normalize';
import { getPreset, PRESETS, type PresetId } from '../data/presets';
import { formatPercent } from './format';
import type { RunStatus } from './useStageRun';

interface ScenarioBarProps {
  presetId: PresetId;
  onPresetChange(id: PresetId): void;
  field: MatchField;
  onFieldChange(field: MatchField): void;
  seed: string;
  onSeedChange(seed: string): void;
  status: RunStatus;
  progress: number;
  progressLabel: string;
  error: string | null;
  onRun(): void;
  onCancel(): void;
}

const STATUS_TEXT: Record<RunStatus, string> = {
  idle: 'Ready to run.',
  running: 'Running…',
  done: 'Done.',
  cancelled: 'Cancelled.',
  error: 'Failed.',
};

export function ScenarioBar(props: ScenarioBarProps) {
  const { status, progress } = props;
  const running = status === 'running';
  return (
    <section className="scenario-bar" aria-label="Scenario">
      <div className="scenario-controls">
        <label className="field">
          <span>Preset</span>
          <select
            data-testid="preset-picker"
            value={props.presetId}
            disabled={running}
            onChange={(e) => props.onPresetChange(e.target.value as PresetId)}
          >
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Match field</span>
          <select
            data-testid="match-field"
            value={props.field}
            disabled={running}
            onChange={(e) => props.onFieldChange(e.target.value as MatchField)}
          >
            {MATCH_FIELDS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="field field-seed">
          <span>Seed</span>
          <input
            data-testid="seed-input"
            type="number"
            inputMode="numeric"
            min={0}
            value={props.seed}
            disabled={running}
            onChange={(e) => props.onSeedChange(e.target.value)}
          />
        </label>
        <div className="scenario-actions">
          <button
            type="button"
            className="button primary"
            data-testid="run-button"
            onClick={props.onRun}
            disabled={running}
          >
            Run
          </button>
          <button
            type="button"
            className="button"
            data-testid="cancel-button"
            onClick={props.onCancel}
            disabled={!running}
          >
            Cancel
          </button>
        </div>
      </div>
      <p className="preset-description">{getPreset(props.presetId).description}</p>
      <div className="run-status">
        <progress data-testid="run-progress" aria-label="Run progress" max={1} value={progress} />
        <span role="status" data-testid="run-status" data-status={status}>
          {STATUS_TEXT[status]}
          {running && ` ${formatPercent(progress)}${props.progressLabel ? `, ${props.progressLabel}` : ''}`}
          {status === 'error' && props.error && ` ${props.error}`}
        </span>
      </div>
    </section>
  );
}
