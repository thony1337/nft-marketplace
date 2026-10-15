import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  changePasswordRequest, createWalletRequest, deleteWalletRequest, removeAvatarRequest,
  updateProfileRequest, updateWalletRequest, uploadAvatarRequest, type NewWallet,
} from '../api/profile';
import { useAuth } from '../context/AuthContext';
import type { User } from '../types';

// The signed-in user lives in the ['me', token] query: writing there updates the header too
function useMeWrite() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  return (user: User) => queryClient.setQueryData(['me', token], user);
}

export function useUpdateProfile() {
  const write = useMeWrite();
  return useMutation({ mutationFn: updateProfileRequest, onSuccess: write });
}
export function useUploadAvatar() {
  const write = useMeWrite();
  return useMutation({ mutationFn: uploadAvatarRequest, onSuccess: write });
}
export function useRemoveAvatar() {
  const write = useMeWrite();
  return useMutation({ mutationFn: removeAvatarRequest, onSuccess: write });
}
export function useChangePassword() {
  return useMutation({ mutationFn: changePasswordRequest });
}

// Any wallet change can move which one is primary, so the list is read again from the server
function useWalletsRefresh() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  return () => queryClient.invalidateQueries({ queryKey: ['wallets', token ?? 'guest'] });
}

export function useCreateWallet() {
  const refresh = useWalletsRefresh();
  return useMutation({ mutationFn: (input: NewWallet) => createWalletRequest(input), onSuccess: refresh });
}
export function useUpdateWallet() {
  const refresh = useWalletsRefresh();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { name?: string; isPrimary?: true } }) => updateWalletRequest(id, patch),
    onSuccess: refresh,
  });
}
export function useDeleteWallet() {
  const refresh = useWalletsRefresh();
  return useMutation({ mutationFn: (id: string) => deleteWalletRequest(id), onSuccess: refresh });
}
