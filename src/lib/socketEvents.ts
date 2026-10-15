import type { Edition, OrderStatus } from '../types';

// socket.io-client must be created with { path: SOCKET_PATH, transports: ['websocket'] }.
// A dedicated path keeps MSW from touching Vite's own HMR socket.
export const SOCKET_PATH = '/realtime/';

// Names and payloads of the real-time events (Socket.IO, path /socket.io/, websocket only)
export const SOCKET_EVENTS = {
  nftUpdated: 'nft.updated',
  orderUpdated: 'order.updated',
  sessionReady: 'session.ready',
  authError: 'auth.error',
} as const;

// Sent to every connection. Apply it only if `version` is newer than what you already have.
export type NftUpdatedEvent = {
  id: string;
  version: number;
  priceInEth: string;
  stock: number;
  isAvailable: boolean;
  editions: Edition[];
};

// Sent only to sockets authenticated as the order's owner
export type OrderUpdatedEvent = {
  id: string;
  version: number;
  status: OrderStatus;
  updatedAt: string;
};

// First event after connecting: tells whether the token sent in `auth` was accepted
export type SessionReadyEvent = { authenticated: boolean };

// The token sent in `auth` (or an already accepted one) is no longer valid
export type AuthErrorEvent = { code: 'UNAUTHENTICATED' | 'SESSION_EXPIRED' };
