import type { AuthResponse, MergeCartResponse, User } from '../types';
import { api } from './client';

export const fetchMe = async (): Promise<User> => (await api.get<User>('/auth/me')).data;

export const loginRequest = async (input: { email: string; password: string }): Promise<AuthResponse> =>
  (await api.post<AuthResponse>('/auth/login', input)).data;

export const registerRequest = async (input: { name: string; email: string; password: string }): Promise<AuthResponse> =>
  (await api.post<AuthResponse>('/auth/register', input)).data;

// The token is passed in explicitly: by the time Axios runs its interceptors the app has
// already cleared the stored session, and the server must still learn which one to end.
export const logoutRequest = async (token: string): Promise<void> => {
  await api.post('/auth/logout', null, { headers: { Authorization: `Bearer ${token}` } });
};

// Folds the visitor's cart into the account's cart. Needs the token AND the old guest id.
export const mergeCartRequest = async (guestId: string): Promise<MergeCartResponse> =>
  (await api.post<MergeCartResponse>('/cart/merge', null, { headers: { 'X-Guest-Id': guestId } })).data;
