import { createFileRoute } from '@tanstack/react-router';
import { NftDetailPage } from '../pages/NftDetail';

export const Route = createFileRoute('/nft/$id')({
  component: NftDetailPage,
});