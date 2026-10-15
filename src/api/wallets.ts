import type { Wallet } from '../types';
import { api } from './client';

export const fetchWallets = async (): Promise<Wallet[]> => (await api.get<Wallet[]>('/wallets')).data;
