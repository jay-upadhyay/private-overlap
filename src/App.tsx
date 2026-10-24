import { DataDebugPage } from './debug/DataDebugPage';
import { formatRoute, useRoute } from './routing';
import { STAGES } from './stages';
import { StagePage } from './ui/StagePage';
import { useWorkerHealth } from './workers/useWorkerHealth';

export function App() {
  const route = useRoute();
  const stage = route.kind === 'stage' ? (STAGES.find((s) => s.id === route.stage) ?? STAGES[0]!) : null;
  const workers = useWorkerHealth();

  return (
    <div className="app">
      <header className="app-header">
        <h1>Private Overlap</h1>
        <p className="tagline">
          Screen customers against other institutions&rsquo; banlists without sharing either list.
        </p>
      </header>

      <nav aria-label="Stages" className="stage-nav">
        <ol>
          {STAGES.map((s) => (
            <li key={s.id}>
              <a
                href={formatRoute({ kind: 'stage', stage: s.id })}
                aria-current={s.id === stage?.id ? 'page' : undefined}
              >
                <span className="stage-number">{s.number}</span> {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {stage ? <StagePage key={stage.id} stage={stage} /> : <DataDebugPage />}

      <footer className="app-footer">
        <span data-testid="worker-health">Workers: {workers}</span>
      </footer>
    </div>
  );
}
