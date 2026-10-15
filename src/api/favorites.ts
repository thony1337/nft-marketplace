import type { FavoritesResponse } from '../types';
import { api } from './client';

export const fetchFavorites = async (): Promise<FavoritesResponse> =>
  (await api.get<FavoritesResponse>('/favorites')).data;

export const addFavoriteRequest = async (nftId: string): Promise<void> => {
  await api.put(`/favorites/${nftId}`);
};

export const removeFavoriteRequest = async (nftId: string): Promise<void> => {
  await api.delete(`/favorites/${nftId}`);
};
