import type { CartResponse, Quote } from '../types';
import { api } from './client';

export type AddToCartInput = { nftId: string; editionId: string; quantity: number };

export const fetchCart = async (): Promise<CartResponse> => (await api.get<CartResponse>('/cart')).data;

export const addToCartRequest = async (input: AddToCartInput): Promise<CartResponse> =>
  (await api.post<CartResponse>('/cart/items', input)).data;

export const updateCartItemRequest = async (itemId: string, quantity: number): Promise<CartResponse> =>
  (await api.patch<CartResponse>(`/cart/items/${itemId}`, { quantity })).data;

export const removeCartItemRequest = async (itemId: string): Promise<CartResponse> =>
  (await api.delete<CartResponse>(`/cart/items/${itemId}`)).data;

export const fetchQuote = async (): Promise<Quote> => (await api.get<Quote>('/quote')).data;

export const applyCouponRequest = async (code: string): Promise<Quote> =>
  (await api.put<Quote>('/cart/coupon', { code })).data;

export const removeCouponRequest = async (): Promise<Quote> => (await api.delete<Quote>('/cart/coupon')).data;
