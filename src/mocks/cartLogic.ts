import Decimal from 'decimal.js';
import { MAX_PER_LINE } from '../lib/catalog';
import type { CartAdjustment, CartLine, CartResponse, Edition, NftDetail } from '../types';
import { liveDetailById } from './market';
import type { CartRow } from './db';

// The only place that reads stock. Later chunks (stock changes during purchase) swap it here.
export function findEdition(nftId: string, editionId: string): { nft: NftDetail; edition: Edition } | undefined {
  const nft = liveDetailById(nftId);
  const edition = nft?.editions.find((e) => e.id === editionId);
  return nft && edition ? { nft, edition } : undefined;
}

export const limitFor = (edition: Edition) => Math.min(edition.stock, MAX_PER_LINE);

export function toCartResponse(rows: CartRow[]): CartResponse {
  const items: CartLine[] = rows.flatMap((row) => {
    const found = findEdition(row.nftId, row.editionId);
    if (!found) return []; // the NFT disappeared from the catalog
    const { nft, edition } = found;
    return {
      id: row.id,
      nft: { id: nft.id, title: nft.title, image: nft.image, collection: nft.collection, network: nft.network },
      edition,
      unitPriceEth: nft.priceInEth,
      quantity: row.quantity,
      lineTotalEth: new Decimal(nft.priceInEth).times(row.quantity).toFixed(),
      maxQuantity: limitFor(edition),
      available: row.quantity <= edition.stock,
    };
  });
  return {
    items,
    itemCount: items.reduce((sum, l) => sum + l.quantity, 0),
    subtotalEth: items.reduce((sum, l) => sum.plus(l.lineTotalEth), new Decimal(0)).toFixed(),
  };
}

// Moves a guest cart into a user cart. Quantities of the same edition add up, capped by stock.
export function mergeRows(
  guest: CartRow[],
  user: CartRow[],
): { rows: CartRow[]; adjustments: CartAdjustment[] } {
  const rows = user.map((r) => ({ ...r }));
  const adjustments: CartAdjustment[] = [];

  for (const g of guest) {
    const found = findEdition(g.nftId, g.editionId);
    if (!found) continue;
    const existing = rows.find((r) => r.nftId === g.nftId && r.editionId === g.editionId);
    const requested = (existing?.quantity ?? 0) + g.quantity;
    const kept = Math.min(requested, limitFor(found.edition));

    if (kept < requested) {
      adjustments.push({
        nftId: g.nftId,
        title: found.nft.title,
        editionLabel: found.edition.label,
        requested,
        kept,
      });
    }
    if (existing) existing.quantity = kept;
    else if (kept > 0) rows.push({ ...g, quantity: kept });
  }
  return { rows: rows.filter((r) => r.quantity > 0), adjustments };
}
