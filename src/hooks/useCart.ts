import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addToCartRequest,
  fetchCart,
  removeCartItemRequest,
  updateCartItemRequest,
  type AddToCartInput,
} from '../api/cart';
import { useAuth } from '../context/AuthContext';
import { peekGuestId } from '../lib/session';
import type { CartResponse } from '../types';

// The token is part of the key: a visitor's cart and a user's cart can never share an entry
export function useCartKey() {
  const { token } = useAuth();
  return ['cart', token ?? 'guest'] as const;
}

export function useCart() {
  const { token } = useAuth();
  const key = useCartKey();
  return useQuery({
    queryKey: key,
    queryFn: fetchCart,
    staleTime: 30_000,
    // A visitor who never put anything in a cart has none: asking would only create a guest id
    enabled: Boolean(token) || peekGuestId() !== null,
  });
}

export const useCartCount = () => useCart().data?.itemCount ?? 0;

// Every cart change also changes what the user will pay
function useCartMutations() {
  const queryClient = useQueryClient();
  const key = useCartKey();
  return {
    apply: (cart: CartResponse) => {
      // A read that started before this change may still be on its way back with the old cart: drop it
      void queryClient.cancelQueries({ queryKey: key, exact: true });
      queryClient.setQueryData(key, cart);
      void queryClient.invalidateQueries({ queryKey: ['quote'] });
    },
  };
}

export function useAddToCart() {
  const { apply } = useCartMutations();
  return useMutation({
    mutationFn: (input: AddToCartInput) => addToCartRequest(input),
    onSuccess: apply,
  });
}

export function useUpdateCartItem() {
  const { apply } = useCartMutations();
  return useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) => updateCartItemRequest(itemId, quantity),
    // Changes to the same line are sent one after the other, in the order they were made
    scope: { id: 'cart-write' },
    onSuccess: apply,
  });
}

export function useRemoveCartItem() {
  const { apply } = useCartMutations();
  return useMutation({
    mutationFn: (itemId: string) => removeCartItemRequest(itemId),
    scope: { id: 'cart-write' },
    onSuccess: apply,
  });
}
