import type { StageDefinition } from '../stages';
import { AttackerPanel } from './AttackerPanel';
import { Explainer } from './Explainer';
import { PartyCard } from './PartyCard';
import { ResultsPanel } from './ResultsPanel';
import { ScenarioBar } from './ScenarioBar';
import { useStageRun } from './useStageRun';
import { WireInspector } from './WireInspector';

/** The layout every stage shares: explainer, scenario, parties, wire, then results beside the attack. */
export function StagePage({ stage }: { stage: StageDefinition }) {
  const s = useStageRun(stage);
  const { scenario } = s;
  const names = Object.fromEntries(
    [scenario.querier, ...scenario.holders].map((p) => [p.institution.id, p.institution.name]),
  );
  const attackBusy = s.attackStatus === 'running';

  return (
    <main className="stage-page" data-testid={`stage-${stage.id}`}>
      <h2>
        Stage {stage.number}: {stage.title}
      </h2>
      <p className="stage-summary">{stage.summary}</p>

      <Explainer
        stageId={stage.id}
        explainer={stage.explainer}
        onRunAttack={s.runAttack}
        attackBusy={attackBusy}
      />

      <ScenarioBar
        presetId={s.presetId}
        onPresetChange={s.setPresetId}
        field={s.field}
        onFieldChange={s.setField}
        seed={s.seed}
        onSeedChange={s.setSeed}
        status={s.status}
        progress={s.progress}
        progressLabel={s.progressLabel}
        error={s.error}
        onRun={s.run}
        onCancel={s.cancel}
      />
      {s.usesFixtures && (
        <p className="fixture-note small" data-testid="fixture-note">
          Preview: this page runs a stand-in protocol that sends plaintext. The real one arrives in a later
          build.
        </p>
      )}

      <section className="parties" data-testid="party-cards" aria-labelledby="parties-heading">
        <header className="panel-header">
          <h3 id="parties-heading">Institutions</h3>
          <label className="toggle">
            <input
              type="checkbox"
              data-testid="god-view-toggle"
              checked={s.godView}
              onChange={(e) => s.setGodView(e.target.checked)}
            />
            God view (show private rows)
          </label>
        </header>
        <div className="party-grid">
          <PartyCard
            institution={scenario.querier.institution}
            role="querier"
            records={scenario.querier.records}
            field={s.field}
            godView={s.godView}
          />
          {scenario.holders.map((h) => (
            <PartyCard
              key={h.institution.id}
              institution={h.institution}
              role="holder"
              records={h.records}
              field={s.field}
              godView={s.godView}
            />
          ))}
        </div>
      </section>

      <WireInspector entries={s.wire} names={names} eavesdropperSees={stage.eavesdropperSees} />

      <div className="outcome-grid">
        <ResultsPanel run={s.completed} />
        <AttackerPanel
          breaks={stage.explainer.breaks}
          status={s.attackStatus}
          outcome={s.attackOutcome}
          error={s.attackError}
          onRunAttack={s.runAttack}
        />
      </div>
    </main>
  );
}
