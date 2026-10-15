import { http, HttpResponse } from 'msw';
import { z } from 'zod';
import { MAX_PER_LINE } from '../../lib/catalog';
import { fieldErrorsFrom } from '../../lib/schemas';
import type { MergeCartResponse } from '../../types';
import { findEdition, limitFor, mergeRows, toCartResponse } from '../cartLogic';
import { getDb, saveDb, type CartRow } from '../db';
import { apiError, authenticate, resolveCartOwner } from '../http';

const quantity = z.number().int('A quantidade deve ser inteira').min(1, 'A quantidade mínima é 1').max(
  MAX_PER_LINE,
  `O máximo por item é ${MAX_PER_LINE}`,
);
const addSchema = z.object({ nftId: z.string().min(1), editionId: z.string().min(1), quantity });
const patchSchema = z.object({ quantity });

const invalid = (error: z.ZodError) =>
  apiError(422, 'VALIDATION_ERROR', 'Verifique os campos informados.', fieldErrorsFrom(error));

const overLimit = (limit: number) =>
  apiError(409, 'QUANTITY_LIMIT', `Máximo disponível para esta edição: ${limit}.`, {
    quantity: `Máximo disponível: ${limit}`,
  });

const rowsOf = (key: string): CartRow[] => (getDb().carts[key] ??= []);

export const cartRoutes = [
  http.get('/api/cart', ({ request }) => {
    const owner = resolveCartOwner(request);
    if (!owner.ok) return owner.response;
    return HttpResponse.json(toCartResponse(rowsOf(owner.key)));
  }),

  http.post('/api/cart/items', async ({ request }) => {
    const owner = resolveCartOwner(request);
    if (!owner.ok) return owner.response;

    const parsed = addSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return invalid(parsed.error);
    const { nftId, editionId, quantity: qty } = parsed.data;

    const found = findEdition(nftId, editionId);
    if (!found) return apiError(404, 'NFT_NOT_FOUND', 'NFT ou edição não encontrados');
    if (found.edition.stock <= 0) {
      return apiError(409, 'OUT_OF_STOCK', 'Esta edição está esgotada.');
    }

    const rows = rowsOf(owner.key);
    const existing = rows.find((r) => r.nftId === nftId && r.editionId === editionId);
    const total = (existing?.quantity ?? 0) + qty;
    if (total > limitFor(found.edition)) return overLimit(limitFor(found.edition));

    if (existing) existing.quantity = total;
    else rows.push({ id: crypto.randomUUID(), nftId, editionId, quantity: qty });
    saveDb();
    return HttpResponse.json(toCartResponse(rows));
  }),

  http.patch('/api/cart/items/:itemId', async ({ request, params }) => {
    const owner = resolveCartOwner(request);
    if (!owner.ok) return owner.response;

    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return invalid(parsed.error);

    const rows = rowsOf(owner.key);
    const row = rows.find((r) => r.id === params.itemId);
    if (!row) return apiError(404, 'CART_ITEM_NOT_FOUND', 'Item não encontrado no carrinho.');

    const found = findEdition(row.nftId, row.editionId);
    if (!found || found.edition.stock <= 0) return apiError(409, 'OUT_OF_STOCK', 'Esta edição está esgotada.');
    if (parsed.data.quantity > limitFor(found.edition)) return overLimit(limitFor(found.edition));

    row.quantity = parsed.data.quantity;
    saveDb();
    return HttpResponse.json(toCartResponse(rows));
  }),

  // Idempotent: removing a line that is already gone returns the current cart
  http.delete('/api/cart/items/:itemId', ({ request, params }) => {
    const owner = resolveCartOwner(request);
    if (!owner.ok) return owner.response;
    const db = getDb();
    db.carts[owner.key] = rowsOf(owner.key).filter((r) => r.id !== params.itemId);
    saveDb();
    return HttpResponse.json(toCartResponse(db.carts[owner.key]));
  }),

  http.delete('/api/cart', ({ request }) => {
    const owner = resolveCartOwner(request);
    if (!owner.ok) return owner.response;
    getDb().carts[owner.key] = [];
    delete getDb().coupons[owner.key];
    saveDb();
    return HttpResponse.json(toCartResponse([]));
  }),

  // Called right after login: folds the guest cart (X-Guest-Id) into the user's cart.
  // Safe to retry: once merged, the guest cart is empty and nothing changes.
  http.post('/api/cart/merge', ({ request }) => {
    const auth = authenticate(request);
    if (!auth.ok) return auth.response;

    const guestId = request.headers.get('X-Guest-Id') ?? '';
    if (!/^[A-Za-z0-9-]{8,64}$/.test(guestId)) {
      return apiError(400, 'GUEST_ID_REQUIRED', 'Identificador de visitante ausente ou inválido.');
    }

    const db = getDb();
    const userKey = `user:${auth.user.id}`;
    const { rows, adjustments } = mergeRows(db.carts[`guest:${guestId}`] ?? [], rowsOf(userKey));
    db.carts[userKey] = rows;
    delete db.carts[`guest:${guestId}`];
    // A coupon applied as a guest follows the user, unless they already have one
    const guestCoupon = db.coupons[`guest:${guestId}`];
    if (guestCoupon && !db.coupons[userKey]) db.coupons[userKey] = guestCoupon;
    delete db.coupons[`guest:${guestId}`];
    saveDb();

    return HttpResponse.json<MergeCartResponse>({ ...toCartResponse(rows), adjustments });
  }),
];
