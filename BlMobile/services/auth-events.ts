type Listener = () => void;
const listeners = new Set<Listener>();

export function onAuthExpired(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function emitAuthExpired(): void {
  for (const fn of listeners) {
    try { fn(); } catch { /* ignore */ }
  }
}
