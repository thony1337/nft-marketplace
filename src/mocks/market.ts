import Decimal from 'decimal.js';
import { DECIMAL_RE } from '../lib/catalog';
import type { NFT, NftDetail } from '../types';
import { mockNftDetails } from './data';
import { getDb, saveDb } from './db';
import { toSummary } from './nftFixtures';

// The catalog as it is right now: the fixtures plus every price/stock change made since the
// last reset. REST routes, cart, quote and orders all read through here, so they never disagree.

export function liveDetail(base: NftDetail): NftDetail {
  const m = getDb().market;
  const editions = base.editions.map((e) => ({ ...e, stock: m.stocks[`${base.id}:${e.id}`] ?? e.stock }));
  const stock = editions.reduce((sum, e) => sum + e.stock, 0);
  return {
    ...base,
    priceInEth: m.prices[base.id] ?? base.priceInEth,
    editions,
    stock,
    isAvailable: stock > 0,
    version: base.version + (m.versions[base.id] ?? 0),
  };
}

export const liveDetails = (): NftDetail[] => mockNftDetails.map(liveDetail);
export const liveSummaries = (): NFT[] => liveDetails().map(toSummary);
export function liveDetailById(id: string): NftDetail | undefined {
  const base = mockNftDetails.find((n) => n.id === id);
  return base ? liveDetail(base) : undefined;
}

// Chunk 5 plugs the Socket.IO server in here, so every change is also broadcast as an event
export type MarketChange = { nftId: string; version: number; detail: NftDetail; previous: NftDetail };
type Listener = (change: MarketChange) => void;
const listeners = new Set<Listener>();
export function onMarketChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Applies a change, bumps the version, and tells the listeners what it was before and after
function commit(nftId: string, apply: () => void): NftDetail {
  const previous = liveDetailById(nftId)!;
  apply();
  const m = getDb().market;
  m.versions[nftId] = (m.versions[nftId] ?? 0) + 1;
  saveDb();
  const detail = liveDetailById(nftId)!;
  for (const listener of listeners) listener({ nftId, version: detail.version, detail, previous });
  return detail;
}

export function setPrice(nftId: string, priceInEth: string): NftDetail {
  if (!liveDetailById(nftId)) throw new Error(`Unknown NFT: ${nftId}`);
  if (!DECIMAL_RE.test(priceInEth)) throw new Error(`Invalid price: ${priceInEth}`);
  return commit(nftId, () => {
    getDb().market.prices[nftId] = new Decimal(priceInEth).toFixed();
  });
}

export function setEditionStock(nftId: string, editionId: string, stock: number): NftDetail {
  const detail = liveDetailById(nftId);
  if (!detail?.editions.some((e) => e.id === editionId)) throw new Error(`Unknown edition: ${nftId}/${editionId}`);
  if (!Number.isInteger(stock) || stock < 0) throw new Error(`Invalid stock: ${stock}`);
  return commit(nftId, () => {
    getDb().market.stocks[`${nftId}:${editionId}`] = stock;
  });
}

// Used by confirmed orders; never goes below zero
export function adjustStock(nftId: string, editionId: string, delta: number): NftDetail {
  const current = liveDetailById(nftId)?.editions.find((e) => e.id === editionId)?.stock ?? 0;
  return setEditionStock(nftId, editionId, Math.max(0, current + delta));
}

export function setFeeMultiplier(multiplier: string): void {
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(multiplier)) throw new Error(`Invalid multiplier: ${multiplier}`);
  getDb().market.feeMultiplier = multiplier;
  saveDb();
}
