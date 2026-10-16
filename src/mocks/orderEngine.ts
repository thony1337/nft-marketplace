import type { OrderRecord } from '../types';
import { findEdition } from './cartLogic';
import { getDb, saveDb, type DbOrder } from './db';
import { adjustStock } from './market';
import { hash } from './quoteLogic';

// What the UI sees: everything except the bookkeeping fields
const BOOKKEEPING = ['userId', 'idempotencyKey', 'requestHash', 'settlesAt', 'outcome'] as const;
export function publicOrder(order: DbOrder): OrderRecord {
  const visible: Record<string, unknown> = { ...order };
  for (const field of BOOKKEEPING) delete visible[field];
  return visible as OrderRecord;
}

// Chunk 5 broadcasts these as `order.updated` socket events
export type OrderChange = { orderId: string; userId: string; version: number; order: OrderRecord };
type Listener = (change: OrderChange) => void;
const listeners = new Set<Listener>();
export function onOrderChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function emitOrderChange(order: DbOrder): void {
  const visible = publicOrder(order);
  for (const l of listeners) l({ orderId: order.id, userId: order.userId, version: order.version, order: visible });
}

function fakeTxHash(seed: string): string {
  let hex = '';
  for (let i = 0; hex.length < 64; i++) hex += hash(`${seed}:${i}`);
  return `0x${hex.slice(0, 64)}`;
}

// Takes only what was bought out of the cart; anything else stays
function removePurchased(order: DbOrder): void {
  const db = getDb();
  const key = `user:${order.userId}`;
  const rows = db.carts[key] ?? [];
  for (const line of order.receipt.items) {
    const row = rows.find((r) => r.nftId === line.nftId && r.editionId === line.editionId);
    if (row) row.quantity -= line.quantity;
  }
  db.carts[key] = rows.filter((r) => r.quantity > 0);
  delete db.coupons[key]; // the coupon was used
}

// Gives the simulated payment its answer. Safe to call twice: only a pending order changes.
export function settleOrder(order: DbOrder): void {
  if (order.status !== 'pending') return;

  let failure: DbOrder['failure'] = null;
  if (order.outcome === 'declined') {
    failure = { code: 'PAYMENT_DECLINED', message: 'Pagamento recusado pela carteira.' };
  } else {
    // Stock is only taken at confirmation, so it can run out while the payment is pending
    const short = order.receipt.items.find(
      (l) => (findEdition(l.nftId, l.editionId)?.edition.stock ?? 0) < l.quantity,
    );
    if (short) {
      failure = {
        code: 'OUT_OF_STOCK',
        message: `${short.title} (${short.editionLabel}) esgotou antes da confirmação do pagamento.`,
      };
    }
  }

  if (failure) {
    order.status = 'declined';
    order.failure = failure;
  } else {
    for (const l of order.receipt.items) adjustStock(l.nftId, l.editionId, -l.quantity);
    removePurchased(order);
    order.status = 'confirmed';
    order.txHash = fakeTxHash(order.id);
    order.explorerUrl = `https://explorer.kurio.invalid/tx/${order.txHash}`;
  }
  order.version += 1;
  order.updatedAt = new Date().toISOString();
  saveDb();
  emitOrderChange(order);
}

// Reads call this first, so a page refresh always sees the latest state
export function settleDueOrders(now = Date.now()): void {
  for (const order of getDb().orders) {
    if (order.status === 'pending' && now >= order.settlesAt) settleOrder(order);
  }
}

export function settleAllPending(): void {
  for (const order of getDb().orders) settleOrder(order);
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
export function scheduleSettle(order: DbOrder): void {
  // Even an instant payment is answered *after* the order was created, by the same path as any other:
  // a timer settles it and the owner is told through the live channel.
  const wait = Math.max(0, order.settlesAt - Date.now());
  clearTimeout(timers.get(order.id));
  timers.set(order.id, setTimeout(() => settleDueOrders(), wait + 5));
}

// After a page load: pending orders that were waiting when the page closed move on
export function resumePendingOrders(): void {
  settleDueOrders();
  for (const order of getDb().orders) if (order.status === 'pending') scheduleSettle(order);
}
