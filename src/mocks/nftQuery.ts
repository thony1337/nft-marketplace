import Decimal from 'decimal.js';
import type { CollectionId, NFT, NftListParams, NftListResponse, Network } from '../types';

const DAY = 86_400_000;

export function queryNfts(all: NFT[], params: NftListParams): NftListResponse {
  const { q, collection, network, minPrice, maxPrice, tab = 'all', sort = 'recent' } = params;
  const pageSize = Math.min(48, Math.max(1, params.pageSize ?? 9));
  const page = Math.max(1, params.page ?? 1);

  // Everything except the collection and the network, which the facets count on their own
  let base = [...all];
  if (q?.trim()) {
    const term = q.trim().toLowerCase();
    base = base.filter(
      (n) => n.title.toLowerCase().includes(term) || n.creator.toLowerCase().includes(term),
    );
  }
  if (minPrice) base = base.filter((n) => new Decimal(n.priceInEth).gte(minPrice));
  if (maxPrice) base = base.filter((n) => new Decimal(n.priceInEth).lte(maxPrice));
  base = applyTab(base, all, tab);

  let list = [...base];
  if (collection) list = list.filter((n) => n.collection === collection);
  if (network) list = list.filter((n) => n.network === network);

  list.sort((a, b) => {
    let diff: number;
    if (sort === 'price-asc') diff = new Decimal(a.priceInEth).comparedTo(b.priceInEth);
    else if (sort === 'price-desc') diff = new Decimal(b.priceInEth).comparedTo(a.priceInEth);
    else if (sort === 'name') diff = a.title.localeCompare(b.title);
    else if (tab === 'trending') diff = b.trendingScore - a.trendingScore;
    else diff = Date.parse(b.createdAt) - Date.parse(a.createdAt);
    return diff || a.id.localeCompare(b.id);
  });

  const total = list.length;
  const start = (page - 1) * pageSize;

  return {
    items: list.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    facets: {
      collection: countBy(base.filter((n) => !network || n.network === network), (n) => n.collection),
      network: countBy(base.filter((n) => !collection || n.collection === collection), (n) => n.network),
    },
  };
}

function applyTab(list: NFT[], all: NFT[], tab: string): NFT[] {
  if (tab === 'trending') return list.filter((n) => n.trendingScore >= 60);
  if (tab === 'new' && all.length > 0) {
    const newest = Math.max(...all.map((n) => Date.parse(n.createdAt)));
    return list.filter((n) => Date.parse(n.createdAt) >= newest - 20 * DAY);
  }
  return list;
}

function countBy<K extends CollectionId | Network>(list: NFT[], key: (n: NFT) => K): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {};
  for (const n of list) out[key(n)] = (out[key(n)] ?? 0) + 1;
  return out;
}
