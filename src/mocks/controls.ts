import { getDb, resetDb, saveDb } from './db';
import { SOCKET_PATH } from '../lib/socketEvents';
import { dropSockets, setSocketsDown, socketCount } from './realtime';
import { resumePendingOrders, settleAllPending } from './orderEngine';
import { setEditionStock, setFeeMultiplier, setPrice } from './market';
import { isScenarioName, reseedLatency, SCENARIOS, type ScenarioName } from './scenarios';

export type MockControls = {
  scenarios: Record<string, string>;
  getScenario: () => ScenarioName;
  setScenario: (name: ScenarioName) => void;
  reset: (name?: ScenarioName) => void;
  expireSessions: () => void;
  // Change the market from the console (demos and tests); every route sees it
  setPrice: (nftId: string, priceInEth: string) => void;
  setEditionStock: (nftId: string, editionId: string, stock: number) => void;
  setFeeMultiplier: (multiplier: string) => void;
  // Gives every pending payment its answer right now (demos and tests)
  settleOrders: () => void;
  // Real-time connection helpers: close every socket, refuse new ones, count the open ones
  dropSockets: () => void;
  setSocketsDown: (down: boolean) => void;
  socketCount: () => number;
  // Opens a real socket.io-client connection and logs every event it receives (debug aid)
  probeSocket: (token?: string) => Promise<{ events: { event: string; data: unknown }[]; close: () => void }>;
};

declare global {
  interface Window {
    __kurioMocks?: MockControls;
  }
}

// socket.io-client is loaded here, on demand, because it must be imported after MSW started
async function probeSocket(token?: string) {
  const { io } = await import('socket.io-client');
  const socket = io({ path: SOCKET_PATH, transports: ['websocket'], auth: token ? { token } : {} });
  const events: { event: string; data: unknown }[] = [];
  socket.onAny((event, data) => {
    events.push({ event, data });
    console.log('[socket]', event, data);
  });
  socket.on('connect', () => console.log('[socket] connected'));
  socket.on('disconnect', (reason) => console.log('[socket] disconnected:', reason));
  return { events, close: () => void socket.close() };
}

export function setScenario(name: ScenarioName): void {
  getDb().scenario = name;
  reseedLatency();
  saveDb();
}

export function reset(name: ScenarioName = 'default'): void {
  resetDb(name);
  reseedLatency();
}

// Makes every current session look expired (to test expiry mid-navigation)
export function expireSessions(): void {
  const past = new Date(Date.now() - 1000).toISOString();
  for (const session of getDb().sessions) session.expiresAt = past;
  saveDb();
}

// Called once at startup. Opening the app with ?mockScenario=slow selects that scenario.
export function installMockControls(): void {
  const fromUrl = new URLSearchParams(window.location.search).get('mockScenario');
  if (isScenarioName(fromUrl)) setScenario(fromUrl);

  window.__kurioMocks = {
    scenarios: Object.fromEntries(Object.entries(SCENARIOS).map(([k, v]) => [k, v.description])),
    getScenario: () => getDb().scenario,
    setScenario,
    reset,
    expireSessions,
    setPrice: (nftId, price) => void setPrice(nftId, price),
    setEditionStock: (nftId, editionId, stock) => void setEditionStock(nftId, editionId, stock),
    setFeeMultiplier,
    settleOrders: settleAllPending,
    dropSockets,
    setSocketsDown,
    socketCount,
    probeSocket,
  };
  resumePendingOrders();
}
