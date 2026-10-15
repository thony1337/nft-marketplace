import type { OrderRecord, Wallet } from '../types';
import { seedUsers, seedWallets, type DbUser } from './seed';
import { createStore } from './storage';
import type { ScenarioName } from './scenarios';

const STORAGE_KEY = 'kurio:mock-db:v1';
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export type Session = { token: string; userId: string; expiresAt: string };

export type CartRow = { id: string; nftId: string; editionId: string; quantity: number };

export type MarketState = {
  prices: Record<string, string>; // nftId -> current price
  stocks: Record<string, number>; // 'nftId:editionId' -> current stock
  versions: Record<string, number>; // nftId -> how many times it changed
  feeMultiplier: string; // decimal string, scales the network fee
};

export type DbOrder = OrderRecord & {
  userId: string;
  idempotencyKey: string;
  requestHash: string; // what the first request with this key asked for
  settlesAt: number; // when the simulated payment gets its answer
  outcome: 'confirmed' | 'declined'; // decided when the order is created
};

export type Db = {
  scenario: ScenarioName;
  users: DbUser[];
  sessions: Session[];
  // userId -> favorite NFT ids, most recent first
  favorites: Record<string, string[]>;
  // 'user:<id>' or 'guest:<guestId>' -> cart lines
  carts: Record<string, CartRow[]>;
  // userId -> wallets
  wallets: Record<string, Wallet[]>;
  // cart owner key -> applied coupon code
  coupons: Record<string, string>;
  market: MarketState;
  orders: DbOrder[];
  // one-time scenario effects that already happened (cleared by reset)
  oneShots: Record<string, boolean>;
};

const store = createStore();
let cache: Db | undefined;

function seedDb(scenario: ScenarioName = 'default'): Db {
  return { scenario, users: structuredClone(seedUsers), sessions: [], favorites: {}, carts: {}, wallets: structuredClone(seedWallets),
    coupons: {},
    market: { prices: {}, stocks: {}, versions: {}, feeMultiplier: '1' },
    orders: [],
    oneShots: {},
  };
}

export function getDb(): Db {
  if (cache) return cache;
  let saved: Partial<Db> = {};
  const raw = store.get(STORAGE_KEY);
  if (raw) {
    try {
      saved = JSON.parse(raw) as Partial<Db>;
    } catch {
      // corrupted data: start again from the seed
    }
  }
  // New top-level keys added in later versions fall back to their seed values
  cache = { ...seedDb(), ...saved };
  return cache;
}

export function saveDb(): void {
  if (!cache) return;
  try {
    store.set(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // storage full (e.g. a large avatar): the in-memory copy still works for this page load
  }
}

// Restores a fully known state. Also drops every session.
export function resetDb(scenario: ScenarioName = 'default'): Db {
  cache = seedDb(scenario);
  saveDb();
  return cache;
}

export function createSession(userId: string): Session {
  const db = getDb();
  const now = Date.now();
  // Keep recently expired sessions for a day, so "expired" can still be told apart from "unknown"
  db.sessions = db.sessions.filter((s) => Date.parse(s.expiresAt) > now - 24 * 60 * 60 * 1000);
  const session: Session = {
    token: `kurio_${crypto.randomUUID()}`,
    userId,
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
  };
  db.sessions.push(session);
  saveDb();
  return session;
}

// Forget the in-memory copy so the next read comes from storage (another tab wrote to it)
export function invalidateDbCache(): void {
  cache = undefined;
}

// Another tab changed the data: forget our copy and read it again next time
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) cache = undefined;
  });
}
