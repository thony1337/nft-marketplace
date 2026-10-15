import type { User, Wallet } from '../types';
import { api } from './client';

export const updateProfileRequest = async (input: { name: string }): Promise<User> =>
  (await api.patch<User>('/profile', input)).data;

export const uploadAvatarRequest = async (file: File): Promise<User> => {
  const form = new FormData();
  form.append('avatar', file);
  // No Content-Type here: the browser adds the multipart one together with its boundary
  return (await api.put<User>('/profile/avatar', form, { headers: { 'Content-Type': undefined } })).data;
};

export const removeAvatarRequest = async (): Promise<User> => (await api.delete<User>('/profile/avatar')).data;

export const changePasswordRequest = async (input: { currentPassword: string; newPassword: string }): Promise<void> => {
  await api.post('/profile/password', input);
};

export type NewWallet = { name: string; address: string; network: 'ethereum' | 'polygon' };

export const createWalletRequest = async (input: NewWallet): Promise<Wallet> => (await api.post<Wallet>('/wallets', input)).data;

export const updateWalletRequest = async (id: string, patch: { name?: string; isPrimary?: true }): Promise<Wallet> =>
  (await api.patch<Wallet>(`/wallets/${id}`, patch)).data;

export const deleteWalletRequest = async (id: string): Promise<void> => {
  await api.delete(`/wallets/${id}`);
};
