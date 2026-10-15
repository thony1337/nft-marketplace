import type { QueryClient } from '@tanstack/react-query';

// Query keys that hold something personal. The first element of the key says which kind of
// data it is, so one list decides what must disappear when the session changes.
export const PRIVATE_ROOTS = ['me', 'cart', 'quote', 'favorites', 'wallets', 'orders', 'order', 'profile'];

const isPrivate = (key: readonly unknown[]) => PRIVATE_ROOTS.includes(String(key[0]));

// Logout, session lost, or a different user: nothing private may stay in memory
export async function clearPrivateData(queryClient: QueryClient): Promise<void> {
  await queryClient.cancelQueries({ predicate: (q) => isPrivate(q.queryKey) });
  queryClient.removeQueries({ predicate: (q) => isPrivate(q.queryKey) });
}
