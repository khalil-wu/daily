/** Memory-only authorization: never restored from local storage or a URL. */
export function createHiddenAccessSession() {
  let verifiedHash: string | null = null;
  const listeners = new Set<() => void>();
  const update = (hash: string | null) => {
    if (verifiedHash === hash) return;
    verifiedHash = hash;
    listeners.forEach(listener => listener());
  };
  return {
    snapshot: () => verifiedHash,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    unlock: (hash: string) => update(hash),
    lock: () => update(null),
  };
}

export const hiddenAccess = createHiddenAccessSession();

export function isHiddenFlow(path: string): boolean {
  return path === '/sync-conflict' || path === '/saved' || path === '/settings/backup' || path === '/settings/transfer' || path === '/hidden' || path === '/trash' || path === '/write' || path === '/templates' || path.startsWith('/memory/') || path.startsWith('/picker/');
}
