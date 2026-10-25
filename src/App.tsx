import { DataDebugPage } from './debug/DataDebugPage';
import { formatRoute, useRoute, type Route } from './routing';
import { STAGES, type StageDefinition } from './stages';
import { Landing } from './ui/Landing';
import { StagePage } from './ui/StagePage';
import { SummaryPage } from './ui/SummaryPage';
import { TheoryPage } from './ui/theory/TheoryPage';
import { useWorkerHealth } from './workers/useWorkerHealth';

function stageOf(route: Route): StageDefinition | null {
  return route.kind === 'stage' || route.kind === 'theory'
    ? (STAGES.find((s) => s.id === route.stage) ?? null)
    : null;
}

function Page({ route }: { route: Route }) {
  const stage = stageOf(route);
  switch (route.kind) {
    case 'home':
      return <Landing />;
    case 'summary':
      return <SummaryPage />;
    case 'debug-data':
      return <DataDebugPage />;
    case 'theory':
      return <TheoryPage stage={stage!} />;
    case 'stage':
      return <StagePage key={stage!.id} stage={stage!} />;
  }
}

export function App() {
  const route = useRoute();
  const current = stageOf(route);
  const workers = useWorkerHealth();

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          <a href={formatRoute({ kind: 'home' })} className="home-link">
            Private Overlap
          </a>
        </h1>
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
                aria-current={s.id === current?.id && route.kind === 'stage' ? 'page' : undefined}
              >
                <span className="stage-number">{s.number}</span> {s.title}
              </a>
            </li>
          ))}
          <li>
            <a
              href={formatRoute({ kind: 'summary' })}
              aria-current={route.kind === 'summary' ? 'page' : undefined}
            >
              Summary
            </a>
          </li>
        </ol>
      </nav>

      <Page route={route} />

      <footer className="app-footer">
        <span data-testid="worker-health">Workers: {workers}</span>
      </footer>
    </div>
  );
}
