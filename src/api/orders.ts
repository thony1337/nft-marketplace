import type { CollectorData, OrderRecord } from '../types';
import { api } from './client';

export type CreateOrderInput = { walletId: string; quoteFingerprint: string; collector: CollectorData };

// `replayed` is true when the server recognised the key and returned the order it already had
export async function createOrderRequest(idempotencyKey: string, input: CreateOrderInput) {
  const res = await api.post<OrderRecord>('/orders', input, { headers: { 'Idempotency-Key': idempotencyKey } });
  return { order: res.data, replayed: res.headers['idempotent-replay'] === 'true' };
}

export const fetchOrder = async (id: string): Promise<OrderRecord> => (await api.get<OrderRecord>(`/orders/${id}`)).data;

export const fetchOrders = async (): Promise<OrderRecord[]> =>
  (await api.get<{ items: OrderRecord[] }>('/orders')).data.items;
