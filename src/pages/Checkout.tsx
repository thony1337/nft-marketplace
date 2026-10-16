import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useRouter } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';
import { createOrderRequest } from '../api/orders';
import { toApiError } from '../api/errors';
import { Breadcrumb } from '../components/Breadcrumb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { NETWORK_LABELS } from '@/lib/catalog';
import { formatEth } from '@/lib/eth';
import { attemptFor, clearAttempt, loadAttempt, type CheckoutAttempt } from '@/lib/checkoutAttempt';
import { collectorSchema, fieldErrorsFrom } from '@/lib/schemas';
import { useAuth } from '../context/AuthContext';
import { useQuote } from '../hooks/useQuote';
import { useWalletConnection } from '../hooks/useWalletConnection';
import { useWallets } from '../hooks/useWallets';
import type { CollectorData, User, Wallet } from '../types';

// The creation reply is the first picture of the order, never a newer one than what the live channel
// may already have told the page (an update can arrive before the reply is processed).
function seedOrder(queryClient: QueryClient, key: readonly unknown[], created: { version: number }) {
  queryClient.setQueryData(key, (old: { version: number } | undefined) => (old && old.version >= created.version ? old : created));
  void queryClient.invalidateQueries({ queryKey: key, exact: true }); // and the page reads the truth right away
}

const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

// ---- collector form ---------------------------------------------------------------------------
// What the user typed. Whatever they did not touch comes from the account and the chosen wallet,
// so a returning collector can confirm without typing anything.

type Typed = Partial<Record<
  'displayName' | 'username' | 'profileName' | 'email' | 'secondaryWallet' | 'ensName' | 'referralCode' | 'note'
  | 'otherAddress' | 'otherNetwork' | 'otherType',
  string
>> & { useOther?: boolean };

const slug = (text: string) =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
const suggestUsername = (user: User) => {
  const fromName = slug(user.name);
  return fromName.length >= 3 ? fromName : slug(user.email.split('@')[0] ?? '').padEnd(3, '0');
};
const networkOf = (wallet: Wallet | undefined): 'ethereum' | 'polygon' =>
  wallet?.network.toLowerCase().includes('polygon') ? 'polygon' : 'ethereum';
const typeOf = (wallet: Wallet | undefined): CollectorData['walletType'] => {
  const name = wallet?.name.toLowerCase() ?? '';
  return name.includes('metamask') ? 'metamask' : name.includes('coinbase') ? 'coinbase' : name.includes('walletconnect') ? 'walletconnect' : 'other';
};

function collectorFrom(user: User, wallet: Wallet | undefined, typed: Typed): Record<string, string | undefined> {
  const other = Boolean(typed.useOther);
  const value = (v: string | undefined) => (v && v.trim() !== '' ? v : undefined);
  return {
    displayName: typed.displayName ?? user.name,
    username: typed.username ?? suggestUsername(user),
    profileName: typed.profileName ?? user.name,
    email: typed.email ?? user.email,
    network: other ? (typed.otherNetwork ?? '') : networkOf(wallet),
    walletAddress: other ? (typed.otherAddress ?? '') : (wallet?.address ?? ''),
    walletType: other ? (typed.otherType ?? '') : typeOf(wallet),
    secondaryWallet: value(typed.secondaryWallet),
    ensName: value(typed.ensName),
    referralCode: value(typed.referralCode),
    note: value(typed.note),
  };
}

const inputClass = 'h-10 rounded-none border-primary/40 bg-transparent text-sm placeholder:text-muted-foreground/70';
const selectClass =
  'h-10 w-full border border-primary/40 bg-background px-3 text-sm disabled:opacity-60 aria-[invalid=true]:border-destructive';

function Field({ id, label, required, error, children }: { id: string; label: string; required?: boolean; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm">
        {label}
        {required && <span aria-hidden className="ml-0.5 text-primary">*</span>}
      </label>
      {children}
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
const describe = (id: string, error?: string) => ({
  id,
  'aria-invalid': Boolean(error) || undefined,
  'aria-describedby': error ? `${id}-error` : undefined,
});

type Notice = { kind: 'changed' | 'stock' | 'unsure' | 'error'; message: string };

export function CheckoutPage() {
  const { status, token, openLogin } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const quote = useQuote();
  const wallets = useWallets();
  const connection = useWalletConnection();

  const [walletId, setWalletId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [typed, setTyped] = useState<Typed>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const { user } = useAuth();
  const sending = useRef(false); // closes the door between the click and React's re-render

  // A purchase that was sent but never confirmed (timeout, refresh): the same content reuses its key
  const unfinished = token ? loadAttempt(token) : null;
  const list = wallets.data ?? [];
  // The wallet of an unfinished purchase comes first (it must be sent again with the same content)
  const chosenId = walletId ?? unfinished?.walletId;
  const selected: Wallet | undefined =
    list.find((w) => w.id === chosenId) ?? list.find((w) => w.isPrimary) ?? list[0];

  const order = useMutation({
    mutationFn: ({ key, fingerprint, wallet, collector }: { key: string; fingerprint: string; wallet: string; collector: CollectorData }) =>
      createOrderRequest(key, { walletId: wallet, quoteFingerprint: fingerprint, collector }),
  });

  if (status === 'loading') return <CheckoutSkeleton />;

  if (status !== 'authenticated') {
    return (
      <div className="py-24 text-center">
        <h1 className="text-2xl font-bold">Entre para finalizar a compra</h1>
        <p className="mt-2 text-sm text-muted-foreground">Seu carrinho continua guardado.</p>
        <Button className="mt-6" onClick={openLogin}>Entrar</Button>
      </div>
    );
  }

  if ((quote.isPending && quote.fetchStatus !== 'idle') || wallets.isPending) return <CheckoutSkeleton />;

  if (quote.isError || wallets.isError) {
    return (
      <div role="alert" className="py-24 text-center">
        <h1 className="text-2xl font-bold">Não foi possível carregar o checkout</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {toApiError(quote.error ?? wallets.error).message}
        </p>
        <Button
          className="mt-6"
          onClick={() => {
            void quote.refetch();
            void wallets.refetch();
          }}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  const data = quote.data;
  if (!data || data.items.length === 0) {
    // The cart can be empty because the purchase we could not confirm actually went through (the
    // payment finished and used the cart up). Then the way forward is to recover that order.
    if (unfinished && token) {
      return <RecoverPurchase attempt={unfinished} onRecovered={(id) => navigate({ to: '/orders/$id', params: { id } })} />;
    }
    return (
      <div className="py-24 text-center">
        <h1 className="text-2xl font-bold">Seu carrinho está vazio</h1>
        <Link to="/" className="mt-6 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
          Explorar o catálogo
        </Link>
      </div>
    );
  }

  const refreshing = quote.isFetching;
  const canSubmit = data.canCheckout && Boolean(selected?.connected) && !refreshing && !order.isPending;

  const send = (collector: CollectorData) => {
    if (sending.current || !canSubmit || !selected || !token) return;
    sending.current = true;
    setNotice(null);
    setWalletError(null);
    const attempt = attemptFor(token, selected.id, data.fingerprint, collector);
    order.mutate(
      { key: attempt.key, fingerprint: data.fingerprint, wallet: selected.id, collector },
      {
        onSuccess: ({ order: created }) => {
          clearAttempt();
          seedOrder(queryClient, ['order', token, created.id], created);
          void queryClient.invalidateQueries({ queryKey: ['orders'] });
          void navigate({ to: '/orders/$id', params: { id: created.id } });
        },
        onError: (error) => {
          const e = toApiError(error);
          if (e.code === 'QUOTE_CHANGED' || e.code === 'OUT_OF_STOCK') {
            // Definitive answer: nothing was created. The user must look at the new numbers and confirm again.
            clearAttempt();
            void queryClient.invalidateQueries({ queryKey: ['quote'] });
            void queryClient.invalidateQueries({ queryKey: ['cart'] });
            setNotice({ kind: e.code === 'QUOTE_CHANGED' ? 'changed' : 'stock', message: e.message });
          } else if (e.code === 'WALLET_NOT_CONNECTED') {
            clearAttempt();
            void queryClient.invalidateQueries({ queryKey: ['wallets'] });
            setWalletError(e.message);
          } else if (e.status === 422 && e.fieldErrors?.walletId) {
            clearAttempt();
            setWalletError(e.fieldErrors.walletId);
          } else if (e.status === 422 && e.fieldErrors) {
            // the server found a problem in the collector's data: show it on the field
            clearAttempt();
            setErrors(e.fieldErrors);
            focusFirstError();
          } else if (e.isNetworkError || e.isTimeout || e.status >= 500) {
            // We do not know if the order was created. The key is kept: trying again recovers it.
            setNotice({
              kind: 'unsure',
              message: 'Não conseguimos confirmar se o pedido foi criado. Tentar de novo é seguro: não duplica a compra.',
            });
          } else if (!e.isSessionProblem) {
            clearAttempt();
            setNotice({ kind: 'error', message: e.message });
          }
        },
        onSettled: () => {
          sending.current = false;
        },
      },
    );
  };

  const focusFirstError = () =>
    setTimeout(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);

  // The button and the Enter key both come here: check the fields first, then send
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!user || sending.current || !canSubmit) return;
    const parsed = collectorSchema.safeParse(collectorFrom(user, selected, typed));
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      focusFirstError();
      return;
    }
    setErrors({});
    send(parsed.data);
  };

  const type = (patch: Typed) => {
    setTyped((t) => ({ ...t, ...patch }));
    setErrors({});
  };
  const shown = user ? collectorFrom(user, selected, typed) : {};
  const locked = !typed.useOther; // wallet fields follow the chosen wallet until the user asks for another one

  const hasUnfinished = Boolean(unfinished) || notice?.kind === 'unsure';

  return (
    <div className="pb-4">
      <div className="max-md:hidden">
        <Breadcrumb trail={['Mercado', 'Pagamento']} />
      </div>
      <h1 className="sr-only">Finalizar compra</h1>
      {/* Phones: back button and the design's title */}
      <div className="relative py-5 md:hidden">
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => router.history.back()}
          className="absolute left-0 top-4 grid size-10 place-items-center rounded-full bg-card text-primary"
        >
          <ChevronLeft aria-hidden className="size-5" />
        </button>
        <p aria-hidden className="text-center text-lg font-bold">Pagamento com carteira</p>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_405px] max-md:mt-0">
        <form ref={formRef} id="collector-form" onSubmit={onSubmit} noValidate aria-label="Perfil do colecionador">
          <h2 className="text-lg font-bold">Perfil do colecionador</h2>

          <div className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2">
            <Field id="c-display" label="Nome de exibição" required error={errors.displayName}>
              <Input {...describe('c-display', errors.displayName)} className={inputClass} aria-required="true" autoComplete="name"
                value={shown.displayName ?? ''} onChange={(e) => type({ displayName: e.target.value })} />
            </Field>
            <Field id="c-username" label="Nome de usuário" required error={errors.username}>
              <Input {...describe('c-username', errors.username)} className={inputClass} aria-required="true" autoComplete="username"
                value={shown.username ?? ''} onChange={(e) => type({ username: e.target.value })} />
            </Field>

            <Field id="c-network" label="Rede" required error={errors.network}>
              <select {...describe('c-network', errors.network)} className={selectClass} aria-required="true" disabled={locked}
                value={shown.network ?? ''} onChange={(e) => type({ otherNetwork: e.target.value })}>
                <option value="">Selecione uma rede</option>
                <option value="ethereum">Ethereum</option>
                <option value="polygon">Polygon</option>
              </select>
            </Field>
            <Field id="c-profile" label="Nome do perfil" required error={errors.profileName}>
              <Input {...describe('c-profile', errors.profileName)} className={inputClass} aria-required="true"
                value={shown.profileName ?? ''} onChange={(e) => type({ profileName: e.target.value })} />
            </Field>

            <Field id="c-address" label="Endereço da carteira" required error={errors.walletAddress}>
              <Input {...describe('c-address', errors.walletAddress)} className={inputClass} aria-required="true" readOnly={locked}
                autoComplete="off" spellCheck={false} placeholder="Endereço 0x da carteira"
                value={shown.walletAddress ?? ''} onChange={(e) => type({ otherAddress: e.target.value })} />
            </Field>
            <Field id="c-secondary" label="ENS ou carteira secundária (opcional)" error={errors.secondaryWallet}>
              <Input {...describe('c-secondary', errors.secondaryWallet)} className={inputClass} autoComplete="off" spellCheck={false}
                placeholder="ENS ou carteira secundária (opcional)"
                value={typed.secondaryWallet ?? ''} onChange={(e) => type({ secondaryWallet: e.target.value })} />
            </Field>

            <Field id="c-type" label="Tipo de carteira" required error={errors.walletType}>
              <select {...describe('c-type', errors.walletType)} className={selectClass} aria-required="true" disabled={locked}
                value={shown.walletType ?? ''} onChange={(e) => type({ otherType: e.target.value })}>
                <option value="">Selecione uma carteira</option>
                <option value="metamask">MetaMask</option>
                <option value="coinbase">Coinbase Wallet</option>
                <option value="walletconnect">WalletConnect</option>
                <option value="other">Outra</option>
              </select>
            </Field>
            <Field id="c-referral" label="Código de indicação (opcional)" error={errors.referralCode}>
              <Input {...describe('c-referral', errors.referralCode)} className={inputClass} autoComplete="off"
                value={typed.referralCode ?? ''} onChange={(e) => type({ referralCode: e.target.value })} />
            </Field>

            <Field id="c-email" label="E-mail" required error={errors.email}>
              <Input {...describe('c-email', errors.email)} className={inputClass} type="email" aria-required="true" autoComplete="email"
                value={shown.email ?? ''} onChange={(e) => type({ email: e.target.value })} />
            </Field>
            <Field id="c-ens" label="Nome ENS (opcional)" error={errors.ensName}>
              <div className="flex">
                <Input {...describe('c-ens', errors.ensName)} className={`${inputClass} flex-1`} autoComplete="off" spellCheck={false}
                  value={typed.ensName ?? ''} onChange={(e) => type({ ensName: e.target.value })} />
                <span className="grid h-10 place-items-center border border-l-0 border-primary/40 px-3 text-sm">.eth</span>
              </div>
            </Field>
          </div>

          <label className="mt-6 flex w-fit cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={Boolean(typed.useOther)}
              onChange={(e) => type({ useOther: e.target.checked })}
            />
            Usar outra carteira?
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            {locked
              ? 'Os NFTs serão enviados para a carteira escolhida ao lado.'
              : 'Informe a carteira que vai receber os NFTs. O pagamento continua saindo da carteira escolhida ao lado.'}
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <label htmlFor="c-note" className="text-sm">Observação do colecionador (opcional)</label>
            <textarea
              {...describe('c-note', errors.note)}
              rows={7}
              maxLength={200}
              value={typed.note ?? ''}
              onChange={(e) => type({ note: e.target.value })}
              className="w-full max-w-[350px] border border-primary/40 bg-transparent p-3 text-sm aria-[invalid=true]:border-destructive"
            />
            {errors.note && <p id="c-note-error" role="alert" className="text-xs text-destructive">{errors.note}</p>}
          </div>
        </form>

        <aside aria-label="Resumo do pedido" className="h-fit">
          <h2 className="text-lg font-bold">Seus NFTs</h2>
          <div aria-hidden="true" className="mt-3 flex justify-between font-bold">
            <span>NFTs</span>
            <span>Subtotal</span>
          </div>

          <ul aria-label="Itens do pedido" className="mt-3 flex flex-col gap-3">
            {data.items.map((line) => (
              <li key={line.id} className="flex items-center gap-3 bg-card pr-3">
                <img src={line.nft.image} alt="" className="size-[70px] shrink-0 object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{line.nft.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Edição {line.edition.label} · {NETWORK_LABELS[line.nft.network]}
                  </p>
                  {!line.available && (
                    <p role="alert" className="text-xs text-destructive">Estoque insuficiente para esta quantidade.</p>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">(x {line.quantity})</span>
                <p className="font-bold text-primary">{formatEth(line.lineTotalEth)}</p>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-center text-sm">
            Tem um código promocional?{' '}
            <Link to="/cart" className="text-primary hover:underline">Aplique aqui</Link>
          </p>

          {notice && (
            <p
              role="alert"
              className={`mt-3 rounded-md border p-3 text-sm ${notice.kind === 'unsure' ? 'border-primary/50' : 'border-destructive/50 text-destructive'}`}
            >
              {notice.kind === 'changed' && 'Os valores mudaram. Revise o resumo abaixo e confirme novamente. '}
              {notice.kind === 'stock' && 'Um item ficou sem estoque. '}
              {notice.message}
            </p>
          )}
          {!notice && unfinished && (
            <p className="mt-3 rounded-md border border-primary/50 p-3 text-sm">
              Há uma compra enviada que não chegou a ser confirmada. Reenviar recupera esse pedido, sem duplicar.
            </p>
          )}
          {data.couponIssue && (
            <p role="alert" className="mt-3 rounded-md border border-destructive/50 p-3 text-sm text-destructive">
              {data.couponIssue.message} O desconto não foi aplicado.
            </p>
          )}

          <dl className="mt-3 space-y-2" aria-busy={refreshing}>
            <Row label="Subtotal" value={formatEth(data.subtotalEth)} dim={refreshing} />
            <Row
              label={data.coupon ? `Desconto (${data.coupon.code})` : 'Desconto do lançamento'}
              value={data.coupon && data.discountEth !== '0' ? `(-) ${formatEth(data.discountEth)}` : '(-) 0'}
              dim={refreshing}
            />
            <Row label="Taxa de rede" value={formatEth(data.networkFeeEth)} dim={refreshing} note="Taxa estimada" />
            <div className="border-t border-primary/30 pt-3">
              <Row label="Total" value={formatEth(data.totalEth)} dim={refreshing} strong />
            </div>
          </dl>

          {!data.canCheckout && !refreshing && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              Há itens indisponíveis. <Link to="/cart" className="underline">Ajuste o carrinho</Link> para continuar.
            </p>
          )}

          <fieldset className="mt-5" aria-describedby={walletError ? 'wallet-error' : undefined}>
            <legend className="mx-auto font-bold">Carteira e rede</legend>
            {list.length === 0 ? (
              <p className="mt-3 border border-primary/30 p-4 text-sm">
                Você ainda não tem uma carteira cadastrada.{' '}
                <Link to="/profile" className="text-primary underline">Cadastrar carteira</Link>
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-3">
                {list.map((w) => (
                  <label
                    key={w.id}
                    className="flex min-h-12 cursor-pointer items-center gap-3 border border-primary/40 px-3 py-2 has-[:checked]:border-foreground"
                  >
                    <input
                      type="radio" name="wallet" className="size-4 accent-primary"
                      checked={selected?.id === w.id} disabled={order.isPending}
                      onChange={() => { setWalletId(w.id); setWalletError(null); setConnectionError(null); setErrors({}); }}
                    />
                    <span className="min-w-0">
                      <span className="block truncate">
                        {w.name}{w.isPrimary ? ' · principal' : ''}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {shortAddress(w.address)} · {w.network}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            {selected && (
              <div className="mt-3 flex items-center justify-between gap-3 border border-primary/30 p-3">
                <p role="status" className="min-w-0 text-sm">
                  {connection.connect.isPending
                    ? 'Conectando à carteira…'
                    : selected.connected
                      ? `Carteira conectada · ${shortAddress(selected.address)}`
                      : 'Carteira desconectada'}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={connection.pending || order.isPending}
                  onClick={() => {
                    setConnectionError(null);
                    setWalletError(null);
                    const action = selected.connected ? connection.disconnect : connection.connect;
                    action.mutate(selected.id, { onError: (error) => setConnectionError(toApiError(error).message) });
                  }}
                >
                  {selected.connected ? 'Desconectar' : 'Conectar carteira'}
                </Button>
              </div>
            )}
            {connectionError && <p role="alert" className="mt-2 text-sm text-destructive">{connectionError}</p>}
            {walletError && <p id="wallet-error" role="alert" className="mt-2 text-sm text-destructive">{walletError}</p>}
          </fieldset>

          <Button type="submit" form="collector-form" className="mt-5 h-11 w-full rounded font-bold max-md:h-14 max-md:rounded-full max-md:bg-gradient-to-br max-md:from-[#d28a4c] max-md:to-[#a8693a]" disabled={!canSubmit}>
            {order.isPending ? 'Processando…' : hasUnfinished ? 'Tentar novamente' : 'Confirmar compra'}
          </Button>
          {selected && !selected.connected && (
            <p className="mt-3 text-xs text-muted-foreground">Conecte a carteira escolhida para confirmar a compra.</p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Ambiente de demonstração: nenhum valor real é cobrado.
          </p>
        </aside>
      </div>
    </div>
  );
}

export default CheckoutPage;

// Sends the stored attempt again, exactly as it was (same key, same content): the server answers
// with the order it already has instead of creating a second one.
function RecoverPurchase({ attempt, onRecovered }: { attempt: CheckoutAttempt; onRecovered: (orderId: string) => void }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const recover = useMutation({
    mutationFn: () => createOrderRequest(attempt.key, { walletId: attempt.walletId, quoteFingerprint: attempt.fingerprint, collector: attempt.collector }),
    onSuccess: ({ order }) => {
      clearAttempt();
      seedOrder(queryClient, ['order', attempt.token, order.id], order);
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      onRecovered(order.id);
    },
    onError: (error) => {
      const e = toApiError(error);
      if (e.isNetworkError || e.isTimeout || e.status >= 500) {
        setMessage('Ainda não conseguimos confirmar. Tentar de novo é seguro: não duplica a compra.');
      } else {
        // the server never heard of this purchase: there is nothing to recover
        clearAttempt();
        setMessage('Não encontramos essa compra. Seu carrinho está vazio.');
      }
    },
  });

  return (
    <div className="py-24 text-center">
      <h1 className="text-2xl font-bold">Sua compra pode ter sido concluída</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Enviamos o pedido, mas a resposta não chegou. Seu carrinho foi usado, então ele provavelmente foi criado.
      </p>
      {message && <p role="alert" className="mt-4 text-sm text-destructive">{message}</p>}
      <Button className="mt-6" disabled={recover.isPending} onClick={() => recover.mutate()}>
        {recover.isPending ? 'Verificando…' : 'Ver meu pedido'}
      </Button>
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

function CheckoutSkeleton() {
  return (
    <div className="pb-4" aria-busy="true" aria-label="Carregando checkout">
      <Skeleton className="mt-6 h-5 w-56" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_405px]">
        <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-[70px] w-full" />
          <Skeleton className="h-[70px] w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </div>
  );
}
