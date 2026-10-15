export type User = { id: string; name: string; email: string; avatarUrl?: string };

export type Network = 'ethereum' | 'polygon' | 'solana';
export type CollectionId =
  | 'arte-digital' | 'fotografia' | 'musica' | 'arte-3d' | 'colecionaveis'
  | 'generativa' | 'jogos' | 'assinaturas' | 'utilidade';
export type CatalogTab = 'all' | 'new' | 'trending';
export type CatalogSort = 'recent' | 'price-asc' | 'price-desc' | 'name';
export type NftListParams = {
  q?: string; collection?: CollectionId; network?: Network; minPrice?: string; maxPrice?: string;
  tab?: CatalogTab; sort?: CatalogSort; page?: number; pageSize?: number;
};
export type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number; totalPages: number };
// How many NFTs each option of a filter would show, given every OTHER filter in use (so the numbers
// answer "what happens if I pick this one")
export type NftFacets = {
  collection: Partial<Record<CollectionId, number>>;
  network: Partial<Record<Network, number>>;
};
export type NftListResponse = Paginated<NFT> & { facets?: NftFacets };

export type NFT = {
  id: string; title: string; description: string; image: string; priceInEth: string; creator: string;
  collection: CollectionId; network: Network; createdAt: string; trendingScore: number; stock: number;
  version: number; owner: string; isAvailable: boolean; edition: number;
};
export type Edition = { id: string; label: string; stock: number };
export type NftDetail = NFT & {
  tokenId: string; collectionName: string; attributes: string[]; rating: number; reviewCount: number;
  gallery: string[]; details: string; editions: Edition[];
};
export type Wallet = { id: string; name: string; address: string; isPrimary: boolean; network: string };

export type ApiErrorBody = { code: string; message: string; fieldErrors?: Record<string, string> };
export type AuthResponse = { token: string; expiresAt: string; user: User };

export type CartLine = {
  id: string;
  nft: Pick<NFT, 'id' | 'title' | 'image' | 'collection' | 'network'>;
  edition: Edition;
  unitPriceEth: string;
  quantity: number;
  lineTotalEth: string;
  maxQuantity: number; // min(edition stock, MAX_PER_LINE)
  available: boolean; // false when the stock fell below the quantity in the cart
};
export type CartResponse = { items: CartLine[]; itemCount: number; subtotalEth: string };
export type CartAdjustment = {
  nftId: string; title: string; editionLabel: string; requested: number; kept: number;
};
export type MergeCartResponse = CartResponse & { adjustments: CartAdjustment[] };
export type FavoritesResponse = { items: NFT[] };

export type CouponInfo = { code: string; kind: 'percent' | 'fixed'; value: string; description: string };
export type CouponIssue = {
  code: 'COUPON_EXPIRED' | 'COUPON_MIN_NOT_MET';
  message: string;
};
export type Quote = {
  items: CartLine[];
  subtotalEth: string;
  discountEth: string;
  networkFeeEth: string;
  totalEth: string;
  coupon: CouponInfo | null;
  // The applied coupon stopped being valid (expired, minimum no longer met): no discount applied
  couponIssue: CouponIssue | null;
  canCheckout: boolean;
  // Changes whenever anything that affects what the user pays changes
  fingerprint: string;
};

export type OrderStatus = 'pending' | 'confirmed' | 'declined';
export type OrderLine = {
  nftId: string; title: string; image: string; editionId: string; editionLabel: string;
  quantity: number; unitPriceEth: string; lineTotalEth: string;
};
// Frozen when the order is created. Later catalog changes never touch it.
export type OrderReceipt = {
  items: OrderLine[];
  subtotalEth: string; discountEth: string; networkFeeEth: string; totalEth: string;
  coupon: CouponInfo | null;
};
// Who is buying and where the NFTs go. Sent with the order and kept in it, like the receipt.
export type CollectorData = {
  displayName: string;
  username: string;
  profileName: string;
  email: string;
  network: 'ethereum' | 'polygon';
  walletAddress: string;
  walletType: 'metamask' | 'coinbase' | 'walletconnect' | 'other';
  secondaryWallet?: string; // ENS name or second address
  ensName?: string;
  referralCode?: string;
  note?: string;
};
export type OrderRecord = {
  id: string;
  status: OrderStatus;
  version: number; // goes up on every state change (1 = pending, 2 = confirmed or declined)
  createdAt: string;
  updatedAt: string;
  wallet: { id: string; name: string; address: string; network: string };
  collector?: CollectorData;
  receipt: OrderReceipt;
  txHash: string | null; // simulated, only for confirmed orders
  explorerUrl: string | null; // simulated, not a real explorer
  failure: { code: string; message: string } | null;
};
