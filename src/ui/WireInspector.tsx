import { useEffect, useRef } from 'react';
import type { PartyId, WireEntry } from '../protocol/types';
import { defaultEavesdropperSees, formatBytes } from './format';

interface WireInspectorProps {
  entries: readonly WireEntry[];
  /** Display names by party id; unknown ids show as is. */
  names?: Readonly<Record<PartyId, string>>;
  eavesdropperSees?: (entry: WireEntry) => string;
}

export function WireInspector({
  entries,
  names = {},
  eavesdropperSees = defaultEavesdropperSees,
}: WireInspectorProps) {
  const logRef = useRef<HTMLOListElement>(null);
  const total = entries.reduce((sum, e) => sum + e.bytes, 0);

  // Follow the newest message as the log grows.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [entries.length]);

  return (
    <section className="panel wire-inspector" data-testid="wire-inspector" aria-labelledby="wire-heading">
      <header className="panel-header">
        <h3 id="wire-heading">Wire inspector</h3>
        <span className="muted" data-testid="wire-summary">
          {entries.length} {entries.length === 1 ? 'message' : 'messages'} &middot; {formatBytes(total)}
        </span>
      </header>
      {entries.length === 0 ? (
        <p className="muted empty">No messages yet. Press Run to watch what crosses the wire.</p>
      ) : (
        <ol ref={logRef} className="wire-log" aria-label="Messages on the wire" tabIndex={0}>
          {entries.map((e) => (
            <li key={e.seq} className="wire-entry" data-testid="wire-entry">
              <div className="wire-entry-head">
                <span className="wire-seq">#{e.seq}</span>
                <span className="wire-route">
                  {names[e.from] ?? e.from} <span aria-label="to">→</span> {names[e.to] ?? e.to}
                </span>
                <span className="wire-type">{e.type}</span>
                <span className="muted">round {e.round}</span>
                <span className="wire-bytes">{formatBytes(e.bytes)}</span>
              </div>
              <code className="wire-preview">{e.preview}</code>
              <p className="wire-eavesdrop">
                <strong>Eavesdropper sees:</strong> {eavesdropperSees(e)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
