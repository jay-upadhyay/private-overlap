// localStorage can be missing or throw (private windows, blocked site data), so every
// access is guarded and the page works without it.

export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not remembered; nothing else to do.
  }
}
