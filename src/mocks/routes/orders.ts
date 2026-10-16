import { delay, http, HttpResponse } from 'msw';
import { createOrderSchema, fieldErrorsFrom, IDEMPOTENCY_KEY_RE } from '../../lib/schemas';
import type { OrderLine } from '../../types';
import { getDb, saveDb, type DbOrder } from '../db';
import { apiError, authenticate } from '../http';
import { liveDetailById, setEditionStock, setPrice } from '../market';
import { emitOrderChange, publicOrder, scheduleSettle, settleDueOrders } from '../orderEngine';
import { buildQuote, hash } from '../quoteLogic';
import { activeScenario } from '../scenarios';
import Decimal from 'decimal.js';

// The "market moved while you were paying" scenarios. Each happens once, then stays quiet.
function applyDuringPurchase(firstLine: { nftId: string; editionId: string; unitPriceEth: string } | undefined) {
  const kind = activeScenario().duringPurchase;
  const db = getDb();
  if (!kind || !firstLine || db.oneShots[kind]) return;
  db.oneShots[kind] = true;
  if (kind === 'price-change') {
    setPrice(firstLine.nftId, new Decimal(firstLine.unitPriceEth).plus('0.1').toFixed());
  } else {
    setEditionStock(firstLine.nftId, firstLine.editionId, 0);
  }
}

export const orderRoutes = [
  http.post('/api/orders', async ({ request }) => {
    const auth = authenticate(request);
    if (!auth.ok) return auth.response;

    const key = request.headers.get('Idempotency-Key') ?? '';
    if (!IDEMPOTENCY_KEY_RE.test(key)) {
      return apiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Envie o cabeçalho Idempotency-Key (8 a 80 caracteres).');
    }

    const parsed = createOrderSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiError(422, 'VALIDATION_ERROR', 'Verifique os campos informados.', fieldErrorsFrom(parsed.error));
    }
    const { walletId, quoteFingerprint, collector } = parsed.data;
    const requestHash = hash(`${walletId}|${quoteFingerprint}|${JSON.stringify(collector)}`);

    // From here to the insert below there is no `await`, so two clicks cannot both get through
    const db = getDb();
    settleDueOrders();
    const existing = db.orders.find((o) => o.userId === auth.user.id && o.idempotencyKey === key);
    if (existing) {
      if (existing.requestHash !== requestHash) {
        return apiError(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo.');
      }
      return HttpResponse.json(publicOrder(existing), { status: 200, headers: { 'Idempotent-Replay': 'true' } });
    }

    const wallet = (db.wallets[auth.user.id] ?? []).find((w) => w.id === walletId);
    if (!wallet) {
      return apiError(422, 'VALIDATION_ERROR', 'Carteira não encontrada.', { walletId: 'Escolha uma carteira válida' });
    }

    if (!wallet.connected) {
      return apiError(409, 'WALLET_NOT_CONNECTED', 'Conecte a carteira escolhida para pagar.');
    }

    const cartKey = `user:${auth.user.id}`;
    const rows = db.carts[cartKey] ?? [];
    if (rows.length === 0) return apiError(409, 'EMPTY_CART', 'Seu carrinho está vazio.');

    const first = buildQuote(rows, db.coupons[cartKey]).items[0];
    applyDuringPurchase(first && { nftId: first.nft.id, editionId: first.edition.id, unitPriceEth: first.unitPriceEth });

    // Revalidate everything against the market as it is right now
    const quote = buildQuote(rows, db.coupons[cartKey]);
    const unavailable = quote.items.find((l) => !l.available);
    if (unavailable) {
      return apiError(
        409,
        'OUT_OF_STOCK',
        `${unavailable.nft.title} (${unavailable.edition.label}) não tem mais estoque suficiente.`,
      );
    }
    if (quote.fingerprint !== quoteFingerprint) {
      return apiError(409, 'QUOTE_CHANGED', 'Preço, taxas ou cupom mudaram. Revise a cotação e confirme novamente.');
    }

    const payment = activeScenario().payment ?? { outcome: 'confirmed' as const, delayMs: 1500 };
    const now = new Date().toISOString();
    const items: OrderLine[] = quote.items.map((l) => ({
      nftId: l.nft.id,
      title: l.nft.title,
      image: liveDetailById(l.nft.id)?.image ?? l.nft.image,
      editionId: l.edition.id,
      editionLabel: l.edition.label,
      quantity: l.quantity,
      unitPriceEth: l.unitPriceEth,
      lineTotalEth: l.lineTotalEth,
    }));
    const order: DbOrder = {
      id: `ord_${String(db.orders.length + 1).padStart(6, '0')}`,
      status: 'pending',
      version: 1,
      createdAt: now,
      updatedAt: now,
      wallet: { id: wallet.id, name: wallet.name, address: wallet.address, network: wallet.network },
      collector,
      receipt: {
        items,
        subtotalEth: quote.subtotalEth,
        discountEth: quote.discountEth,
        networkFeeEth: quote.networkFeeEth,
        totalEth: quote.totalEth,
        coupon: quote.coupon,
      },
      txHash: null,
      explorerUrl: null,
      failure: null,
      userId: auth.user.id,
      idempotencyKey: key,
      requestHash,
      settlesAt: Date.now() + payment.delayMs,
      outcome: payment.outcome,
    };
    db.orders.push(order);
    saveDb();
    scheduleSettle(order);
    emitOrderChange(order);

    // The order exists, but the answer is lost on the way back
    if (activeScenario().timeoutAfterOrderCreated) await delay('infinite');

    return HttpResponse.json(publicOrder(order), { status: 201 });
  }),

  http.get('/api/orders', ({ request }) => {
    const auth = authenticate(request);
    if (!auth.ok) return auth.response;
    settleDueOrders();
    const mine = getDb().orders.filter((o) => o.userId === auth.user.id);
    return HttpResponse.json({ items: mine.map(publicOrder).reverse() });
  }),

  http.get('/api/orders/:id', ({ request, params }) => {
    const auth = authenticate(request);
    if (!auth.ok) return auth.response;
    settleDueOrders();
    const order = getDb().orders.find((o) => o.id === params.id);
    if (!order) return apiError(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.');
    if (order.userId !== auth.user.id) return apiError(403, 'FORBIDDEN', 'Você não tem acesso a este pedido.');
    return HttpResponse.json(publicOrder(order));
  }),
];
