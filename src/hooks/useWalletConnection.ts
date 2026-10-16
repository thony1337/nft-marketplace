import { useMutation, useQueryClient } from '@tanstack/react-query';
import { connectWalletRequest, disconnectWalletRequest } from '../api/wallets';
import { useAuth } from '../context/AuthContext';
import type { Wallet } from '../types';

// Simulated wallet connection: connect (which the wallet may refuse), and disconnect
export function useWalletConnection() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const key = ['wallets', token ?? 'guest'];
  const onSuccess = (list: Wallet[]) => queryClient.setQueryData(key, list);

  const connect = useMutation({ mutationFn: connectWalletRequest, onSuccess });
  const disconnect = useMutation({ mutationFn: disconnectWalletRequest, onSuccess });
  return { connect, disconnect, pending: connect.isPending || disconnect.isPending };
}
