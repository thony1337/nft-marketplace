export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

// localStorage when the browser allows it, otherwise memory (tests, private modes)
export function createStore(): KeyValueStore {
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = '__kurio_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return {
        get: (key) => localStorage.getItem(key),
        set: (key, value) => localStorage.setItem(key, value),
        remove: (key) => localStorage.removeItem(key),
      };
    }
  } catch {
    // falls through to the in-memory store
  }
  const memory = new Map<string, string>();
  return {
    get: (key) => memory.get(key) ?? null,
    set: (key, value) => void memory.set(key, value),
    remove: (key) => void memory.delete(key),
  };
}