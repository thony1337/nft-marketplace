import type { Wallet } from '../types';
import { api } from './client';

export const fetchWallets = async (): Promise<Wallet[]> => (await api.get<Wallet[]>('/wallets')).data;

// Both answer with the whole list, so the screen shows what the server holds
export const connectWalletRequest = async (id: string): Promise<Wallet[]> =>
  (await api.post<Wallet[]>(`/wallets/${id}/connect`)).data;
export const disconnectWalletRequest = async (id: string): Promise<Wallet[]> =>
  (await api.post<Wallet[]>(`/wallets/${id}/disconnect`)).data;
