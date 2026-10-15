import { useQuery } from '@tanstack/react-query';
import { fetchWallets } from '../api/wallets';
import { useAuth } from '../context/AuthContext';

export function useWallets() {
  const { token, status } = useAuth();
  return useQuery({ queryKey: ['wallets', token ?? 'guest'], queryFn: fetchWallets, enabled: status === 'authenticated' });
}
