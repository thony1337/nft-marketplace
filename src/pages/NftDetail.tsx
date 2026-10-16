import { toastPosition } from '@/lib/toastPosition';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi, Link, useNavigate, useRouter } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { ChevronLeft, Heart, Mail, Minus, Plus, ShoppingCart, Star, User, ZoomIn } from 'lucide-react';
import { toast } from 'sonner';
import { fetchNft, fetchNfts } from '../api/nfts';
import { toApiError } from '../api/errors';
import { Breadcrumb } from '../components/Breadcrumb';
import { NftCarousel } from '../components/NftCarousel';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { MAX_PER_LINE, NETWORK_LABELS } from '@/lib/catalog';
import { useAuth } from '../context/AuthContext';
import { useAddToCart, useCart, useCartCount } from '../hooks/useCart';
import { useIsFavorite, useFavorites, useToggleFavorite } from '../hooks/useFavorites';
import type { NftDetail as NftDetailData } from '../types';

const route = getRouteApi('/nft/$id');

export function NftDetailPage() {
  const { id } = route.useParams();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['nft', id],
    queryFn: () => fetchNft(id),
    // A missing NFT will not appear on a retry, so show it immediately
    retry: (failureCount, err) =>
      !(isAxiosError(err) && err.response?.status === 404) && failureCount < 2,
  });

  if (isLoading) return <DetailSkeleton />;

  // A failed background refresh must not take the NFT off the screen: the error page is only for
  // when there is nothing to show
  if (!data) {
    const notFound = isAxiosError(error) && error.response?.status === 404;
    return (
      <div role="alert" className="py-24 text-center">
        <h1 className="text-2xl font-bold">
          {notFound ? 'NFT não encontrado' : 'Não foi possível carregar este NFT'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {notFound
            ? 'O endereço pode estar errado ou o NFT foi removido.'
            : 'Verifique sua conexão e tente novamente.'}
        </p>
        <div className="mt-6 flex justify-center gap-6 text-sm">
          {!notFound && (
            <button type="button" onClick={() => refetch()} className="text-primary underline">
              Tentar novamente
            </button>
          )}
          <Link to="/" className="text-primary underline">
            Voltar ao catálogo
          </Link>
        </div>
      </div>
    );
  }

  // The key resets edition, quantity and gallery when navigating between NFTs
  return <DetailView key={data.id} nft={data} />;
}

function DetailView({ nft }: { nft: NftDetailData }) {
  const [editionId, setEditionId] = useState(nft.editions.find((e) => e.stock > 0)?.id);
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);

  const navigate = useNavigate();
  const router = useRouter();
  const cartCount = useCartCount();
  const { status, user, openLogin } = useAuth();
  const queryClient = useQueryClient();
  const addToCart = useAddToCart();
  const cart = useCart();
  const favorites = useFavorites();
  const isFavorite = useIsFavorite(nft.id);
  const toggleFavorite = useToggleFavorite();

  // More from the same collection. It is a nicety: if it fails the page simply goes without it
  const related = useQuery({
    queryKey: ['nfts', 'related', nft.collection],
    queryFn: () => fetchNfts({ collection: nft.collection, pageSize: 12 }),
  });
  const relatedItems = related.data?.items.filter((item) => item.id !== nft.id);

  const edition = nft.editions.find((e) => e.id === editionId);
  // What is already in the cart counts against the edition's limit
  const inCart = cart.data?.items.find((l) => l.nft.id === nft.id && l.edition.id === editionId)?.quantity ?? 0;
  const editionLimit = edition ? Math.min(edition.stock, MAX_PER_LINE) : 0;
  const maxQuantity = Math.max(editionLimit - inCart, 0);
  // Always show a valid number, even if stock changes while the page is open
  const shownQuantity = maxQuantity > 0 ? Math.min(quantity, maxQuantity) : 0;
  const soldOut = nft.stock === 0;
  const limitMessage = !edition
    ? ''
    : inCart > 0 && maxQuantity === 0
      ? `Você já tem ${inCart} no carrinho, o máximo desta edição.`
      : shownQuantity >= maxQuantity && maxQuantity > 0
        ? edition.stock <= MAX_PER_LINE
          ? `Apenas ${edition.stock} em estoque nesta edição${inCart ? ` (${inCart} já no carrinho)` : ''}.`
          : `Limite de ${MAX_PER_LINE} unidades por item${inCart ? ` (${inCart} já no carrinho)` : ''}.`
        : '';

  const buy = () => {
    if (!edition || shownQuantity < 1) return;
    addToCart.mutate(
      { nftId: nft.id, editionId: edition.id, quantity: shownQuantity },
      {
        onSuccess: () => {
          setQuantity(1);
          toast.success(`${nft.title} adicionado ao carrinho`, {
            action: { label: 'Ver carrinho', onClick: () => navigate({ to: '/cart' }) },
            position: toastPosition(),
          });
        },
        onError: (error) => {
          const apiError = toApiError(error);
          toast.error(apiError.message, { position: toastPosition() });
          // Stock or limits moved under us: show the page as it is now
          if (apiError.code === 'OUT_OF_STOCK' || apiError.code === 'QUANTITY_LIMIT') {
            void queryClient.invalidateQueries({ queryKey: ['nft', nft.id] });
            void queryClient.invalidateQueries({ queryKey: ['cart'] });
          }
        },
      },
    );
  };

  const favorite = () => {
    if (status !== 'authenticated') return openLogin();
    toggleFavorite.mutate({ nft, favorite: !isFavorite });
  };

  const selectEdition = (id: string) => {
    setEditionId(id);
    setQuantity(1);
  };

  const stepper =
    'flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40';

  return (
    <article className="pb-16 max-md:pb-56">
      <div className="max-md:hidden">
        <Breadcrumb trail={['Mercado']} />
      </div>

      {/* Phones: back and favorite float over the picture, as in the design */}
      <div className="flex items-center justify-between pt-5 md:hidden">
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => router.history.back()}
          className="grid size-10 place-items-center rounded-full bg-card text-primary"
        >
          <ChevronLeft aria-hidden className="size-5" />
        </button>
        <div className="flex gap-2">
          {status === 'authenticated' && user ? (
            <Link to="/profile" aria-label={`Perfil de ${user.name}`} className="grid size-10 place-items-center rounded-full bg-card text-primary">
              <User aria-hidden className="size-5" />
            </Link>
          ) : (
            <button type="button" aria-label="Entrar" onClick={openLogin} className="grid size-10 place-items-center rounded-full bg-card text-primary">
              <User aria-hidden className="size-5" />
            </button>
          )}
          <button
            type="button"
            aria-label={isFavorite ? 'Favoritado' : 'Favoritar'}
            aria-pressed={isFavorite}
            disabled={status === 'loading' || (status === 'authenticated' && favorites.isPending)}
            onClick={favorite}
            className="grid size-10 place-items-center rounded-full bg-card text-primary"
          >
            <Heart aria-hidden className={`size-5 ${isFavorite ? 'fill-primary' : ''}`} />
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-6 lg:grid-cols-[100px_444px_1fr] lg:gap-7 max-md:gap-0">
        {/* Gallery: thumbnails first on desktop, below the main image on mobile */}
        <div className="order-2 flex gap-3 lg:order-1 lg:flex-col max-md:hidden">
          {nft.gallery.map((src, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Ver imagem ${i + 1}`}
              aria-pressed={i === imageIndex}
              onClick={() => setImageIndex(i)}
              className={`size-20 shrink-0 overflow-hidden rounded-lg border lg:size-[100px] ${
                i === imageIndex ? 'border-primary' : 'border-transparent'
              }`}
            >
              <img src={src} alt="" width={100} height={100} className="size-full object-cover" />
            </button>
          ))}
        </div>

        <div className="relative order-1 h-fit bg-card p-5 lg:order-2 max-md:bg-transparent max-md:p-0">
          <img
            src={nft.gallery[imageIndex]}
            alt={nft.title}
            width={404}
            height={404}
            fetchPriority="high"
            className="aspect-square w-full rounded-[28px] object-cover max-md:aspect-[4/3]"
          />
          <button
            type="button"
            aria-label="Ampliar imagem"
            onClick={() => setZoomOpen(true)}
            className="absolute right-6 top-6 grid size-8 place-items-center rounded-full bg-card/90 hover:text-primary max-md:hidden"
          >
            <ZoomIn aria-hidden className="size-5" />
          </button>
        </div>

        <div className="order-3 max-md:relative max-md:-mx-4 max-md:-mt-8 max-md:rounded-t-[28px] max-md:bg-card max-md:px-6 max-md:pt-6">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-[28px] font-bold leading-tight max-md:text-xl">{nft.title}</h1>
            <p aria-hidden className="flex shrink-0 items-center gap-1 rounded-full border border-primary px-2.5 py-1 text-xs md:hidden">
              <Star className="size-3 fill-primary text-primary" />
              <b>{nft.rating.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</b>({nft.reviewCount})
            </p>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-b border-primary/30 pb-2 max-md:hidden">
            <p className="text-[22px] font-bold text-primary">{nft.priceInEth} ETH</p>
            <p className="flex items-center gap-2 text-[15px]">
              <Stars rating={nft.rating} />
              {nft.reviewCount} avaliações de colecionadores
            </p>
          </div>

          <h2 className="mt-5 font-bold max-md:sr-only">Sobre este NFT:</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{nft.description}</p>

          <h2 className="mt-3 font-bold">Edição:</h2>
          <div role="radiogroup" aria-label="Edição" className="mt-2 flex flex-wrap gap-2">
            {nft.editions.map((e) => {
              const unavailable = e.stock === 0;
              const selected = e.id === editionId;
              return (
                <button
                  key={e.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={unavailable}
                  title={unavailable ? 'Esgotada' : `${e.stock} disponíveis`}
                  onClick={() => selectEdition(e.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    selected ? 'border-primary text-primary' : 'border-primary/30'
                  } ${unavailable ? 'line-through opacity-40' : 'hover:border-primary'}`}
                >
                  {e.label}
                </button>
              );
            })}
          </div>

          {/* On phones this block becomes the bar fixed to the bottom, with the price beside the quantity */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-40 max-md:mt-0 max-md:flex-col max-md:items-stretch max-md:gap-4 max-md:rounded-t-[28px] max-md:bg-card max-md:px-6 max-md:pb-6 max-md:pt-5 max-md:shadow-[0_-8px_24px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-muted-foreground md:hidden">Qtd.</span>
                <button
                  type="button"
                  aria-label="Diminuir quantidade"
                  className={stepper}
                  disabled={shownQuantity <= 1}
                  onClick={() => setQuantity(shownQuantity - 1)}
                >
                  <Minus className="size-4" />
                </button>
                <output aria-label="Quantidade" className="w-6 text-center">
                  {shownQuantity}
                </output>
                <button
                  type="button"
                  aria-label="Aumentar quantidade"
                  className={stepper}
                  disabled={shownQuantity === 0 || shownQuantity >= maxQuantity}
                  onClick={() => setQuantity(shownQuantity + 1)}
                >
                  <Plus className="size-4" />
                </button>
              </div>
              <p className="text-xl font-bold text-primary md:hidden">{nft.priceInEth} ETH</p>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                className="h-10 w-[130px] rounded font-bold max-md:h-14 max-md:flex-1 max-md:rounded-full max-md:bg-gradient-to-br max-md:from-[#d28a4c] max-md:to-[#a8693a]"
                disabled={!edition || shownQuantity < 1 || addToCart.isPending}
                onClick={buy}
              >
                {addToCart.isPending ? (
                  'ADICIONANDO…'
                ) : (
                  <>
                    <span className="max-md:hidden">COMPRAR</span>
                    <span className="md:hidden">Comprar NFT</span>
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 w-[130px] rounded border-primary text-primary hover:text-primary max-md:hidden"
                aria-pressed={isFavorite}
                disabled={status === 'loading' || (status === 'authenticated' && favorites.isPending)}
                onClick={favorite}
              >
                <Heart className={`size-4 ${isFavorite ? 'fill-primary text-primary' : ''}`} />
                {isFavorite ? 'Favoritado' : 'Favoritar'}
              </Button>
              <Link
                to="/cart"
                aria-label={`Carrinho, ${cartCount} itens`}
                className="relative hidden size-14 shrink-0 place-items-center rounded-full border border-primary/30 bg-background/40 text-primary max-md:grid"
              >
                <ShoppingCart aria-hidden className="size-5" />
                {cartCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {cartCount}
                  </span>
                )}
              </Link>
            </div>
          </div>

          <p role="status" className="mt-3 min-h-5 text-xs text-muted-foreground">
            {soldOut && 'Esgotado: nenhuma edição disponível.'}
            {!soldOut && !edition && 'Selecione uma edição disponível.'}
            {limitMessage}
          </p>

          <dl className="mt-3 space-y-3 text-sm text-muted-foreground">
            <div>
              <dt className="inline">ID do token: </dt>
              <dd className="inline">{nft.tokenId}</dd>
            </div>
            <div>
              <dt className="inline">Coleção: </dt>
              <dd className="inline">{nft.collectionName}</dd>
            </div>
            <div>
              <dt className="inline">Atributos: </dt>
              <dd className="inline">{nft.attributes.join(', ')}</dd>
            </div>
          </dl>

          <ShareRow nft={nft} />
        </div>
      </div>

      <section className="mt-24">
        <div role="tablist" className="flex gap-8 border-b border-primary/30 text-base">
          <button
            type="button"
            role="tab"
            aria-selected="true"
            className="-mb-px border-b-2 border-primary pb-2 font-bold text-primary"
          >
            Detalhes do NFT
          </button>
          <button
            type="button"
            role="tab"
            aria-selected="false"
            disabled
            title="Em breve"
            className="pb-2 font-normal opacity-80"
          >
            Avaliações de colecionadores ({nft.reviewCount})
          </button>
        </div>

        <div role="tabpanel" className="mt-4 space-y-4 text-sm leading-6 text-muted-foreground">
          <p className="whitespace-pre-line">{nft.details}</p>
          <div>
            <h3 className="font-bold text-foreground">Rede:</h3>
            <p>
              Cunhado na {NETWORK_LABELS[nft.network]} com procedência imutável e metadados
              armazenados no IPFS.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-foreground">Contrato:</h3>
            <p>Direitos autorais do criador: 5% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.</p>
          </div>
          <div>
            <h3 className="font-bold text-foreground">Direitos autorais:</h3>
            <p>0x7A42...19E8 • Contrato inteligente ERC-721 verificado.</p>
          </div>
        </div>
      </section>

      <NftCarousel title="Mais desta coleção" items={relatedItems} loading={related.isPending} />

      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-[min(90vw,720px)]">
          <DialogHeader>
            <DialogTitle className="sr-only">{nft.title}</DialogTitle>
            <DialogDescription className="sr-only">Imagem ampliada</DialogDescription>
          </DialogHeader>
          <img src={nft.gallery[imageIndex]} alt={nft.title} className="aspect-square w-full rounded-2xl object-cover" />
        </DialogContent>
      </Dialog>
    </article>
  );
}

// External share links: plain addresses, nothing is sent from here
function ShareRow({ nft }: { nft: NftDetailData }) {
  const url = typeof window === 'undefined' ? '' : window.location.href;
  const text = `${nft.title} na Kurio`;
  const link = 'grid size-6 place-items-center text-sm font-bold hover:text-primary';
  return (
    <p className="mt-3 flex items-center gap-2 text-sm font-bold">
      Compartilhar este NFT:
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Compartilhar no LinkedIn (abre em nova aba)"
        className={link}
      >
        in
      </a>
      <a
        href={`mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`}
        aria-label="Compartilhar por e-mail"
        className={link}
      >
        <Mail aria-hidden className="size-4" />
      </a>
      <a
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Compartilhar no X (abre em nova aba)"
        className={link}
      >
        X
      </a>
    </p>
  );
}

function Stars({ rating }: { rating: number }) {
  const label = rating.toLocaleString('pt-BR', { minimumFractionDigits: 1 });
  return (
    <span role="img" aria-label={`Nota ${label} de 5`} className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={`size-3.5 ${i < Math.round(rating) ? 'fill-primary text-primary' : 'text-muted-foreground'}`}
        />
      ))}
    </span>
  );
}

// Same grid and block sizes as the real page, so nothing shifts when data arrives
function DetailSkeleton() {
  return (
    <div className="pb-16" aria-busy="true" aria-label="Carregando NFT">
      <Skeleton className="mt-6 h-5 w-40" />
      <div className="mt-4 grid gap-8 lg:grid-cols-[100px_444px_1fr]">
        <div className="order-2 flex gap-3 lg:order-1 lg:flex-col">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="size-20 shrink-0 rounded-xl lg:size-[100px]" />
          ))}
        </div>
        <Skeleton className="order-1 aspect-square w-full lg:order-2" />
        <div className="order-3 space-y-4">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      <section className="mt-24" aria-hidden="true">
        <Skeleton className="h-[362px] w-full max-md:h-[602px]" />
      </section>
      <NftCarousel title="Mais desta coleção" items={[]} loading />
    </div>
  );
}
