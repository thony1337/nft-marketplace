import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { addFavoriteRequest, fetchFavorites, removeFavoriteRequest } from '../api/favorites';
import { toApiError } from '../api/errors';
import { useAuth } from '../context/AuthContext';
import type { FavoritesResponse, NFT } from '../types';

function useFavoritesKey() {
  const { token } = useAuth();
  return ['favorites', token ?? 'guest'] as const;
}

// Only signed-in users have favorites: for visitors the query never runs
export function useFavorites() {
  const { status } = useAuth();
  const key = useFavoritesKey();
  return useQuery({ queryKey: key, queryFn: fetchFavorites, enabled: status === 'authenticated' });
}

export function useIsFavorite(nftId: string): boolean {
  return useFavorites().data?.items.some((n) => n.id === nftId) ?? false;
}

type ToggleInput = { nft: NFT; favorite: boolean };

// The heart changes at once; if the server says no, it goes back and the user is told.
export function useToggleFavorite() {
  const queryClient = useQueryClient();
  const key = useFavoritesKey();

  return useMutation({
    mutationFn: ({ nft, favorite }: ToggleInput) => (favorite ? addFavoriteRequest(nft.id) : removeFavoriteRequest(nft.id)),
    // Taps on the same heart are sent in order, so the last tap is the one that wins
    scope: { id: 'favorites-write' },

    onMutate: async ({ nft, favorite }) => {
      await queryClient.cancelQueries({ queryKey: key }); // an older response must not overwrite the guess
      const previous = queryClient.getQueryData<FavoritesResponse>(key);
      queryClient.setQueryData<FavoritesResponse>(key, (old) => {
        const items = (old?.items ?? []).filter((n) => n.id !== nft.id);
        return { items: favorite ? [nft, ...items] : items };
      });
      return { previous };
    },

    onError: (error, { nft, favorite }, context) => {
      queryClient.setQueryData(key, context?.previous); // rollback
      toast.error(
        toApiError(error).isSessionProblem
          ? 'Entre novamente para atualizar seus favoritos.'
          : favorite
            ? `Não foi possível favoritar ${nft.title}. Tente novamente.`
            : `Não foi possível remover ${nft.title} dos favoritos. Tente novamente.`,
      );
    },

    // Whatever happened, the server has the final word
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
