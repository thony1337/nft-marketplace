import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { fetchNfts } from '../api/nfts';
import { FeaturedNft } from '../components/FeaturedNft';
import { Pagination } from '../components/Pagination';
import { PriceFilter } from '../components/PriceFilter';
import { Skeleton } from '@/components/ui/skeleton';
import { setMobileFiltersOpen, useMobileFiltersOpen } from '@/lib/mobileFilters';
import {
  COLLECTION_IDS,
  COLLECTION_LABELS,
  NETWORK_IDS,
  NETWORK_LABELS,
  PAGE_SIZE,
  SORT_LABELS,
  TAB_LABELS,
} from '@/lib/catalog';
import type { CatalogSort, CatalogTab } from '../types';

const route = getRouteApi('/');

export function Catalog() {
  const search = route.useSearch();
  const navigate = route.useNavigate();

  const params = { ...search, pageSize: PAGE_SIZE };

  const { data, isLoading, error } = useQuery({
    queryKey: ['nfts', params],
    queryFn: () => fetchNfts(params),
    placeholderData: keepPreviousData,
  });

  // Any filter change goes back to page 1, as the README requires
  const setFilter = (patch: Partial<typeof search>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch, page: 1 }) });

  const setPage = (page: number) => navigate({ search: (prev) => ({ ...prev, page }) });

  const clearFilters = () => navigate({ search: { sort: search.sort } });

  const hasFilters = Boolean(
    search.collection ||
      search.network ||
      search.q ||
      search.minPrice ||
      search.maxPrice ||
      search.tab !== 'all',
  );

  const optionClass = (active: boolean) =>
    `flex h-10 w-full items-center justify-between px-3 text-left hover:text-primary ${active ? 'text-primary' : 'text-muted-foreground'}`;
  const facets = data?.facets;
  const filtersOpen = useMobileFiltersOpen();

  return (
    <section className="grid gap-12 py-12 max-md:gap-0 max-md:py-6 lg:grid-cols-[310px_1fr]">
      <div className="flex flex-col gap-6">
      {filtersOpen && (
        <button type="button" aria-label="Fechar filtros" onClick={() => setMobileFiltersOpen(false)} className="fixed inset-0 z-40 bg-black/60 md:hidden" />
      )}
      {/* Phones: a sheet opened from the button beside the search field. Larger screens: the side column. */}
      <aside
        aria-label="Filtros"
        className={`h-fit bg-card p-5 ${
          filtersOpen
            ? 'max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-50 max-md:max-h-[85vh] max-md:overflow-y-auto max-md:rounded-t-[24px]'
            : 'max-md:hidden'
        }`}
      >
        <h2 className="text-lg font-bold">Coleções</h2>
        <ul className="mt-3 text-sm">
          {COLLECTION_IDS.map((id) => {
            const active = search.collection === id;
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter({ collection: active ? undefined : id })}
                  className={optionClass(active)}
                >
                  <span>{COLLECTION_LABELS[id]}</span>
                  {facets && <span>({facets.collection[id] ?? 0})</span>}
                </button>
              </li>
            );
          })}
        </ul>

        <PriceFilter
          key={`${search.minPrice}-${search.maxPrice}`}
          min={search.minPrice}
          max={search.maxPrice}
          onApply={(minPrice, maxPrice) => setFilter({ minPrice, maxPrice })}
        />

        <h2 className="mt-6 text-lg font-bold">Rede</h2>
        <ul className="mt-3 text-sm">
          {NETWORK_IDS.map((id) => {
            const active = search.network === id;
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter({ network: active ? undefined : id })}
                  className={optionClass(active)}
                >
                  <span>{NETWORK_LABELS[id]}</span>
                  {facets && <span>({facets.network[id] ?? 0})</span>}
                </button>
              </li>
            );
          })}
        </ul>

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="mt-6 text-sm text-primary underline"
          >
            Limpar filtros
          </button>
        )}
        <button type="button" onClick={() => setMobileFiltersOpen(false)} className="mt-6 block w-full rounded-sm bg-primary py-2.5 text-sm font-bold text-primary-foreground md:hidden">
          Ver resultados
        </button>
      </aside>

      <div className="max-md:hidden"><FeaturedNft /></div>
      </div>

      <div id="catalogo" className="scroll-mt-6">
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm font-bold max-md:gap-2 max-md:text-xs">
          <div role="tablist" className="flex gap-5 max-md:gap-4">
            {(Object.keys(TAB_LABELS) as CatalogTab[]).map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={search.tab === tab}
                onClick={() => setFilter({ tab })}
                className={`border-b-2 pb-1 ${
                  search.tab === tab ? 'border-primary text-primary' : 'border-transparent'
                }`}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 font-normal">
            Ordenar por:
            <select
              value={search.sort}
              onChange={(e) => setFilter({ sort: e.target.value as CatalogSort })}
              className="bg-transparent font-bold"
            >
              {(Object.keys(SORT_LABELS) as CatalogSort[]).map((s) => (
                <option key={s} value={s} className="bg-card">
                  {SORT_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {data && (
          <p className="mt-6 text-sm text-muted-foreground max-md:sr-only" aria-live="polite">
            {data.total} {data.total === 1 ? 'resultado' : 'resultados'}
            {search.q && <> para “{search.q}”</>}
          </p>
        )}

        {error && (
          <p role="alert" className="mt-8 text-destructive">
            Erro ao carregar o catálogo de NFTs.
          </p>
        )}

        {data && data.items.length === 0 && (
          <p className="mt-8 text-muted-foreground">Nenhum NFT encontrado para esses filtros.</p>
        )}

        <ul className="mt-6 grid gap-x-8 gap-y-10 sm:grid-cols-2 xl:grid-cols-3 max-md:grid-cols-2 max-md:gap-x-3 max-md:gap-y-5 max-md:[&>li:nth-child(even)]:mt-8">
          {isLoading &&
            Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <li key={i}>
                <Skeleton className="aspect-[258/300] w-full" />
              </li>
            ))}

          {data?.items.map((nft) => (
            <li key={nft.id}>
              <Link to="/nft/$id" params={{ id: nft.id }} className="group block">
                <div className="bg-card p-1 rounded-[20px] max-md:rounded-[24px] max-md:p-1.5">
                  <img
                    src={nft.image}
                    alt={nft.title}
                    loading="lazy"
                    className="aspect-square w-full rounded-[16px] object-cover"
                  />
                  <div className="h-12 max-md:h-6" />
                </div>
                <p className="mt-2 text-sm group-hover:text-primary">{nft.title}</p>
                <p className="mt-1 font-bold text-primary">{nft.priceInEth} ETH</p>
              </Link>
            </li>
          ))}
        </ul>

        {data && (
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        )}
      </div>
    </section>
  );
}