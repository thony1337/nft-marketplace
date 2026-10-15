// One purchase attempt = one Idempotency-Key. The key belongs to what the user confirmed
// (wallet + quote fingerprint + collector data): the same content always reuses the same key, so a retry after a
// timeout or a page refresh can never create a second order. Different content gets a new key.
// It lives in sessionStorage (this tab only) and is tied to the session token.
const STORAGE_KEY = 'kurio:checkout-attempt';

import type { CollectorData } from '../types';

export type CheckoutAttempt = {
  key: string;
  token: string;
  walletId: string;
  fingerprint: string;
  collector: CollectorData;
};

const newKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `kurio-${crypto.randomUUID()}`
    : `kurio-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

function read(): CheckoutAttempt | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<CheckoutAttempt>;
    return value.key && value.token && value.walletId && value.fingerprint && value.collector
      ? (value as CheckoutAttempt)
      : null;
  } catch {
    return null;
  }
}

function write(attempt: CheckoutAttempt | null) {
  try {
    if (attempt) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attempt));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage blocked: the attempt only lives while this page is open
  }
}

// An unfinished attempt of this session, if any (someone else's is ignored and dropped)
export function loadAttempt(token: string): CheckoutAttempt | null {
  const saved = read();
  if (saved && saved.token !== token) {
    write(null);
    return null;
  }
  return saved;
}

// Same content = same key. Content is compared field by field, in a fixed order.
const same = (a: CollectorData, b: CollectorData) => JSON.stringify(a, Object.keys(a).sort()) === JSON.stringify(b, Object.keys(b).sort());

export function attemptFor(token: string, walletId: string, fingerprint: string, collector: CollectorData): CheckoutAttempt {
  const saved = loadAttempt(token);
  if (saved && saved.walletId === walletId && saved.fingerprint === fingerprint && same(saved.collector, collector)) {
    return saved;
  }
  const attempt = { key: newKey(), token, walletId, fingerprint, collector };
  write(attempt);
  return attempt;
}

export const clearAttempt = () => write(null);
