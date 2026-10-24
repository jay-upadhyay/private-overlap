import type { StageDefinition } from '../stages';
import { AttackerPanel } from './AttackerPanel';
import { BudgetPanel } from './BudgetPanel';
import { EpsilonPanel } from './EpsilonPanel';
import { runEstimate } from './estimate';
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
        onRunAttack={s.attackAvailable ? s.runAttack : undefined}
        attackBusy={attackBusy}
      />

      <ScenarioBar
        presetId={s.presetId}
        onPresetChange={s.setPresetId}
        field={s.field}
        onFieldChange={s.setField}
        seed={s.seed}
        onSeedChange={s.setSeed}
        customers={s.customers}
        customerRange={s.customerRange}
        onCustomersChange={s.setCustomers}
        estimate={runEstimate(stage.id, scenario, s.epsilon)}
        sizeNote={`${scenario.querier.records.length.toLocaleString()} customers; banlists of ${scenario.holders
          .map((h) => h.records.length.toLocaleString())
          .join(', ')}.`}
        status={s.status}
        progress={s.progress}
        progressLabel={s.progressLabel}
        error={s.error}
        onRun={s.run}
        onCancel={s.cancel}
      />

      {stage.id === 'dp-risk' && (
        <>
          <EpsilonPanel
            scenario={scenario}
            epsilon={s.epsilon}
            onEpsilonChange={s.setEpsilon}
            disabled={s.status === 'running'}
            runs={s.runHistory}
          />
          <BudgetPanel scenario={scenario} epsilon={s.epsilon} />
        </>
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
          available={s.attackAvailable}
          onRunAttack={s.runAttack}
        />
      </div>
    </main>
  );
}
