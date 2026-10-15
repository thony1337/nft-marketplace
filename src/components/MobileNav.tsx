import { Link, useRouterState } from '@tanstack/react-router';
import { Heart, House, ScanLine, ShoppingCart, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCartCount } from '../hooks/useCart';

// The phone's bottom bar. It replaces the header's icons below 768px, so each control exists once
// on screen: the header bar is hidden there and these take over (cart, profile or sign-in).
export function MobileNav() {
  const { status, user, openLogin } = useAuth();
  const cartCount = useCartCount();
  // Product, cart and payment screens have their own bottom bar in the design
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const hidden = /^\/(nft|cart|checkout)(\/|$)/.test(pathname);
  const tab = 'relative flex size-11 items-center justify-center rounded-full text-primary/70';
  const active = { className: 'text-primary' };

  // Those screens carry no tab bar: the product and cart screens put cart and account in their own top bar
  if (hidden) return null;

  return (
    <nav aria-label="Navegação" className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <div className="relative mx-auto flex h-[68px] max-w-[430px] items-center justify-between rounded-t-[28px] bg-card px-8 shadow-[0_-8px_24px_rgba(0,0,0,0.45)]">
        <Link to="/" aria-label="Início" activeOptions={{ exact: true, includeSearch: false }} className={tab} activeProps={active}>
          <House className="size-6" aria-hidden />
        </Link>
        {/* Out of scope: shown as in the design, not clickable */}
        <span aria-disabled="true" title="Em breve" className={`${tab} cursor-default opacity-70`}>
          <Heart className="size-6" aria-hidden />
        </span>
        <span aria-hidden className="w-16" />
        <span
          aria-disabled="true"
          title="Em breve"
          className="absolute left-1/2 top-[-22px] flex size-16 -translate-x-1/2 items-center justify-center rounded-full border-[6px] border-background bg-gradient-to-br from-[#d28a4c] to-[#a8693a] text-background"
        >
          <ScanLine className="size-6" aria-hidden />
        </span>
        <Link to="/cart" aria-label={`Carrinho, ${cartCount} itens`} className={tab} activeProps={active}>
          <ShoppingCart className="size-6" aria-hidden />
          {cartCount > 0 && (
            <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {cartCount}
            </span>
          )}
        </Link>
        {status === 'authenticated' && user ? (
          <Link to="/profile" aria-label={`Perfil de ${user.name}`} className={tab} activeProps={active}>
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="size-7 rounded-full object-cover" />
            ) : (
              <User className="size-6" aria-hidden />
            )}
          </Link>
        ) : (
          <button type="button" aria-label="Entrar" onClick={openLogin} className={tab}>
            <User className="size-6" aria-hidden />
          </button>
        )}
      </div>
    </nav>
  );
}
