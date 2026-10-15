import type { QueryClient } from '@tanstack/react-query';
import type { NftUpdatedEvent, OrderUpdatedEvent } from '../lib/socketEvents';

// What the screen does with a real-time event. Everything here is about *versions*: an event is
// applied only if it is newer than what is already in the cache, so duplicates and late copies
// of an older state change nothing.

type Versioned = { id: string; version: number; priceInEth: string; stock: number; isAvailable: boolean };

const isNft = (value: unknown): value is Versioned =>
  typeof value === 'object' && value !== null && 'id' in value && 'version' in value && 'priceInEth' in value && 'isAvailable' in value;

const patch = <T extends Versioned>(item: T, event: NftUpdatedEvent): T => ({
  ...item,
  version: event.version,
  priceInEth: event.priceInEth,
  stock: event.stock,
  isAvailable: event.isAvailable,
  ...('editions' in item ? { editions: event.editions } : {}),
});

// Updates every cached copy of this NFT (detail page, catalog pages, favorites), wherever it
// lives. Returns true when something was actually newer.
export function applyNftUpdate(queryClient: QueryClient, event: NftUpdatedEvent): boolean {
  let applied = false;
  const touched: (readonly unknown[])[] = [];

  for (const query of queryClient.getQueryCache().findAll()) {
    const data = query.state.data as unknown;
    if (typeof data !== 'object' || data === null) continue;

    // a single NFT (the detail query)
    if (isNft(data) && data.id === event.id) {
      if (data.version < event.version) {
        queryClient.setQueryData(query.queryKey, patch(data, event));
        applied = true;
        touched.push(query.queryKey);
      }
      continue;
    }

    // a list of NFTs (catalog page, favorites)
    const items = (data as { items?: unknown }).items;
    if (Array.isArray(items) && items.some((i) => isNft(i) && i.id === event.id && i.version < event.version)) {
      queryClient.setQueryData(query.queryKey, {
        ...data,
        items: items.map((i) => (isNft(i) && i.id === event.id && i.version < event.version ? patch(i, event) : i)),
      });
      applied = true;
      touched.push(query.queryKey);
    }
  }
  if (applied) {
    // The patch is shown at once. A short while later the same data is read again from the server:
    // it fixes ordering and filters of a list, and replaces anything a slow response put back.
    scheduleRefresh(queryClient, touched);
  }

  // A price or stock change in something the user is about to buy changes what they pay. Cart lines
  // carry no version, so any event for an item in the cart means "read the quote again" (once per burst).
  const inCart = queryClient
    .getQueryCache()
    .findAll({ predicate: (q) => q.queryKey[0] === 'quote' || q.queryKey[0] === 'cart' })
    .some((q) => {
      const lines = (q.state.data as { items?: { nft?: { id?: string } }[] } | undefined)?.items ?? [];
      return lines.some((l) => l.nft?.id === event.id);
    });
  if (inCart) scheduleCartRefresh(queryClient);

  return applied || inCart;
}

const cartTimers = new WeakMap<QueryClient, ReturnType<typeof setTimeout>>();
function scheduleCartRefresh(queryClient: QueryClient) {
  clearTimeout(cartTimers.get(queryClient));
  cartTimers.set(
    queryClient,
    setTimeout(() => {
      cartTimers.delete(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['quote'] });
      void queryClient.invalidateQueries({ queryKey: ['cart'] });
    }, 150),
  );
}

const pending = new WeakMap<QueryClient, { timer: ReturnType<typeof setTimeout>; keys: Map<string, readonly unknown[]> }>();

function scheduleRefresh(queryClient: QueryClient, keys: (readonly unknown[])[]) {
  let entry = pending.get(queryClient);
  if (!entry) {
    entry = { timer: setTimeout(() => undefined, 0), keys: new Map() };
    pending.set(queryClient, entry);
  }
  for (const key of keys) entry.keys.set(JSON.stringify(key), key);
  clearTimeout(entry.timer);
  const current = entry;
  current.timer = setTimeout(() => {
    pending.delete(queryClient);
    for (const key of current.keys.values()) void queryClient.invalidateQueries({ queryKey: key as unknown[], exact: true });
  }, 400);
}

type CachedOrder = { id: string; version: number; status: string };

// An order changed state. The full record (hash, failure reason) comes from the server, so the
// event says *when* to read it again, and only if it is newer than what the screen has.
export function applyOrderUpdate(queryClient: QueryClient, token: string | null, event: OrderUpdatedEvent): boolean {
  const key = ['order', token ?? 'guest', event.id] as const;
  const cached = queryClient.getQueryData<CachedOrder>(key);
  if (cached && cached.version >= event.version) return false; // duplicate or late copy

  void queryClient.invalidateQueries({ queryKey: key });
  void queryClient.invalidateQueries({ queryKey: ['orders'] });
  if (event.status !== 'pending') {
    // confirmed: the cart was used up and stock moved. declined: the cart is untouched, nothing to refresh.
    if (event.status === 'confirmed') {
      for (const root of ['cart', 'quote', 'nft', 'nfts']) void queryClient.invalidateQueries({ queryKey: [root] });
    }
  }
  return true;
}

// After a gap in the connection events may have been lost: read everything on screen again
const REALTIME_ROOTS = ['nft', 'nfts', 'cart', 'quote', 'orders', 'order', 'favorites'];
export function reconcile(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ predicate: (q) => REALTIME_ROOTS.includes(String(q.queryKey[0])) });
}
