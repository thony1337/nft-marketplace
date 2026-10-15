import { http, HttpResponse } from 'msw';
import type { CatalogSort, CatalogTab, CollectionId, Network } from '../../types';
import { liveDetailById, liveSummaries } from '../market';
import { apiError } from '../http';
import { queryNfts } from '../nftQuery';
import { activeScenario } from '../scenarios';

export const catalogRoutes = [
  // Listar NFTs (busca, filtros, ordenação e paginação)
  http.get('/api/nfts', ({ request }) => {
    const sp = new URL(request.url).searchParams;
    const num = (key: string) => {
      const n = Number(sp.get(key));
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
    };

    const source = activeScenario().emptyCatalog ? [] : liveSummaries();
    return HttpResponse.json(
      queryNfts(source, {
        q: sp.get('q') ?? undefined,
        collection: (sp.get('collection') ?? undefined) as CollectionId | undefined,
        network: (sp.get('network') ?? undefined) as Network | undefined,
        minPrice: sp.get('minPrice') ?? undefined,
        maxPrice: sp.get('maxPrice') ?? undefined,
        tab: (sp.get('tab') ?? undefined) as CatalogTab | undefined,
        sort: (sp.get('sort') ?? undefined) as CatalogSort | undefined,
        page: num('page'),
        pageSize: num('pageSize'),
      }),
    );
  }),

  // Obter NFT por ID (com edições, atributos e avaliações)
  http.get('/api/nfts/:id', ({ params }) => {
    const nft = activeScenario().emptyCatalog ? undefined : liveDetailById(String(params.id));
    if (!nft) return apiError(404, 'NFT_NOT_FOUND', 'NFT não encontrado');
    return HttpResponse.json(nft);
  }),
];
