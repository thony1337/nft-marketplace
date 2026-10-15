import { useQuery } from '@tanstack/react-query';
import { fetchOrder } from '../api/orders';
import { toApiError } from '../api/errors';
import { useAuth } from '../context/AuthContext';
import { useRealtimeStatus } from '../realtime/RealtimeProvider';

export const useOrderKey = (id: string) => ['order', useAuth().token ?? 'guest', id] as const;

// While a payment is pending the page keeps asking: every 2 s when the live channel is down, and
// every 5 s as a safety net when it is up (the channel normally tells the page first).
export function useOrder(id: string) {
  const { status } = useAuth();
  const key = useOrderKey(id);
  const realtime = useRealtimeStatus();
  return useQuery({
    queryKey: key,
    queryFn: () => fetchOrder(id),
    enabled: status === 'authenticated',
    refetchOnMount: 'always', // whatever the creation reply seeded is only a first picture
    retry: (count, error) => {
      const { status: code } = toApiError(error);
      return code !== 403 && code !== 404 && count < 2;
    },
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? (realtime === 'connected' ? 5000 : 2000) : false),
  });
}
