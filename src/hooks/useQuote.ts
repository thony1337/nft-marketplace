import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { applyCouponRequest, fetchQuote, removeCouponRequest } from '../api/cart';
import { useAuth } from '../context/AuthContext';
import { peekGuestId } from '../lib/session';
import type { Quote } from '../types';

// Same rule as the cart: the token is in the key, so two people never share an entry
export function useQuoteKey() {
  const { token } = useAuth();
  return ['quote', token ?? 'guest'] as const;
}

// The quote is the only source for what the user will pay. It is never recalculated on the screen.
export function useQuote() {
  const { token } = useAuth();
  const key = useQuoteKey();
  return useQuery({
    queryKey: key,
    queryFn: fetchQuote,
    staleTime: 0,
    enabled: Boolean(token) || peekGuestId() !== null,
  });
}

function useQuoteWrite() {
  const queryClient = useQueryClient();
  const key = useQuoteKey();
  return (quote: Quote) => queryClient.setQueryData(key, quote);
}

export function useApplyCoupon() {
  const write = useQuoteWrite();
  return useMutation({
    mutationFn: (code: string) => applyCouponRequest(code),
    scope: { id: 'coupon-write' },
    onSuccess: write,
  });
}

export function useRemoveCoupon() {
  const write = useQuoteWrite();
  return useMutation({
    mutationFn: () => removeCouponRequest(),
    scope: { id: 'coupon-write' },
    onSuccess: write,
  });
}
