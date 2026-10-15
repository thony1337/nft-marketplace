import { getRouteApi } from '@tanstack/react-router';
import { ArrowRight, Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import apeEmerald from '@/assets/nfts/ape-emerald.webp';
import apeSage from '@/assets/nfts/ape-sage.webp';
import { setMobileFiltersOpen, useMobileFiltersOpen } from '@/lib/mobileFilters';

const route = getRouteApi('/');

// Phones: the design opens with a search field and the filters button instead of a header.
// The search keeps whatever filters are on (it only changes the text and goes back to page 1).
function MobileSearch() {
  const navigate = route.useNavigate();
  const { q } = route.useSearch();
  const filtersOpen = useMobileFiltersOpen();
  return (
    <div className="flex items-center gap-3 pt-5 md:hidden">
      <form
        role="search"
        className="relative flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          const text = String(new FormData(e.currentTarget).get('q') ?? '').trim();
          void navigate({ search: (prev) => ({ ...prev, q: text || undefined, page: 1 }), hash: 'catalogo' });
        }}
      >
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-primary" />
        <input
          name="q"
          type="search"
          aria-label="Buscar NFTs"
          placeholder="Explorar coleções"
          defaultValue={q ?? ''}
          key={q ?? ''}
          maxLength={80}
          className="h-12 w-full rounded-[12px] bg-card pl-11 pr-3 text-sm font-medium text-foreground placeholder:text-muted-foreground"
        />
      </form>
      <button
        type="button"
        aria-label="Filtros"
        aria-expanded={filtersOpen}
        onClick={() => setMobileFiltersOpen(!filtersOpen)}
        className="flex size-12 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#d28a4c] to-[#a8693a] text-background"
      >
        <SlidersHorizontal aria-hidden className="size-5" />
      </button>
    </div>
  );
}

export function Hero() {
  return (
    <>
      <MobileSearch />
      <section className="grid items-center gap-8 py-8 max-md:relative max-md:mt-5 max-md:grid-cols-[1fr_auto] max-md:gap-3 max-md:overflow-hidden max-md:rounded-[24px] max-md:bg-gradient-to-br max-md:from-[#7a4d2a] max-md:to-[#2a1a10] max-md:p-4 md:grid-cols-[1fr_450px]">
        <div className="md:pl-10">
          <p className="text-sm font-medium tracking-wider max-md:text-xs">Bem-vindo à Kurio</p>
          <h1 className="mt-4 max-w-[560px] text-4xl font-bold leading-[1.5] md:text-5xl max-md:mt-2 max-md:text-xl max-md:leading-[1.6]">
            SEJA DONO DO FUTURO DA ARTE DIGITAL
          </h1>
          <p className="mt-4 max-w-[560px] text-sm leading-6 text-muted-foreground max-md:mt-2 max-md:line-clamp-4 max-md:text-xs max-md:leading-5">
            Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte
            digital rara, apoie artistas e tenha uma parte da cultura da internet.
          </p>
          <Button asChild size="lg" className="mt-8 font-bold max-md:mt-3 max-md:h-auto max-md:bg-transparent max-md:p-0 max-md:text-xs max-md:text-primary max-md:hover:bg-transparent">
            <a href="#catalogo">
              EXPLORAR
              <ArrowRight aria-hidden className="ml-2 size-4 md:hidden" />
            </a>
          </Button>
          <div aria-hidden="true" className="mt-16 flex justify-end gap-3 pr-10 max-md:absolute max-md:inset-x-0 max-md:bottom-2 max-md:mt-0 max-md:justify-center max-md:gap-2 max-md:pr-0">
            <span className="size-2 rounded-full bg-primary" />
            <span className="size-2 rounded-full bg-primary/60" />
            <span className="size-2 rounded-full bg-primary/60" />
          </div>
        </div>
        <div className="relative justify-self-end max-md:self-start">
          <img src={apeEmerald} alt="NFT Emerald Ape: macaco de óculos redondos e jaqueta verde" width={450} height={450} fetchPriority="high" className="aspect-square w-full max-w-[450px] justify-self-end rounded-[36px] object-cover max-md:size-[138px] max-md:rounded-[16px]" />
          <img src={apeSage} alt="" aria-hidden className="absolute -bottom-2 -left-4 size-14 rounded-[12px] border-2 border-[#2a1a10] object-cover md:hidden" />
        </div>
      </section>
    </>
  );
}
