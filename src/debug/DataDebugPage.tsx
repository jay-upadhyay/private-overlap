import { useMemo, useState } from 'react';
import { normalizeField, type MatchField } from '../data/normalize';
import { buildPreset, PRESETS, type PresetId } from '../data/presets';
import type { CustomerRecord, Scenario } from '../data/scenario';

// Hidden page (#/debug/data) for inspecting generated data and ground truth.
// It deliberately shows everything; the stage pages never will.

const SAMPLE_ROWS = 8;

function flaggedHistogram(scenario: Scenario): number[] {
  const counts = new Array<number>(scenario.holders.length).fill(0);
  for (const by of Object.values(scenario.truth.flaggedBy)) counts[by.length - 1]!++;
  return counts;
}

function SampleTable({ records, field }: { records: CustomerRecord[]; field: MatchField }) {
  return (
    <table className="debug-table">
      <thead>
        <tr>
          <th>Row</th>
          <th>Name</th>
          <th>Stored {field}</th>
          <th>Normalized</th>
        </tr>
      </thead>
      <tbody>
        {records.slice(0, SAMPLE_ROWS).map((r) => (
          <tr key={r.rowId}>
            <td>{r.rowId}</td>
            <td>
              {r.firstName} {r.lastName}
            </td>
            <td>
              <code>{JSON.stringify(r[field])}</code>
            </td>
            <td>
              <code>{normalizeField(field, r[field])}</code>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DataDebugPage() {
  const [presetId, setPresetId] = useState<PresetId>('consortium');
  const [field, setField] = useState<MatchField>('email');
  const scenario = useMemo(() => buildPreset(presetId), [presetId]);
  const histogram = flaggedHistogram(scenario);
  const flagged = Object.keys(scenario.truth.flaggedBy).length;

  return (
    <main className="stage-page" data-testid="debug-data">
      <h2>Debug: generated data</h2>
      <div className="debug-controls">
        <label>
          Preset{' '}
          <select value={presetId} onChange={(e) => setPresetId(e.target.value as PresetId)}>
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Field{' '}
          <select value={field} onChange={(e) => setField(e.target.value as MatchField)}>
            <option value="email">email</option>
            <option value="phone">phone</option>
            <option value="wallet">wallet</option>
          </select>
        </label>
      </div>

      <h3>Ground truth</h3>
      <p data-testid="truth-summary">
        {flagged} of {scenario.querier.records.length.toLocaleString()} customers are flagged.{' '}
        {histogram.map((n, i) => `${n} by ${i + 1}`).join(', ')}.
      </p>

      <h3>
        {scenario.querier.institution.name} (querier) &middot;{' '}
        {scenario.querier.records.length.toLocaleString()} customers
      </h3>
      <SampleTable records={scenario.querier.records} field={field} />

      {scenario.holders.map((h) => (
        <section key={h.institution.id}>
          <h3>
            {h.institution.name} (banlist) &middot; {h.records.length.toLocaleString()} entries
          </h3>
          <SampleTable records={h.records} field={field} />
        </section>
      ))}
    </main>
  );
}
