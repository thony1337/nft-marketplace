import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { toApiError } from '../api/errors';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatEth } from '@/lib/eth';
import { useAuth } from '../context/AuthContext';
import { useOrder } from '../hooks/useOrders';
import type { OrderRecord, OrderStatus } from '../types';

const route = getRouteApi('/orders/$id');
const when = (iso: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

const STATUS: Record<OrderStatus, { title: string; text: string; tone: string }> = {
  pending: { title: 'Processando pagamento…', text: 'Isto leva alguns segundos. Você pode sair desta página: o pedido continua.', tone: 'border-primary/50' },
  confirmed: { title: 'Compra confirmada', text: 'Pagamento aprovado. Guarde este comprovante.', tone: 'border-primary' },
  declined: { title: 'Pagamento recusado', text: 'Nada foi cobrado e seu carrinho continua como estava.', tone: 'border-destructive/60' },
};

export function OrderPage() {
  const { id } = route.useParams();
  const { status: authStatus, openLogin } = useAuth();
  const queryClient = useQueryClient();
  const { data, error, isPending, refetch } = useOrder(id);

  // The moment a payment is confirmed the cart was used up and stock moved: refresh what depends on it
  const seen = useRef<OrderStatus | null>(null);
  useEffect(() => {
    if (!data) return;
    if (seen.current !== null && seen.current !== data.status && data.status !== 'pending') {
      for (const root of ['cart', 'quote', 'nft', 'nfts', 'orders']) void queryClient.invalidateQueries({ queryKey: [root] });
    }
    if (seen.current === null && data.status === 'confirmed') {
      // arrived on an already confirmed order (refresh, link): make sure the cart is not stale either
      for (const root of ['cart', 'quote']) void queryClient.invalidateQueries({ queryKey: [root] });
    }
    seen.current = data.status;
  }, [data, queryClient]);

  if (authStatus === 'loading' || (authStatus === 'authenticated' && isPending)) return <OrderSkeleton />;

  if (authStatus !== 'authenticated') {
    return (
      <div className="py-24 text-center">
        <h1 className="text-2xl font-bold">Entre para ver este pedido</h1>
        <Button className="mt-6" onClick={openLogin}>Entrar</Button>
      </div>
    );
  }

  if (error || !data) {
    const e = toApiError(error);
    const missing = e.status === 404 || e.status === 403;
    return (
      <div role="alert" className="py-24 text-center">
        <h1 className="text-2xl font-bold">{missing ? 'Pedido não encontrado' : 'Não foi possível carregar o pedido'}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {missing ? 'Ele não existe ou não pertence à sua conta.' : e.message}
        </p>
        {missing ? (
          <Link to="/" className="mt-6 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
            Ir para o início
          </Link>
        ) : (
          <Button className="mt-6" onClick={() => void refetch()}>Tentar novamente</Button>
        )}
      </div>
    );
  }

  return <Receipt order={data} />;
}

export default OrderPage;

const shortHash = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`;
const dayMonthYear = (iso: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso)).replace(/\./g, '').replace(/ de /g, ' ');

function Receipt({ order }: { order: OrderRecord }) {
  const s = STATUS[order.status];
  const r = order.receipt;
  const confirmed = order.status === 'confirmed';
  return (
    <div className="mx-auto my-8 w-full max-w-[580px] overflow-hidden rounded-sm bg-card">
      <div role="status" aria-live="polite" className={`px-6 pb-6 pt-8 text-center ${confirmed ? '' : `border-b ${s.tone}`}`}>
        {confirmed ? (
          <>
            <ThankYou />
            {/* the design's line is the visible one; the heading keeps the page named for assistive technology */}
            <h1 className="sr-only">{s.title}</h1>
            <p className="mt-4 text-base font-medium text-muted-foreground">Seus NFTs agora estão na sua carteira</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">{s.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {order.status === 'declined' && order.failure ? `${order.failure.message} ` : ''}
              {s.text}
            </p>
            {order.status === 'pending' && <Skeleton className="mt-4 h-2 w-full" />}
          </>
        )}
      </div>

      <section aria-label="Comprovante">
        <dl className="grid grid-cols-2 divide-primary/60 border-y border-primary/60 py-3 text-sm sm:grid-cols-4 sm:divide-x [&>div]:px-4">
          <Meta label={order.txHash ? 'Transação (simulada)' : 'Pedido'} value={order.txHash ? shortHash(order.txHash) : order.id} mono />
          <Meta label="Data" value={dayMonthYear(order.createdAt)} title={when(order.createdAt)} />
          <Meta label="Total pago" value={formatEth(r.totalEth)} />
          <Meta label="Carteira" value={order.wallet.name} title={`${order.wallet.name} · ${order.wallet.address}`} />
        </dl>

        <div className="px-6 pb-6 pt-5">
          <h2 className="text-sm font-bold">Detalhes da transação</h2>
          <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-x-6 border-b border-primary/30 pb-2 text-sm text-muted-foreground">
            <span>NFTs</span>
            <span className="w-16 text-center">Edições</span>
            <span className="w-24 text-right">Subtotal</span>
          </div>
          <ul className="mt-4 flex flex-col gap-3" aria-label="Itens comprados">
            {r.items.map((l) => (
              <li key={`${l.nftId}-${l.editionId}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6">
                <div className="flex min-w-0 items-center gap-3">
                  <img src={l.image} alt="" className="size-[66px] shrink-0 rounded-md object-cover" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{l.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Edição {l.editionLabel} · {l.quantity} × {formatEth(l.unitPriceEth)}
                    </p>
                  </div>
                </div>
                <span aria-hidden className="w-16 text-center text-xs text-muted-foreground">(x {l.quantity})</span>
                <p className="w-24 text-right text-sm font-bold text-primary">{formatEth(l.lineTotalEth)}</p>
              </li>
            ))}
          </ul>

          <dl className="mt-5 space-y-1.5 border-b border-primary/30 pb-3 text-sm">
            <Line label="Subtotal" value={formatEth(r.subtotalEth)} />
            {r.coupon && r.discountEth !== '0' && <Line label={`Desconto (${r.coupon.code})`} value={`− ${formatEth(r.discountEth)}`} />}
            <Line label="Taxa de rede" value={formatEth(r.networkFeeEth)} />
            <Line label="Total" value={formatEth(r.totalEth)} strong />
          </dl>

          <dl className="mt-4 grid gap-x-6 gap-y-2 text-xs text-muted-foreground sm:grid-cols-2">
            <Meta bare label="Pedido" value={order.id} />
            {order.collector && <Meta bare label="Colecionador" value={`${order.collector.displayName} (@${order.collector.username})`} />}
            {order.collector && <Meta bare label="Entrega dos NFTs" value={shortHash(order.collector.walletAddress)} />}
          </dl>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            {confirmed
              ? 'Transação confirmada na rede simulada. Os valores ficaram registrados no momento da compra e não mudam se o catálogo mudar.'
              : 'Os valores acima ficaram registrados no momento da compra e não mudam se o catálogo mudar.'}
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {order.status === 'declined' && (
              <Link to="/cart" className="inline-flex h-10 items-center rounded-sm bg-primary px-5 text-sm font-bold text-primary-foreground">
                Voltar ao carrinho
              </Link>
            )}
            {confirmed && order.txHash && (
              // The hash is simulated: there is no real transaction to open, so this says so instead of linking out
              <button
                type="button"
                aria-disabled="true"
                onClick={() => toast.info('Esta transação é simulada e não existe na Ethereum real.')}
                className="inline-flex h-10 items-center rounded-sm bg-primary px-5 text-sm font-bold text-primary-foreground"
              >
                Ver no Etherscan
              </button>
            )}
            <Link to="/" className="inline-flex h-10 items-center rounded-sm border border-primary/40 px-5 text-sm font-medium">
              Continuar explorando
            </Link>
          </div>
        </div>
      </section>
      <div aria-hidden className="h-2.5 bg-primary" />
    </div>
  );
}

function ThankYou() {
  return (
    <svg aria-hidden viewBox="0 0 64 64" className="mx-auto size-16 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
      <path d="M6 28 32 8l26 20v24a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3z" />
      <path d="M6 28l26 18 26-18" />
      <rect x="18" y="12" width="28" height="22" rx="2" fill="#241612" />
      <text x="32" y="22" textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor" stroke="none">THANK</text>
      <text x="32" y="30" textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor" stroke="none">YOU</text>
    </svg>
  );
}

function Meta({ label, value, mono, bare, title }: { label: string; value: string; mono?: boolean; bare?: boolean; title?: string }) {
  return (
    <div className={`min-w-0 ${bare ? 'flex gap-2' : ''}`}>
      <dt className={bare ? '' : 'text-muted-foreground'}>{label}{bare ? ':' : ''}</dt>
      <dd className={`${bare ? 'break-words text-foreground' : 'truncate font-medium'} ${mono ? 'font-mono text-xs' : ''}`} title={title ?? value}>{value}</dd>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-end gap-8 ${strong ? 'text-base font-bold' : ''}`}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`w-28 text-right ${strong ? 'text-primary' : ''}`}>{value}</dd>
    </div>
  );
}

function OrderSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[580px] py-8" aria-busy="true" aria-label="Carregando pedido">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="mt-8 h-80 w-full" />
    </div>
  );
}
