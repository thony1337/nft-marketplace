import type { NftDetail, NftListResponse } from '../types';
import { api } from './client';

// Whatever the catalog page keeps in the URL (q, collection, network, minPrice, maxPrice, tab, sort,
// page, pageSize). Empty values are left out so the URL stays clean.
export async function fetchNfts(params: object = {}): Promise<NftListResponse> {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
  const { data } = await api.get<NftListResponse>('/nfts', { params: clean });
  return data;
}

export async function fetchNft(id: string): Promise<NftDetail> {
  const { data } = await api.get<NftDetail>(`/nfts/${id}`);
  return data;
}
