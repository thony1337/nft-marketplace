import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import apeEmerald from '@/assets/nfts/ape-emerald.webp';
import apeNoir from '@/assets/nfts/ape-noir.webp';

const BANNERS = [
  {
    title: 'Lançamentos gênese de edição limitada',
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    image: apeEmerald,
    search: { page: 1, tab: 'new', sort: 'recent' },
  },
  {
    title: 'Arte digital selecionada e muito mais',
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
    image: apeNoir,
    search: { page: 1, tab: 'all', sort: 'recent', collection: 'arte-digital' },
  },
] as const;

export function PromoBanners() {
  return (
    <section aria-label="Destaques" className="mt-8 grid gap-8 lg:grid-cols-2">
      {BANNERS.map((b) => (
        <article key={b.title} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] overflow-hidden rounded-xl bg-card">
          <img src={b.image} alt="" loading="lazy" className="size-full min-h-[250px] rounded-r-[28px] object-cover object-top" />
          <div className="flex flex-col items-end justify-center gap-3 p-6 text-right">
            <h2 className="text-lg font-bold leading-6">{b.title}</h2>
            <p className="text-sm leading-6 text-muted-foreground">{b.text}</p>
            <Link
              to="/"
              search={b.search}
              hash="catalogo"
              className="inline-flex h-10 items-center gap-1 rounded bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Explorar <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </article>
      ))}
    </section>
  );
}
