import Decimal from 'decimal.js';
import { http, HttpResponse } from 'msw';
import { couponSchema, fieldErrorsFrom } from '../../lib/schemas';
import { toCartResponse } from '../cartLogic';
import { getDb, saveDb } from '../db';
import { apiError, resolveCartOwner } from '../http';
import { buildQuote, checkCoupon, normalizeCode } from '../quoteLogic';

const quoteFor = (key: string) => {
  const db = getDb();
  return buildQuote(db.carts[key] ?? [], db.coupons[key]);
};

export const quoteRoutes = [
  // The quote is the reference for what the user will pay. Guests can see it too.
  http.get('/api/quote', ({ request }) => {
    const owner = resolveCartOwner(request);
    if (!owner.ok) return owner.response;
    return HttpResponse.json(quoteFor(owner.key));
  }),

  http.put('/api/cart/coupon', async ({ request }) => {
    const owner = resolveCartOwner(request);
    if (!owner.ok) return owner.response;

    const parsed = couponSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiError(422, 'VALIDATION_ERROR', 'Verifique os campos informados.', fieldErrorsFrom(parsed.error));
    }

    const db = getDb();
    const subtotal = new Decimal(toCartResponse(db.carts[owner.key] ?? []).subtotalEth);
    const check = checkCoupon(parsed.data.code, subtotal);
    if (!check.ok) {
      return apiError(422, check.error.code, check.error.message, { code: check.error.message });
    }

    db.coupons[owner.key] = normalizeCode(parsed.data.code);
    saveDb();
    return HttpResponse.json(quoteFor(owner.key));
  }),

  http.delete('/api/cart/coupon', ({ request }) => {
    const owner = resolveCartOwner(request);
    if (!owner.ok) return owner.response;
    delete getDb().coupons[owner.key];
    saveDb();
    return HttpResponse.json(quoteFor(owner.key));
  }),
];
