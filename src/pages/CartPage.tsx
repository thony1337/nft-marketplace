import { toastPosition } from '@/lib/toastPosition';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useRouter } from '@tanstack/react-router';
import { ChevronLeft, ShoppingCart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { toApiError } from '../api/errors';
import { fetchNfts } from '../api/nfts';
import { Breadcrumb } from '../components/Breadcrumb';
import { NftCarousel } from '../components/NftCarousel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { NETWORK_LABELS } from '@/lib/catalog';
import { formatEth } from '@/lib/eth';
import { useAuth } from '../context/AuthContext';
import { useCartCount, useRemoveCartItem, useUpdateCartItem } from '../hooks/useCart';
import { useApplyCoupon, useQuote, useRemoveCoupon } from '../hooks/useQuote';
import type { CartLine } from '../types';

export function CartPage() {
  const { status, openLogin } = useAuth();
  const navigate = useNavigate();
  const cartCount = useCartCount();
  const quote = useQuote();
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  // "Colecionadores também viram": what is trending, minus what is already in the cart
  const trending = useQuery({
    queryKey: ['nfts', 'trending-for-cart'],
    queryFn: () => fetchNfts({ tab: 'trending', pageSize: 12 }),
  });

  // A visitor who never added anything has no cart to ask for
  const data = quote.data;
  const idle = !data && quote.fetchStatus === 'idle' && !quote.isError;

  if (quote.isPending && !idle) return <CartSkeleton />;

  if (quote.isError && !data) {
    return (
      <div role="alert" className="py-24 text-center">
        <h1 className="text-2xl font-bold">Não foi possível carregar seu carrinho</h1>
        <p className="mt-2 text-sm text-muted-foreground">{toApiError(quote.error).message}</p>
        <Button className="mt-6" onClick={() => void quote.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="py-24 text-center max-md:py-0 max-md:pb-24">
        <CartTopBar count={cartCount} />
        <div className="max-md:pt-16" />
        <h1 className="text-2xl font-bold">Seu carrinho está vazio</h1>
        <p className="mt-2 text-sm text-muted-foreground">Encontre um NFT no catálogo e adicione aqui.</p>
        <Link
          to="/"
          className="mt-6 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Explorar o catálogo
        </Link>
      </div>
    );
  }

  // Totals only count as final once the server has answered for the cart as it is now
  const refreshing = quote.isFetching || updateItem.isPending || removeItem.isPending;
  const canCheckout = data.canCheckout && !refreshing;

  const change = (line: CartLine, quantity: number) =>
    updateItem.mutate(
      { itemId: line.id, quantity },
      { onError: (e) => toast.error(toApiError(e).message, { position: toastPosition() }) },
    );
  const remove = (line: CartLine) =>
    removeItem.mutate(line.id, {
      onSuccess: () => toast.success(`${line.nft.title} saiu do carrinho.`, { position: toastPosition() }),
      onError: (e) => toast.error(toApiError(e).message, { position: toastPosition() }),
    });

  const checkout = () => {
    if (status !== 'authenticated') return openLogin();
    void navigate({ to: '/checkout' });
  };

  const inCartIds = new Set(data.items.map((l) => l.nft.id));
  const suggestions = trending.data?.items.filter((n) => !inCartIds.has(n.id));

  return (
    <div className="pb-4 max-md:pb-[340px]">
      <div className="max-md:hidden">
        <Breadcrumb trail={['Mercado', 'Carrinho']} />
      </div>
      <CartTopBar count={cartCount}>
        <h1 className="text-center text-lg font-bold">Carrinho de NFTs</h1>
      </CartTopBar>
      <h1 className="sr-only max-md:hidden">Carrinho</h1>

      <div className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_332px] lg:gap-[86px] max-md:mt-0">
        <div className="min-w-0">
          <div aria-hidden="true" className={`${ROW_GRID} border-b border-primary/30 pb-2 font-bold max-lg:hidden`}>
            <span>NFTs</span>
            <span>Preço</span>
            <span>Edições</span>
            <span>Total</span>
            <span />
          </div>
          <ul className="mt-3 flex flex-col gap-3 max-md:mt-0 max-md:gap-4" aria-label="Itens do carrinho">
            {data.items.map((line) => (
              <CartLineRow
                key={line.id}
                line={line}
                busy={
                  (updateItem.isPending && updateItem.variables?.itemId === line.id) ||
                  (removeItem.isPending && removeItem.variables === line.id)
                }
                pendingQuantity={updateItem.isPending && updateItem.variables?.itemId === line.id ? updateItem.variables.quantity : null}
                onChange={(q) => change(line, q)}
                onRemove={() => remove(line)}
              />
            ))}
          </ul>
        </div>

        <aside
          aria-label="Resumo do pedido"
          className="h-fit max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-40 max-md:rounded-t-[28px] max-md:bg-card max-md:px-5 max-md:pb-6 max-md:pt-5 max-md:shadow-[0_-8px_24px_rgba(0,0,0,0.45)]"
        >
          <h2 className="border-b border-primary/30 pb-2 text-lg font-bold max-md:sr-only">Resumo da carteira</h2>

          <CouponBox />

          {data.couponIssue && (
            <p role="alert" className="mt-3 rounded-md border border-destructive/50 p-3 text-sm text-destructive">
              {data.couponIssue.message} O desconto não foi aplicado.
            </p>
          )}

          <dl className="mt-6 space-y-2 text-base max-md:mt-4 max-md:text-sm" aria-busy={refreshing}>
            <Row label="Subtotal" value={formatEth(data.subtotalEth)} dim={refreshing} />
            <Row
              label={data.coupon ? `Desconto (${data.coupon.code})` : 'Desconto do lançamento'}
              value={data.coupon && data.discountEth !== '0' ? `(-) ${formatEth(data.discountEth)}` : '(-) 0'}
              dim={refreshing}
            />
            <Row label="Taxa de rede" value={formatEth(data.networkFeeEth)} dim={refreshing} note="Taxa estimada" />
            <div className="pt-3">
              <Row label="Total" value={formatEth(data.totalEth)} dim={refreshing} strong />
            </div>
          </dl>

          {!data.canCheckout && !refreshing && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              Alguns itens não estão mais disponíveis na quantidade escolhida. Ajuste ou remova para continuar.
            </p>
          )}

          <Button
            className="mt-5 h-10 w-full rounded font-bold max-md:h-14 max-md:rounded-full max-md:bg-gradient-to-br max-md:from-[#d28a4c] max-md:to-[#a8693a]"
            disabled={!canCheckout}
            onClick={checkout}
          >
            {status === 'authenticated' ? 'Finalizar compra' : 'Entrar para finalizar'}
          </Button>
          <Link to="/" className="mt-4 block text-center text-sm text-primary hover:underline max-md:hidden">
            Continuar explorando
          </Link>
        </aside>
      </div>

      <div className="max-md:hidden">
        <NftCarousel title="Colecionadores também viram" items={suggestions} loading={trending.isPending} />
      </div>
    </div>
  );
}

export default CartPage;

// Phones: back button, cart link with its count, and (when the page has one) the centered title
function CartTopBar({ count, children }: { count: number; children?: ReactNode }) {
  const router = useRouter();
  return (
    <div className="relative md:hidden max-md:pb-5 max-md:pt-5">
      <button
        type="button"
        aria-label="Voltar"
        onClick={() => router.history.back()}
        className="absolute left-0 top-4 grid size-10 place-items-center rounded-full bg-card text-primary"
      >
        <ChevronLeft aria-hidden className="size-5" />
      </button>
      {children}
      <Link to="/cart" aria-label={`Carrinho, ${count} itens`} className="absolute right-0 top-4 grid size-10 place-items-center rounded-full bg-card text-primary">
        <ShoppingCart aria-hidden className="size-5" />
      </Link>
    </div>
  );
}

function Row({ label, value, dim, strong, note }: { label: string; value: string; dim?: boolean; strong?: boolean; note?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${strong ? 'font-bold' : ''} ${dim ? 'opacity-60' : ''}`}>
      <dt>{label}</dt>
      <dd className={`text-right ${strong ? 'text-primary' : ''}`}>
        {value}
        {note && <small className="block text-xs font-normal text-primary">{note}</small>}
      </dd>
    </div>
  );
}

// Same columns for the header and every row: NFT | price | quantity | total | remove
const ROW_GRID = 'lg:grid lg:grid-cols-[minmax(0,2.4fr)_1fr_1.1fr_1fr_40px] lg:items-center lg:gap-3';

function CartLineRow({
  line, busy, pendingQuantity, onChange, onRemove,
}: {
  line: CartLine;
  busy: boolean;
  pendingQuantity: number | null;
  onChange: (quantity: number) => void;
  onRemove: () => void;
}) {
  const shown = pendingQuantity ?? line.quantity;
  const atMax = shown >= line.maxQuantity;
  const step = 'grid size-6 place-items-center rounded-full bg-primary text-sm font-bold leading-none text-primary-foreground disabled:opacity-40';
  return (
    <li
      className={`flex flex-wrap items-center gap-x-4 gap-y-3 bg-card pr-2 ${ROW_GRID} min-h-[70px] max-md:relative max-md:block max-md:min-h-[100px] max-md:overflow-hidden max-md:rounded-[16px] max-md:py-3 max-md:pl-[116px] max-md:pr-[104px]`}
      aria-busy={busy}
    >
      <div className="flex min-w-0 items-center gap-4 max-lg:w-full max-md:block">
        <img src={line.nft.image} alt="" className="size-[70px] shrink-0 rounded-md object-cover max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:h-full max-md:w-[100px] max-md:rounded-none" />
        <div className="min-w-0">
          <Link to="/nft/$id" params={{ id: line.nft.id }} className="block truncate font-bold hover:text-primary">
            {line.nft.title}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            Edição {line.edition.label} · {NETWORK_LABELS[line.nft.network]}
          </p>
          {!line.available && (
            <p role="alert" className="text-xs text-destructive">
              {line.maxQuantity === 0
                ? 'Esta edição esgotou. Remova o item para continuar.'
                : `Só restam ${line.maxQuantity}. Reduza a quantidade para continuar.`}
            </p>
          )}
        </div>
      </div>

      <p className="font-bold text-primary max-md:hidden">
        <span className="font-normal text-muted-foreground lg:sr-only">Preço: </span>
        {formatEth(line.unitPriceEth)}
      </p>

      <div className="flex items-center gap-3 max-md:absolute max-md:right-3 max-md:top-3 max-md:gap-2" role="group" aria-label={`Quantidade de ${line.nft.title}`}>
        <button
          type="button" className={step} aria-label="Diminuir quantidade"
          disabled={busy || shown <= 1 || line.maxQuantity < 1}
          // above the stock the server refuses any value that is still too high: go straight to the limit
          onClick={() => onChange(Math.max(1, Math.min(shown - 1, line.maxQuantity)))}
        >
          −
        </button>
        <output aria-live="polite" className="w-5 text-center">{shown}</output>
        <button type="button" className={step} aria-label="Aumentar quantidade" disabled={busy || atMax} onClick={() => onChange(shown + 1)}>
          +
        </button>
      </div>

      <p className="font-bold text-primary max-lg:ml-auto max-md:mt-2 max-md:text-lg">
        <span className="font-normal text-muted-foreground lg:sr-only max-md:sr-only">Total: </span>
        {formatEth(line.lineTotalEth)}
      </p>

      <button
        type="button" aria-label={`Remover ${line.nft.title}`} disabled={busy} onClick={onRemove}
        className="grid size-10 place-items-center justify-self-center text-muted-foreground hover:text-primary disabled:opacity-40 max-md:absolute max-md:bottom-1 max-md:right-1 max-md:size-8"
      >
        <Trash2 aria-hidden className="size-5" />
      </button>
    </li>
  );
}

function CouponBox() {
  const quote = useQuote();
  const apply = useApplyCoupon();
  const removeCoupon = useRemoveCoupon();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const applied = quote.data?.coupon;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (apply.isPending) return;
    const value = code.trim();
    if (!value) return setError('Informe o código do cupom.');
    setError(null);
    apply.mutate(value, {
      onSuccess: () => setCode(''),
      onError: (e) => {
        const apiError = toApiError(e);
        setError(apiError.fieldErrors?.code ?? apiError.message);
      },
    });
  };

  if (applied) {
    return (
      <div className="mt-5 flex items-center justify-between gap-3 bg-card p-3 text-sm">
        <div>
          <p className="font-bold">{applied.code}</p>
          <p className="text-muted-foreground">{applied.description}</p>
        </div>
        <Button
          variant="ghost" size="sm" disabled={removeCoupon.isPending}
          aria-label={`Remover cupom ${applied.code}`}
          onClick={() => removeCoupon.mutate(undefined, { onError: (e) => toast.error(toApiError(e).message, { position: toastPosition() }) })}
        >
          Remover
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-5" noValidate>
      <label htmlFor="coupon" className="text-sm font-bold max-md:sr-only">Código promocional</label>
      <div className="mt-2 flex">
        <Input
          id="coupon" value={code} autoComplete="off" disabled={apply.isPending}
          placeholder="Digite o código promocional..."
          className="h-10 min-w-0 flex-1 rounded-r-none border-primary text-xs max-md:h-12 max-md:rounded-l-full max-md:border-primary/30 max-md:bg-background/40 max-md:px-5"
          aria-invalid={Boolean(error)} aria-describedby={error ? 'coupon-error' : undefined}
          onChange={(e) => { setCode(e.target.value); setError(null); }}
        />
        <Button type="submit" className="h-10 rounded-l-none font-bold max-md:h-12 max-md:rounded-r-full max-md:bg-gradient-to-br max-md:from-[#d28a4c] max-md:to-[#a8693a] max-md:px-6" disabled={apply.isPending}>
          {apply.isPending ? 'Aplicando…' : 'Aplicar'}
        </Button>
      </div>
      {error && <p id="coupon-error" role="alert" className="mt-1 text-sm text-destructive">{error}</p>}
    </form>
  );
}

function CartSkeleton() {
  return (
    <div className="pb-4" aria-busy="true" aria-label="Carregando carrinho">
      <Skeleton className="mt-6 h-5 w-52" />
      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_332px] lg:gap-[86px]">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-[70px] w-full" />
          <Skeleton className="h-[70px] w-full" />
          <Skeleton className="h-[70px] w-full" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    </div>
  );
}
