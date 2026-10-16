import { http, HttpResponse } from 'msw';
import { fieldErrorsFrom, walletPatchSchema, walletSchema } from '../../lib/schemas';
import { getDb, saveDb } from '../db';
import { activeScenario } from '../scenarios';
import { apiError, authenticate } from '../http';
import { MAX_WALLETS } from '../seed';

const NETWORK_LABEL = { ethereum: 'Ethereum Mainnet', polygon: 'Polygon' } as const;

const validation = (error: Parameters<typeof fieldErrorsFrom>[0]) =>
  apiError(422, 'VALIDATION_ERROR', 'Verifique os campos informados.', fieldErrorsFrom(error));

const listOf = (userId: string) => (getDb().wallets[userId] ??= []);

export const walletRoutes = [
  http.get('/api/wallets', ({ request }) => {
    const auth = authenticate(request);
    if (!auth.ok) return auth.response;
    return HttpResponse.json(listOf(auth.user.id).map((w) => ({ ...w, connected: Boolean(w.connected) })));
  }),

  http.post('/api/wallets', async ({ request }) => {
    const auth = authenticate(request);
    if (!auth.ok) return auth.response;

    const parsed = walletSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validation(parsed.error);

    const wallets = listOf(auth.user.id);
    if (wallets.length >= MAX_WALLETS) {
      return apiError(409, 'WALLET_LIMIT', `Você pode ter até ${MAX_WALLETS} carteiras.`);
    }
    const { name, address, network } = parsed.data;
    if (wallets.some((w) => w.address.toLowerCase() === address.toLowerCase())) {
      return apiError(409, 'WALLET_EXISTS', 'Esta carteira já está cadastrada.', {
        address: 'Esta carteira já está cadastrada',
      });
    }

    const wallet = {
      id: `wallet-${crypto.randomUUID().slice(0, 8)}`,
      name,
      address,
      network: NETWORK_LABEL[network],
      isPrimary: wallets.length === 0, // the first wallet is the primary one
      connected: false,
    };
    wallets.push(wallet);
    saveDb();
    return HttpResponse.json(wallet, { status: 201 });
  }),

  // Rename, or make primary (which demotes the previous primary)
  http.patch('/api/wallets/:id', async ({ request, params }) => {
    const auth = authenticate(request);
    if (!auth.ok) return auth.response;

    const parsed = walletPatchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validation(parsed.error);

    const wallets = listOf(auth.user.id);
    const wallet = wallets.find((w) => w.id === params.id);
    if (!wallet) return apiError(404, 'WALLET_NOT_FOUND', 'Carteira não encontrada.');

    if (parsed.data.name) wallet.name = parsed.data.name;
    if (parsed.data.isPrimary) for (const w of wallets) w.isPrimary = w.id === wallet.id;
    saveDb();
    return HttpResponse.json(wallet);
  }),

  // Simulated connection. One wallet is connected at a time, like a browser session with a wallet.
  // The reply is the whole list, so the screen shows exactly what the server now holds.
  http.post('/api/wallets/:id/connect', ({ params, request }) => {
    const auth = authenticate(request);
    if (!auth.ok) return auth.response;
    const wallets = listOf(auth.user.id);
    const wallet = wallets.find((w) => w.id === params.id);
    if (!wallet) return apiError(404, 'WALLET_NOT_FOUND', 'Carteira não encontrada.');
    if (activeScenario().walletConnection === 'refused') {
      return apiError(403, 'WALLET_REFUSED', 'A carteira recusou a conexão. Aprove a solicitação na carteira e tente de novo.');
    }
    for (const w of wallets) w.connected = w.id === wallet.id;
    saveDb();
    return HttpResponse.json(wallets);
  }),

  http.post('/api/wallets/:id/disconnect', ({ params, request }) => {
    const auth = authenticate(request);
    if (!auth.ok) return auth.response;
    const wallets = listOf(auth.user.id);
    const wallet = wallets.find((w) => w.id === params.id);
    if (!wallet) return apiError(404, 'WALLET_NOT_FOUND', 'Carteira não encontrada.');
    wallet.connected = false;
    saveDb();
    return HttpResponse.json(wallets);
  }),

  http.delete('/api/wallets/:id', ({ request, params }) => {
    const auth = authenticate(request);
    if (!auth.ok) return auth.response;

    const db = getDb();
    const wallets = listOf(auth.user.id);
    const removed = wallets.find((w) => w.id === params.id);
    if (!removed) return apiError(404, 'WALLET_NOT_FOUND', 'Carteira não encontrada.');

    const rest = wallets.filter((w) => w.id !== removed.id);
    // Never leave a user with wallets but no primary one
    if (removed.isPrimary && rest.length > 0) rest[0].isPrimary = true;
    db.wallets[auth.user.id] = rest;
    saveDb();
    return new HttpResponse(null, { status: 204 });
  }),
];
