import { useRef, useState, type ComponentProps, type FormEvent, type ReactNode } from 'react';
import { Bell, Download, Eye, EyeOff, Heart, ImageIcon, LogOut, MapPin, ShoppingCart, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { toApiError } from '../api/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AVATAR_MAX_BYTES, AVATAR_TYPES, MAX_WALLETS } from '@/lib/limits';
import { fieldErrorsFrom, passwordChangeSchema, profileSchema, walletSchema } from '@/lib/schemas';
import { useAuth } from '../context/AuthContext';
import {
  useChangePassword, useCreateWallet, useDeleteWallet, useRemoveAvatar,
  useUpdateProfile, useUpdateWallet, useUploadAvatar,
} from '../hooks/useProfile';
import { useWallets } from '../hooks/useWallets';
import type { User, Wallet } from '../types';

type Errors = Record<string, string>;
type View = 'profile' | 'wallets';

const inputClass = 'h-10 w-full rounded-sm border border-primary/40 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/70 disabled:opacity-60';
const primaryButton = 'rounded-sm bg-primary px-5 font-bold text-primary-foreground hover:bg-primary/90';

const viewFromHash = (): View => (typeof window !== 'undefined' && window.location.hash === '#carteiras' ? 'wallets' : 'profile');

export function ProfilePage() {
  const { status, user, openLogin } = useAuth();
  const [view, setViewState] = useState<View>(viewFromHash);
  const setView = (next: View) => {
    setViewState(next);
    window.history.replaceState(null, '', next === 'wallets' ? '#carteiras' : window.location.pathname + window.location.search);
  };

  if (status === 'loading') return <ProfileSkeleton />;
  if (status !== 'authenticated' || !user) {
    return (
      <div className="py-24 text-center">
        <h1 className="text-2xl font-bold">Entre para ver seu perfil</h1>
        <Button className="mt-6" onClick={openLogin}>Entrar</Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 py-8 lg:grid-cols-[310px_1fr] lg:gap-7">
      <h1 className="sr-only">Meu perfil</h1>
      <SideNav view={view} onView={setView} />
      <div className="min-w-0">{view === 'profile' ? <ProfileForm user={user} /> : <WalletsView />}</div>
    </div>
  );
}

export default ProfilePage;

// ---- side navigation ---------------------------------------------------------------------------

// Only "Dados do perfil" and "Carteiras" exist. The rest is in the design, so it is shown, but
// plainly unavailable instead of pretending to work.
const SOON = [
  { label: 'Atividade', Icon: ShoppingCart },
  { label: 'Lista de interesse', Icon: Heart },
  { label: 'Ofertas', Icon: Bell },
  { label: 'Arquivos baixados', Icon: Download },
  { label: 'Suporte', Icon: Bell },
];

function SideNav({ view, onView }: { view: View; onView: (v: View) => void }) {
  const { logout } = useAuth();
  const item = 'flex h-11 w-full items-center gap-3 border-l-4 px-4 text-left text-sm';
  const live = (active: boolean) => `${item} ${active ? 'border-primary bg-primary/15 text-primary' : 'border-transparent text-primary hover:bg-primary/10'}`;
  return (
    <nav aria-label="Seção do perfil" className="self-start bg-card text-primary">
      <p aria-hidden className="px-4 pb-2 pt-3 text-base font-bold text-foreground">Meu perfil</p>
      <ul>
        <li>
          <button type="button" className={live(view === 'profile')} aria-current={view === 'profile' ? 'page' : undefined} onClick={() => onView('profile')}>
            <UserIcon className="size-4" aria-hidden /> Dados do perfil
          </button>
        </li>
        <li>
          <button type="button" className={live(view === 'wallets')} aria-current={view === 'wallets' ? 'page' : undefined} onClick={() => onView('wallets')}>
            <MapPin className="size-4" aria-hidden /> Carteiras
          </button>
        </li>
        {SOON.map(({ label, Icon }) => (
          <li key={label}>
            <span aria-disabled="true" className={`${item} cursor-not-allowed border-transparent opacity-70`}>
              <Icon className="size-4" aria-hidden /> {label}
              <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">Em breve</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="border-t border-primary/30">
        <button type="button" className={`${item} border-transparent font-bold hover:bg-primary/10`} onClick={() => void logout()}>
          <LogOut className="size-4" aria-hidden /> Sair
        </button>
      </div>
    </nav>
  );
}

function Field({ label, error, children, htmlFor, required }: { label: string; error?: string; children: ReactNode; htmlFor: string; required?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-0.5">
        <Label htmlFor={htmlFor} className="text-sm font-normal">{label}</Label>
        {required && <span aria-hidden className="text-sm text-destructive">*</span>}
      </div>
      {children}
      {error && <p id={`${htmlFor}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

const fieldProps = (id: string, error?: string) => ({
  id,
  'aria-invalid': Boolean(error),
  'aria-describedby': error ? `${id}-error` : undefined,
});

// What the server said about each field, or one message when it was not about a field
function showServerError(error: unknown, setErrors: (e: Errors) => void, fallback: string) {
  const e = toApiError(error);
  if (e.isSessionProblem) return; // the auth layer already told the user
  if (e.fieldErrors && Object.keys(e.fieldErrors).length > 0) setErrors(e.fieldErrors);
  else toast.error(e.message || fallback);
}

const slug = (text: string) =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);

function PasswordInput({ id, error, ...rest }: { id: string; error?: string } & Omit<ComponentProps<'input'>, 'id' | 'type'>) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Input {...fieldProps(id, error)} {...rest} type={shown ? 'text' : 'password'} className={`${inputClass} pr-10`} />
      <button
        type="button" aria-label={shown ? 'Ocultar texto' : 'Mostrar texto'} aria-pressed={shown}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-primary" onClick={() => setShown((v) => !v)}
      >
        {shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}

// ---- profile: name, avatar and password in one form ---------------------------------------------

function ProfileForm({ user }: { user: User }) {
  const wallets = useWallets();
  const update = useUpdateProfile();
  const change = useChangePassword();
  const [name, setName] = useState(user.name);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState<Errors>({});
  const setPw = (key: keyof typeof passwords) => (e: { target: { value: string } }) => setPasswords((v) => ({ ...v, [key]: e.target.value }));
  const primary = wallets.data?.find((w) => w.isPrimary) ?? wallets.data?.[0];
  const nameChanged = name.trim() !== user.name;
  const passwordTouched = Boolean(passwords.currentPassword || passwords.newPassword || passwords.confirm);
  const busy = update.isPending || change.isPending;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || (!nameChanged && !passwordTouched)) return;
    const found: Errors = {};
    let nameData: { name: string } | null = null;
    let passwordData: { currentPassword: string; newPassword: string } | null = null;

    if (nameChanged) {
      const parsed = profileSchema.safeParse({ name });
      if (parsed.success) nameData = parsed.data;
      else Object.assign(found, fieldErrorsFrom(parsed.error));
    }
    if (passwordTouched) {
      const parsed = passwordChangeSchema.safeParse({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword });
      if (parsed.success) passwordData = parsed.data;
      else Object.assign(found, fieldErrorsFrom(parsed.error));
      if (!found.newPassword && passwords.newPassword !== passwords.confirm) {
        found.confirm = 'As senhas não conferem';
        passwordData = null;
      }
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    if (nameData) {
      try {
        const saved = await update.mutateAsync(nameData);
        setName(saved.name);
        toast.success('Nome atualizado.');
      } catch (e) {
        showServerError(e, setErrors, 'Não foi possível salvar.');
        return;
      }
    }
    if (passwordData) {
      try {
        await change.mutateAsync(passwordData);
        setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
        toast.success('Senha alterada. Os outros dispositivos foram desconectados.');
      } catch (e) {
        showServerError(e, setErrors, 'Não foi possível alterar a senha.');
      }
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} noValidate aria-label="Dados do perfil">
      <h2 className="text-base font-bold">Perfil do colecionador</h2>
      <div className="mt-6 grid gap-x-7 gap-y-5 md:grid-cols-2">
        <div className="flex flex-col gap-5">
          <Field label="Nome de exibição" htmlFor="profile-name" required error={errors.name}>
            <Input {...fieldProps('profile-name', errors.name)} className={inputClass} value={name} disabled={busy} autoComplete="name" onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="E-mail" htmlFor="profile-email" required>
            <Input id="profile-email" className={inputClass} value={user.email} readOnly aria-readonly="true" />
          </Field>
          <Field label="Apelido da carteira" htmlFor="profile-wallet" required>
            <Input id="profile-wallet" className={inputClass} value={primary?.name ?? ''} readOnly aria-readonly="true" placeholder="Cadastre uma carteira em Carteiras" />
          </Field>
        </div>
        <div className="flex flex-col gap-5">
          <Field label="Nome de usuário" htmlFor="profile-username" required>
            <Input id="profile-username" className={inputClass} value={slug(user.name) || slug(user.email.split('@')[0] ?? '')} readOnly aria-readonly="true" />
          </Field>
          <Field label="Nome ENS" htmlFor="profile-ens">
            <div className="flex gap-2">
              <select aria-label="Domínio ENS" disabled className="h-10 w-24 shrink-0 rounded-sm border border-primary/40 bg-background px-3 text-sm opacity-60"><option>.eth</option></select>
              <Input id="profile-ens" className={`${inputClass} min-w-0 flex-1`} disabled placeholder="Em breve" />
            </div>
          </Field>
          <AvatarField user={user} />
        </div>
      </div>

      <h2 className="mt-10 text-base font-bold">Alterar senha</h2>
      <div className="mt-5 flex max-w-[calc(50%-14px)] flex-col gap-5 max-md:max-w-none">
        <Field label="Senha atual" htmlFor="pw-current" error={errors.currentPassword}>
          <PasswordInput id="pw-current" error={errors.currentPassword} autoComplete="current-password" value={passwords.currentPassword} disabled={busy} onChange={setPw('currentPassword')} />
        </Field>
        <Field label="Nova senha" htmlFor="pw-new" error={errors.newPassword}>
          <PasswordInput id="pw-new" error={errors.newPassword} autoComplete="new-password" value={passwords.newPassword} disabled={busy} onChange={setPw('newPassword')} />
        </Field>
        <Field label="Confirmar nova senha" htmlFor="pw-confirm" error={errors.confirm}>
          <PasswordInput id="pw-confirm" error={errors.confirm} autoComplete="new-password" value={passwords.confirm} disabled={busy} onChange={setPw('confirm')} />
        </Field>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">Ao trocar a senha, você continua conectado aqui e é desconectado dos outros dispositivos.</p>

      <Button type="submit" className={`${primaryButton} mt-8 h-10`} disabled={busy || (!nameChanged && !passwordTouched)}>
        {busy ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  );
}

function AvatarField({ user }: { user: User }) {
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = upload.isPending || remove.isPending;

  const choose = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    // Checked here first so the user hears about it at once; the server checks again
    if (!AVATAR_TYPES.includes(file.type)) return setError('Use uma imagem PNG, JPG ou WebP.');
    if (file.size > AVATAR_MAX_BYTES) return setError(`A imagem deve ter até ${AVATAR_MAX_BYTES / 1024} KB.`);
    upload.mutate(file, {
      onSuccess: () => toast.success('Foto atualizada.'),
      onError: (e) => {
        const err = toApiError(e);
        if (!err.isSessionProblem) setError(err.fieldErrors?.avatar ?? err.message);
      },
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm">Avatar</span>
      <div className="flex items-center gap-5">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt={`Foto de ${user.name}`} className="size-[50px] rounded-full object-cover" />
        ) : (
          <span aria-hidden className="flex size-[50px] items-center justify-center rounded-full border border-primary/30 bg-card text-primary">
            <ImageIcon className="size-5" />
          </span>
        )}
        <input
          ref={input} type="file" accept={AVATAR_TYPES.join(',')} className="sr-only" tabIndex={-1}
          aria-label="Escolher foto" onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ''; }}
        />
        <Button type="button" className={`${primaryButton} h-10`} disabled={busy} aria-label={user.avatarUrl ? 'Trocar foto' : 'Enviar foto'} onClick={() => input.current?.click()}>
          {upload.isPending ? 'Enviando…' : 'Alterar'}
        </Button>
        <Button
          type="button" variant="ghost" disabled={busy || !user.avatarUrl} aria-label="Remover foto" className="px-2"
          onClick={() => remove.mutate(undefined, { onSuccess: () => toast.success('Foto removida.'), onError: (e) => showServerError(e, () => undefined, 'Não foi possível remover.') })}
        >
          Remover
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">PNG, JPG ou WebP, até 150 KB.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

// ---- wallets ----------------------------------------------------------------------------------

const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function WalletsView() {
  const wallets = useWallets();
  const list = wallets.data ?? [];
  const primary = list.filter((w) => w.isPrimary);
  const others = list.filter((w) => !w.isPrimary);
  const full = list.length >= MAX_WALLETS;
  const addRef = useRef<HTMLDivElement>(null);
  const focusAdd = () => {
    addRef.current?.scrollIntoView({ block: 'start' });
    addRef.current?.querySelector<HTMLInputElement>('input')?.focus();
  };

  return (
    <section aria-label="Suas carteiras">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold">Carteira principal</h2>
          <p className="mt-1 text-sm text-muted-foreground">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
        </div>
        {!full && !wallets.isPending && (
          <button type="button" className="shrink-0 text-sm font-bold text-primary hover:underline" onClick={focusAdd}>Adicionar</button>
        )}
      </div>

      {wallets.isPending ? (
        <Skeleton className="mt-6 h-24 w-full" />
      ) : wallets.isError ? (
        <div role="alert" className="mt-6 text-sm">
          Não foi possível carregar suas carteiras.{' '}
          <button type="button" className="text-primary underline" onClick={() => void wallets.refetch()}>Tentar novamente</button>
        </div>
      ) : (
        <>
          {primary.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Você ainda não tem carteiras. Cadastre uma para poder comprar.</p>
          ) : (
            <ul className="mt-6 flex flex-col gap-3">
              {primary.map((w) => <WalletRow key={w.id} wallet={w} onlyOne={list.length === 1} />)}
            </ul>
          )}

          <h2 className="mt-10 text-base font-bold">Carteiras secundárias</h2>
          {others.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">Você ainda não adicionou uma carteira secundária.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {others.map((w) => <WalletRow key={w.id} wallet={w} onlyOne={false} />)}
            </ul>
          )}

          <div ref={addRef} className="mt-10 scroll-mt-6">
            {full ? (
              <p className="text-sm text-muted-foreground">Você atingiu o limite de {MAX_WALLETS} carteiras. Remova uma para cadastrar outra.</p>
            ) : (
              <AddWallet />
            )}
          </div>
        </>
      )}
    </section>
  );
}

function WalletRow({ wallet, onlyOne }: { wallet: Wallet; onlyOne: boolean }) {
  const update = useUpdateWallet();
  const remove = useDeleteWallet();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(wallet.name);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = update.isPending || remove.isPending;

  const saveName = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const parsed = walletSchema.shape.name.safeParse(name);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setError(null);
    update.mutate({ id: wallet.id, patch: { name: parsed.data } }, {
      onSuccess: () => setEditing(false),
      onError: (e) => showServerError(e, (f) => setError(f.name ?? 'Não foi possível salvar.'), 'Não foi possível salvar.'),
    });
  };

  return (
    <li className="rounded-sm border border-primary/40 bg-card p-4" aria-busy={busy}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {editing ? (
            <form onSubmit={saveName} noValidate className="flex flex-col gap-1">
              <Label htmlFor={`wallet-name-${wallet.id}`} className="sr-only">Nome da carteira</Label>
              <div className="flex gap-2">
                <Input {...fieldProps(`wallet-name-${wallet.id}`, error ?? undefined)} className={inputClass} value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
                <Button type="submit" disabled={busy}>Salvar</Button>
                <Button type="button" variant="ghost" disabled={busy} onClick={() => { setEditing(false); setName(wallet.name); setError(null); }}>Cancelar</Button>
              </div>
              {error && <p id={`wallet-name-${wallet.id}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
            </form>
          ) : (
            <p className="font-medium">
              {wallet.name}
              {wallet.isPrimary && <span className="ml-2 rounded bg-primary/20 px-2 py-0.5 text-xs">Principal</span>}
            </p>
          )}
          <p className="text-sm text-muted-foreground" title={wallet.address}>
            {shortAddress(wallet.address)} · {wallet.network}
          </p>
        </div>

        {!editing && (
          <div className="flex flex-wrap gap-2">
            {!wallet.isPrimary && (
              <Button
                type="button" variant="outline" size="sm" disabled={busy} aria-label={`Tornar ${wallet.name} a carteira principal`}
                onClick={() => update.mutate({ id: wallet.id, patch: { isPrimary: true } }, { onError: (e) => showServerError(e, () => undefined, 'Não foi possível atualizar.') })}
              >
                Tornar principal
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" disabled={busy} aria-label={`Renomear ${wallet.name}`} onClick={() => setEditing(true)}>Renomear</Button>
            {confirming ? (
              <>
                <Button
                  type="button" variant="destructive" size="sm" disabled={busy} aria-label={`Confirmar remoção de ${wallet.name}`}
                  onClick={() => remove.mutate(wallet.id, { onError: (e) => { setConfirming(false); showServerError(e, () => undefined, 'Não foi possível remover.'); } })}
                >
                  {remove.isPending ? 'Removendo…' : 'Confirmar remoção'}
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming(false)}>Cancelar</Button>
              </>
            ) : (
              <Button type="button" variant="ghost" size="sm" disabled={busy} aria-label={`Remover ${wallet.name}`} onClick={() => setConfirming(true)}>Remover</Button>
            )}
          </div>
        )}
      </div>
      {confirming && onlyOne && <p className="mt-2 text-sm text-muted-foreground">Sem carteira você não consegue comprar até cadastrar outra.</p>}
    </li>
  );
}

function AddWallet() {
  const create = useCreateWallet();
  const [values, setValues] = useState({ name: '', address: '', network: 'ethereum' });
  const [errors, setErrors] = useState<Errors>({});
  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (create.isPending) return;
    const parsed = walletSchema.safeParse(values);
    if (!parsed.success) return setErrors(fieldErrorsFrom(parsed.error));
    setErrors({});
    create.mutate(parsed.data, {
      onSuccess: () => {
        setValues({ name: '', address: '', network: 'ethereum' });
        toast.success('Carteira cadastrada.');
      },
      onError: (e) => showServerError(e, setErrors, 'Não foi possível cadastrar a carteira.'),
    });
  };

  return (
    <form onSubmit={submit} noValidate aria-label="Cadastrar carteira">
      <h2 className="text-base font-bold">Adicionar carteira</h2>
      <div className="mt-5 grid gap-x-7 gap-y-5 md:grid-cols-2">
        <Field label="Apelido da carteira" htmlFor="new-wallet-name" required error={errors.name}>
          <Input {...fieldProps('new-wallet-name', errors.name)} className={inputClass} value={values.name} disabled={create.isPending} onChange={set('name')} />
        </Field>
        <Field label="Rede" htmlFor="new-wallet-network" required error={errors.network}>
          <select {...fieldProps('new-wallet-network', errors.network)} className={inputClass} value={values.network} disabled={create.isPending} onChange={set('network')}>
            <option value="ethereum">Ethereum Mainnet</option>
            <option value="polygon">Polygon</option>
          </select>
        </Field>
        <div className="md:col-span-2">
          <Field label="Endereço da carteira" htmlFor="new-wallet-address" required error={errors.address}>
            <Input {...fieldProps('new-wallet-address', errors.address)} className={inputClass} value={values.address} disabled={create.isPending} autoComplete="off" spellCheck={false} placeholder="Endereço 0x da carteira" onChange={set('address')} />
          </Field>
        </div>
      </div>
      <Button type="submit" className={`${primaryButton} mt-6 h-10`} disabled={create.isPending}>
        {create.isPending ? 'Salvando…' : 'Salvar carteira'}
      </Button>
    </form>
  );
}

function ProfileSkeleton() {
  return (
    <div className="grid gap-7 py-8 lg:grid-cols-[310px_1fr]" aria-busy="true" aria-label="Carregando perfil">
      <Skeleton className="h-[400px] w-full" />
      <div>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-8 h-56 w-full" />
        <Skeleton className="mt-8 h-40 w-full" />
      </div>
    </div>
  );
}
