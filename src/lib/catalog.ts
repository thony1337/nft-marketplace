import type { CatalogSort, CatalogTab, CollectionId, Network } from '@/types';

export const COLLECTION_IDS = [
  'arte-digital', 'fotografia', 'musica', 'arte-3d', 'colecionaveis',
  'generativa', 'jogos', 'assinaturas', 'utilidade',
] as const;

export const COLLECTION_LABELS: Record<CollectionId, string> = {
  'arte-digital': 'Arte digital',
  fotografia: 'Fotografia',
  musica: 'Música',
  'arte-3d': 'Arte 3D',
  colecionaveis: 'Colecionáveis',
  generativa: 'Generativa',
  jogos: 'Jogos',
  assinaturas: 'Assinaturas',
  utilidade: 'Utilidade',
};

export const TAB_LABELS: Record<CatalogTab, string> = {
  all: 'Todos os NFTs',
  new: 'Novos lançamentos',
  trending: 'Em alta',
};

export const SORT_LABELS: Record<CatalogSort, string> = {
  recent: 'Listados recentemente',
  'price-asc': 'Menor preço',
  'price-desc': 'Maior preço',
  name: 'Nome',
};

export const PAGE_SIZE = 9;
export const NETWORK_IDS = ['ethereum', 'polygon', 'solana'] as const;

export const NETWORK_LABELS: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
};

// Up to 4 digits before and after the dot, e.g. "0.02" or "12.30"
export const DECIMAL_RE = /^\d{1,4}(\.\d{1,4})?$/;
// Most units of one edition a single cart line can hold
export const MAX_PER_LINE = 10;