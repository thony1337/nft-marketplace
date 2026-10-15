import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '../context/AuthContext';
import { useCartCount } from '../hooks/useCart';
import { ConnectionBanner } from './ConnectionBanner';
import { LoginModal } from './LoginModal';
import { MobileNav } from './MobileNav';
import { SearchIcon, ShopIcon } from './icons';

export function Header() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const navigate = useNavigate();
  const { status, user, logout, openLogin } = useAuth();
  const cartCount = useCartCount();
  // The market pages (NFT, cart, checkout, orders) all live under "Mercado" in the design
  const inMarket = useRouterState({
    select: (state) => /^\/(nft|cart|checkout|orders)(\/|$)/.test(state.location.pathname),
  });

  const onSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get('q') ?? '').trim();
    navigate({ to: '/', search: { q: q || undefined, page: 1 }, hash: 'catalogo' });
  };

  return (
    <header className="bg-background">
      <ConnectionBanner />
      <div className="mx-auto flex h-[75px] w-full max-md:hidden max-w-[1200px] items-stretch justify-between border-b border-primary/30 px-4 xl:px-0">
        <Link to="/" className="flex items-center text-sm font-bold tracking-widest">
          KURIO
        </Link>

        <nav aria-label="Principal" className="hidden items-stretch gap-10 md:flex">
          <Link
            to="/"
            activeOptions={{ exact: true, includeSearch: false }}
            className="flex items-center border-b-[3px] border-transparent hover:text-primary"
            activeProps={{ className: 'border-primary font-bold text-primary' }}
          >
            Início
          </Link>
          {/* Out-of-scope pages: shown as in the design, but not clickable */}
          {['Mercado', 'Criadores', 'Aprenda'].map((label) => (
            <span
              key={label}
              aria-disabled="true"
              title="Em breve"
              className={`flex cursor-default items-center border-b-[3px] ${
                label === 'Mercado' && inMarket ? 'border-primary font-bold text-primary' : 'border-transparent'
              }`}
            >
              {label}
            </span>
          ))}
        </nav>

        <div className="flex items-center gap-5">
          {isSearchOpen && (
            <form role="search" onSubmit={onSearch}>
              <Input
                name="q"
                type="search"
                aria-label="Buscar NFTs"
                placeholder="Buscar NFTs"
                autoFocus
                maxLength={80}
                onKeyDown={(e) => e.key === 'Escape' && setIsSearchOpen(false)}
                className="h-8 w-40 sm:w-56"
              />
            </form>
          )}
          <button
            type="button"
            aria-label="Buscar"
            aria-expanded={isSearchOpen}
            onClick={() => setIsSearchOpen((open) => !open)}
            className="hover:text-primary"
          >
            <SearchIcon />
          </button>
          <Link
            to="/cart"
            aria-label={`Carrinho, ${cartCount} itens`}
            className="relative hover:text-primary"
          >
            <ShopIcon />
            {cartCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {cartCount}
              </span>
            )}
          </Link>

          {status === 'loading' && <Skeleton aria-hidden className="h-8 w-24" />}

          {status === 'authenticated' && user && (
            <>
              <Link
                to="/profile"
                aria-label={`Perfil de ${user.name}`}
                className="flex items-center gap-2 text-sm hover:text-primary"
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="size-7 rounded-full object-cover" />
                ) : (
                  <span
                    aria-hidden
                    className="grid size-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
                  >
                    {user.name.trim().charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="hidden max-w-[12ch] truncate lg:inline">{user.name}</span>
              </Link>
              <Button size="sm" variant="outline" onClick={() => void logout()}>
                <LogOut />
                Sair
              </Button>
            </>
          )}

          {status === 'anonymous' && (
            <Button size="sm" onClick={openLogin}>
              <LogIn />
              Entrar
            </Button>
          )}
        </div>
      </div>

      <LoginModal />
      <MobileNav />
    </header>
  );
}
