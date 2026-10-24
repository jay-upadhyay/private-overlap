import type { WireEntry } from '../protocol/types';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/** Scrolls a page control into view and flashes it, for links from the explainer. */
export function revealControl(testId: string): void {
  const el = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (!el) return;
  el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}

export function defaultEavesdropperSees(entry: WireEntry): string {
  return `A ${formatBytes(entry.bytes)} '${entry.type}' message from ${entry.from} to ${entry.to}, with the payload above.`;
}
