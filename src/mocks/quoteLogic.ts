import Decimal from 'decimal.js';
import type { CouponInfo, CouponIssue, Quote } from '../types';
import { toCartResponse } from './cartLogic';
import { getDb, type CartRow } from './db';
import { activeScenario } from './scenarios';

type Coupon = CouponInfo & { expiresAt: string; minSubtotal?: string };

export const COUPONS: Record<string, Coupon> = {
  KURIO10: {
    code: 'KURIO10', kind: 'percent', value: '10', description: '10% de desconto',
    expiresAt: '2099-12-31T23:59:59Z',
  },
  BEMVINDO: {
    code: 'BEMVINDO', kind: 'fixed', value: '0.1', description: '0,1 ETH de desconto em compras a partir de 1 ETH',
    expiresAt: '2099-12-31T23:59:59Z', minSubtotal: '1',
  },
  EXPIRADO20: {
    code: 'EXPIRADO20', kind: 'percent', value: '20', description: '20% de desconto',
    expiresAt: '2025-01-01T00:00:00Z',
  },
};

export const normalizeCode = (code: string) => code.trim().toUpperCase();

export type CouponCheck =
  | { ok: true; coupon: CouponInfo; discount: Decimal }
  | { ok: false; error: CouponIssue | { code: 'COUPON_INVALID'; message: string } };

export function checkCoupon(rawCode: string, subtotal: Decimal): CouponCheck {
  const found = COUPONS[normalizeCode(rawCode)];
  if (!found) return { ok: false, error: { code: 'COUPON_INVALID', message: 'Cupom inválido.' } };

  const expired = activeScenario().couponsExpired || Date.parse(found.expiresAt) <= Date.now();
  if (expired) return { ok: false, error: { code: 'COUPON_EXPIRED', message: 'Este cupom expirou.' } };

  if (found.minSubtotal && subtotal.lt(found.minSubtotal)) {
    return {
      ok: false,
      error: { code: 'COUPON_MIN_NOT_MET', message: `Este cupom exige um subtotal mínimo de ${found.minSubtotal} ETH.` },
    };
  }

  const raw = found.kind === 'percent' ? subtotal.times(found.value).div(100) : new Decimal(found.value);
  const discount = Decimal.min(raw, subtotal).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  const { expiresAt: _e, minSubtotal: _m, ...info } = found;
  return { ok: true, coupon: info, discount };
}

// 0.5% of what is being paid, between 0.001 and 0.01 ETH, scaled by the market's multiplier
export function networkFee(taxable: Decimal): Decimal {
  if (taxable.lte(0)) return new Decimal(0);
  const base = Decimal.min(Decimal.max(taxable.times('0.005'), '0.001'), '0.01');
  return base.times(getDb().market.feeMultiplier).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

// cyrb53: small, deterministic, good enough to detect "something changed"
export function hash(text: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

export function buildQuote(rows: CartRow[], couponCode?: string): Quote {
  const cart = toCartResponse(rows);
  const subtotal = new Decimal(cart.subtotalEth);

  let coupon: CouponInfo | null = null;
  let couponIssue: CouponIssue | null = null;
  let discount = new Decimal(0);
  if (couponCode) {
    const check = checkCoupon(couponCode, subtotal);
    if (check.ok) {
      coupon = check.coupon;
      discount = check.discount;
    } else if (check.error.code !== 'COUPON_INVALID') {
      couponIssue = check.error;
    }
  }

  const fee = networkFee(subtotal.minus(discount));
  const total = subtotal.minus(discount).plus(fee);
  const canCheckout = cart.items.length > 0 && cart.items.every((l) => l.available);

  const fingerprint = hash(
    JSON.stringify([
      cart.items.map((l) => [l.nft.id, l.edition.id, l.quantity, l.unitPriceEth, l.available]),
      coupon?.code ?? null,
      discount.toFixed(),
      fee.toFixed(),
      total.toFixed(),
    ]),
  );

  return {
    items: cart.items,
    subtotalEth: subtotal.toFixed(),
    discountEth: discount.toFixed(),
    networkFeeEth: fee.toFixed(),
    totalEth: total.toFixed(),
    coupon,
    couponIssue,
    canCheckout,
    fingerprint,
  };
}
