import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Skeleton } from '@/components/ui/skeleton';
import type { NFT } from '../types';

// Cards per row: 2 on a phone, 4 on a tablet, 5 on a desktop (see the basis classes below)
const SLOT = 'basis-[calc((100%-1.5rem)/2)] md:basis-[calc((100%-4.5rem)/4)] lg:basis-[calc((100%-6rem)/5)]';

type Props = { title: string; items: NFT[] | undefined; loading?: boolean };

export function NftCarousel({ title, items, loading }: Props) {
  const headingId = useId();
  const scroller = useRef<HTMLUListElement>(null);
  const [pages, setPages] = useState(1);
  const [current, setCurrent] = useState(0);

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el || el.clientWidth === 0) return;
    const count = Math.max(1, Math.ceil((el.scrollWidth - 2) / el.clientWidth));
    const room = el.scrollWidth - el.clientWidth;
    setPages(count);
    setCurrent(room <= 0 ? 0 : Math.round((el.scrollLeft / room) * (count - 1)));
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, [measure, items?.length]);

  const goTo = (page: number) => {
    const el = scroller.current;
    if (!el) return;
    const room = el.scrollWidth - el.clientWidth;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: pages <= 1 ? 0 : (room * page) / (pages - 1), behavior: reduce ? 'auto' : 'smooth' });
  };

  if (!loading && (!items || items.length === 0)) return null;

  return (
    <section aria-labelledby={headingId} className="mt-24">
      <h2 id={headingId} className="border-b border-primary/30 pb-2 text-lg font-bold text-primary">
        {title}
      </h2>

      {loading ? (
        <div aria-busy="true" className="mt-8 flex gap-6 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`${SLOT} shrink-0`}>
              <Skeleton className="aspect-[220/254] w-full" />
              <Skeleton className="mt-3 h-4 w-3/4" />
              <Skeleton className="mt-2 h-4 w-1/3" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <ul
            ref={scroller}
            className="mt-8 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {items!.map((nft) => (
              <li key={nft.id} className={`${SLOT} shrink-0 snap-start`}>
                <Link to="/nft/$id" params={{ id: nft.id }} className="group block">
                  <div className="aspect-[220/254] bg-card px-5 py-1">
                    <img
                      src={nft.image}
                      alt=""
                      loading="lazy"
                      className="size-full rounded-2xl object-cover"
                    />
                  </div>
                  <p className="mt-3 text-sm group-hover:text-primary">{nft.title}</p>
                  <p className="mt-1 text-sm font-bold text-primary">{nft.priceInEth} ETH</p>
                </Link>
              </li>
            ))}
          </ul>

          {pages > 1 && (
            <div className="mt-6 flex justify-center">
              {Array.from({ length: pages }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Ver grupo ${i + 1} de ${pages}`}
                  aria-current={i === current ? 'true' : undefined}
                  onClick={() => goTo(i)}
                  className="group grid size-6 place-items-center"
                >
                  <span
                    className={`size-3 rounded-full border border-primary ${i === current ? 'bg-primary' : 'bg-transparent group-hover:bg-primary/40'}`}
                  />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
