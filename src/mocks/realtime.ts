import { ws } from 'msw';
import { toSocketIo } from '@mswjs/socket.io-binding';
import {
  SOCKET_EVENTS,
  SOCKET_PATH,
  type AuthErrorEvent,
  type NftUpdatedEvent,
  type OrderUpdatedEvent,
  type SessionReadyEvent,
} from '../lib/socketEvents';
import type { NftDetail, OrderRecord } from '../types';
import { getDb, invalidateDbCache } from './db';
import { liveDetailById, onMarketChange, type MarketChange } from './market';
import { onOrderChange, publicOrder, type OrderChange } from './orderEngine';
import { activeScenario } from './scenarios';

// Socket.IO over MSW. Limits worth knowing (also in the README):
//  - the client must import socket.io-client AFTER MSW started: it grabs the global WebSocket
//    when its module loads, so importing it earlier would bypass the mock
//  - websocket transport only (transports: ['websocket']) on the path SOCKET_PATH; no long-polling
//  - one namespace ("/"), no rooms or acknowledgements
//  - the server side lives in the page that runs the handlers, so other tabs are reached
//    through a BroadcastChannel
//  - the binding fakes the handshake, so this file sends the engine.io pings itself

const socketLink = ws.link(`*${SOCKET_PATH.replace(/\/$/, '')}`);

const PING_INTERVAL_MS = 25_000; // must match the binding's fake handshake

type Emitter = { emit: (event: string, ...data: unknown[]) => void };
type Client = {
  id: number;
  io: Emitter;
  close: () => void;
  token: string | null;
  userId: string | null;
};

const clients = new Set<Client>();
let nextId = 1;
let socketsDown = false;

// ---- who is this token? -------------------------------------------------------------------

type TokenState = { userId: string } | { error: AuthErrorEvent['code'] };

function resolveToken(token: string): TokenState {
  const session = getDb().sessions.find((s) => s.token === token);
  if (!session) return { error: 'UNAUTHENTICATED' };
  if (Date.parse(session.expiresAt) <= Date.now()) return { error: 'SESSION_EXPIRED' };
  return { userId: session.userId };
}

// The socket kept a user id, but the session behind it may be gone (logout, expiry)
function stillAuthenticated(client: Client): boolean {
  if (!client.userId || !client.token) return false;
  const state = resolveToken(client.token);
  if ('userId' in state && !activeScenario().sessionExpired) return true;
  client.userId = null;
  client.io.emit(SOCKET_EVENTS.authError, {
    code: 'userId' in state ? 'SESSION_EXPIRED' : state.error,
  } satisfies AuthErrorEvent);
  return false;
}

// ---- payloads -----------------------------------------------------------------------------

const nftPayload = (d: NftDetail, version = d.version, priceInEth = d.priceInEth): NftUpdatedEvent => ({
  id: d.id,
  version,
  priceInEth,
  stock: d.stock,
  isAvailable: d.isAvailable,
  editions: d.editions,
});

const orderPayload = (o: OrderRecord, version = o.version, status: OrderRecord['status'] = o.status): OrderUpdatedEvent => ({
  id: o.id,
  version,
  status,
  updatedAt: o.updatedAt,
});

// ---- delivery -----------------------------------------------------------------------------

function broadcast(event: string, payload: unknown, only?: (c: Client) => boolean): void {
  for (const client of clients) {
    if (only && !only(client)) continue;
    client.io.emit(event, payload);
  }
}

function deliverNft(detail: NftDetail, previous: NftDetail): void {
  const send = (p: NftUpdatedEvent) => broadcast(SOCKET_EVENTS.nftUpdated, p);
  send(nftPayload(detail));
  if (activeScenario().socket === 'noisy') {
    send(nftPayload(detail)); // duplicate
    // a late copy of the previous state
    setTimeout(() => send(nftPayload(previous, detail.version - 1)), 40);
  }
}

function deliverOrder(order: OrderRecord, userId: string): void {
  const send = (p: OrderUpdatedEvent) =>
    broadcast(SOCKET_EVENTS.orderUpdated, p, (c) => c.userId === userId && stillAuthenticated(c));
  send(orderPayload(order));
  if (activeScenario().socket === 'noisy') {
    send(orderPayload(order)); // duplicate
    // a late copy of the order as it was before its last change
    if (order.version > 1) setTimeout(() => send(orderPayload(order, order.version - 1, 'pending')), 40);
  }
}

// ---- other tabs ---------------------------------------------------------------------------
// Each tab runs its own copy of this code, so a change made in one tab is announced to the others.

type BridgeMessage = { kind: 'nft'; nftId: string; previous: NftDetail } | { kind: 'order'; orderId: string };
let channel: BroadcastChannel | undefined;

function bridge(): BroadcastChannel | undefined {
  if (channel || typeof BroadcastChannel === 'undefined') return channel;
  channel = new BroadcastChannel('kurio:mock-events');
  (channel as unknown as { unref?: () => void }).unref?.();
  channel.onmessage = (event: MessageEvent<BridgeMessage>) => {
    invalidateDbCache(); // the other tab already saved: read it fresh
    const msg = event.data;
    if (msg.kind === 'nft') {
      const detail = liveDetailById(msg.nftId);
      if (detail) deliverNft(detail, msg.previous);
    } else {
      const order = getDb().orders.find((o) => o.id === msg.orderId);
      if (order) deliverOrder(publicOrder(order), order.userId);
    }
  };
  return channel;
}

let listening = false;
function listenToChanges(): void {
  if (listening) return;
  listening = true;
  const tabs = bridge();
  onMarketChange((change: MarketChange) => {
    deliverNft(change.detail, change.previous);
    tabs?.postMessage({ kind: 'nft', nftId: change.nftId, previous: change.previous } satisfies BridgeMessage);
  });
  onOrderChange((change: OrderChange) => {
    deliverOrder(change.order, change.userId);
    tabs?.postMessage({ kind: 'order', orderId: change.orderId } satisfies BridgeMessage);
  });
}

// ---- connections --------------------------------------------------------------------------

// '40' is the Socket.IO CONNECT packet; the client's `auth` object follows as JSON
function readAuthToken(frame: string): string | null {
  if (!frame.startsWith('40')) return null;
  const json = frame.slice(2).replace(/^\/[^,]*,?/, '');
  if (!json) return null;
  try {
    const auth = JSON.parse(json) as { token?: unknown };
    return typeof auth.token === 'string' && auth.token ? auth.token : null;
  } catch {
    return null;
  }
}

export const realtimeHandlers = [
  socketLink.addEventListener('connection', ({ client, server }) => {
    if (socketsDown) {
      // Let the handshake complete, then cut it: the client sees a drop and keeps retrying.
      // (Closing before the handshake would leave it waiting for its own 20 s timeout.)
      toSocketIo({ client, server } as never);
      setTimeout(() => client.close(1001, 'Sockets are down'), 10);
      return;
    }
    listenToChanges();

    const io = toSocketIo({ client, server } as never);
    const me: Client = {
      id: nextId++,
      io: io.client,
      close: () => client.close(1001, 'Dropped by the mock controls'),
      token: null,
      userId: null,
    };

    const pings = setInterval(() => client.send('2'), PING_INTERVAL_MS);
    (pings as unknown as { unref?: () => void }).unref?.();

    client.addEventListener('message', (event) => {
      if (typeof event.data !== 'string' || clients.has(me)) return;
      if (!event.data.startsWith('40')) return;

      // The client asked to join the namespace: now we know its auth
      const token = readAuthToken(event.data);
      let authenticated = false;
      if (token) {
        const state = resolveToken(token);
        if ('userId' in state && !activeScenario().sessionExpired) {
          me.token = token;
          me.userId = state.userId;
          authenticated = true;
        } else {
          const code = 'userId' in state ? 'SESSION_EXPIRED' : state.error;
          io.client.emit(SOCKET_EVENTS.authError, { code: activeScenario().sessionExpired ? 'SESSION_EXPIRED' : code } satisfies AuthErrorEvent);
        }
      }
      clients.add(me);
      io.client.emit(SOCKET_EVENTS.sessionReady, { authenticated } satisfies SessionReadyEvent);
    });

    client.addEventListener('close', () => {
      clearInterval(pings);
      clients.delete(me);
    });
  }),
];

// ---- controls (console, tests) ------------------------------------------------------------

export const socketCount = () => clients.size;

// Closes every connection. Clients reconnect on their own; events sent meanwhile are lost.
export function dropSockets(): void {
  for (const client of [...clients]) client.close();
}

// While down, new connections are refused too (an outage, not just a blip)
export function setSocketsDown(down: boolean): void {
  socketsDown = down;
  if (down) dropSockets();
}

// A user's sockets lose their private access (called on logout and password change)
export function detachToken(token: string): void {
  for (const client of clients) {
    if (client.token === token) {
      client.userId = null;
      client.io.emit(SOCKET_EVENTS.authError, { code: 'UNAUTHENTICATED' } satisfies AuthErrorEvent);
    }
  }
}
