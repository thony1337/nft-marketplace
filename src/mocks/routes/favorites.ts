import { http, HttpResponse } from 'msw';
import { liveSummaries } from '../market';
import { getDb, saveDb } from '../db';
import { apiError, authenticate } from '../http';
import type { FavoritesResponse } from '../../types';

const exists = (id: string) => liveSummaries().some((n) => n.id === id);

export const favoriteRoutes = [
  http.get('/api/favorites', ({ request }) => {
    const auth = authenticate(request);
    if (!auth.ok) return auth.response;
    const ids = getDb().favorites[auth.user.id] ?? [];
    const all = liveSummaries();
    const items = ids.flatMap((id) => all.find((n) => n.id === id) ?? []);
    return HttpResponse.json<FavoritesResponse>({ items });
  }),

  // Idempotent: favoriting twice leaves a single entry
  http.put('/api/favorites/:nftId', ({ request, params }) => {
    const auth = authenticate(request);
    if (!auth.ok) return auth.response;
    const nftId = String(params.nftId);
    if (!exists(nftId)) return apiError(404, 'NFT_NOT_FOUND', 'NFT não encontrado');

    const db = getDb();
    const list = db.favorites[auth.user.id] ?? [];
    if (!list.includes(nftId)) db.favorites[auth.user.id] = [nftId, ...list];
    saveDb();
    return HttpResponse.json({ nftId, favorited: true });
  }),

  // Idempotent too: removing something that is not there still succeeds
  http.delete('/api/favorites/:nftId', ({ request, params }) => {
    const auth = authenticate(request);
    if (!auth.ok) return auth.response;
    const nftId = String(params.nftId);

    const db = getDb();
    db.favorites[auth.user.id] = (db.favorites[auth.user.id] ?? []).filter((id) => id !== nftId);
    saveDb();
    return HttpResponse.json({ nftId, favorited: false });
  }),
];
