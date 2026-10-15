// Where the signed-in session and the anonymous guest id live in the browser.
// Everything is wrapped in try/catch: storage can be blocked, full or missing.

// Same key the first version of the app used, so nothing breaks while pages are migrated
const TOKEN_KEY = 'auth_token';
const EXPIRES_KEY = 'auth_expires_at';
const GUEST_KEY = 'kurio:guest-id';

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null): boolean => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    return true;
  } catch {
    return false; // storage unavailable: the session then lasts only until the page closes
  }
};

type StoredSession = { token: string; expiresAt: string | null };
// Only used when storage is blocked. When storage works it must stay empty, otherwise a
// sign-out made in another tab would not reach this one.
let memory: StoredSession | null = null;

export function getSession(): StoredSession | null {
  const token = read(TOKEN_KEY);
  if (token) return { token, expiresAt: read(EXPIRES_KEY) };
  return memory;
}

export const getToken = (): string | null => getSession()?.token ?? null;

const listeners = new Set<() => void>();
export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const notify = () => listeners.forEach((l) => l());

export function setSession(token: string, expiresAt: string): void {
  const stored = write(TOKEN_KEY, token) && write(EXPIRES_KEY, expiresAt);
  memory = stored ? null : { token, expiresAt };
  notify();
}

export function clearSession(): void {
  memory = null;
  write(TOKEN_KEY, null);
  write(EXPIRES_KEY, null);
  notify();
}

// Another tab signed in or out
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === TOKEN_KEY || event.key === null) notify();
  });
}

// ---- guest id: who owns the cart before login ---------------------------------------------

let guestMemory: string | null = null;

export function getGuestId(): string {
  const saved = read(GUEST_KEY) ?? guestMemory;
  if (saved) return saved;
  const id = `guest-${crypto.randomUUID()}`;
  guestMemory = id;
  write(GUEST_KEY, id);
  return id;
}

// Is there a guest id (and so possibly a guest cart) without creating one?
export function peekGuestId(): string | null {
  return read(GUEST_KEY) ?? guestMemory;
}

// After the guest cart was merged into the account the id is spent
export function resetGuestId(): void {
  guestMemory = null;
  write(GUEST_KEY, null);
}
