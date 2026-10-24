import type { MatchField } from '../data/normalize';
import type { CustomerRecord, Institution } from '../data/scenario';

/** Raw rows shown per card in god view. */
export const GOD_VIEW_ROWS = 5;

interface PartyCardProps {
  institution: Institution;
  role: 'querier' | 'holder';
  records: readonly CustomerRecord[];
  field: MatchField;
  godView: boolean;
}

function LockIcon() {
  return (
    <svg
      className="lock-icon"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function PartyCard({ institution, role, records, field, godView }: PartyCardProps) {
  const noun = role === 'querier' ? 'customers' : 'banlist entries';
  return (
    <article className="party-card" data-testid={`party-${institution.id}`} aria-label={institution.name}>
      <header className="party-card-header">
        <h4>{institution.name}</h4>
        <span className="party-lock" title="Private: never leaves this institution">
          <LockIcon />
          <span className="visually-hidden">Private</span>
        </span>
      </header>
      <p className="party-meta">
        <span className={`role-badge role-${role}`}>{role === 'querier' ? 'Querier' : 'Holder'}</span>{' '}
        {institution.kind} &middot; {records.length.toLocaleString()} {noun}
      </p>
      {godView && (
        <ul className="party-rows" data-testid="party-rows" aria-label={`${institution.name} raw rows`}>
          {records.slice(0, GOD_VIEW_ROWS).map((r) => (
            <li key={r.rowId}>
              <span className="party-row-name">
                {r.firstName} {r.lastName}
              </span>
              <code>{r[field]}</code>
            </li>
          ))}
          {records.length > GOD_VIEW_ROWS && (
            <li className="muted">and {(records.length - GOD_VIEW_ROWS).toLocaleString()} more</li>
          )}
        </ul>
      )}
    </article>
  );
}
