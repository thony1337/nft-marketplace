import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fetchMe, loginRequest, logoutRequest, mergeCartRequest, registerRequest } from '../api/auth';
import { setSessionLostHandler } from '../api/client';
import { toApiError } from '../api/errors';
import { clearPrivateData } from '../lib/queryKeys';
import { RealtimeProvider } from '../realtime/RealtimeProvider';
import { clearSession, getSession, getToken, peekGuestId, resetGuestId, setSession, subscribeSession } from '../lib/session';
import type { User } from '../types';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  // Kept for the pages written before this version
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: { email: string; password: string }) => Promise<void>;
  register: (input: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  loginDialogOpen: boolean;
  openLogin: () => void;
  closeLogin: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const MAX_TIMEOUT = 2 ** 31 - 1;

// The dialog is opened from many places, not from a Dialog.Trigger, so the dialog library cannot
// know where to return focus when it closes. We remember who had it.
let loginOpener: HTMLElement | null = null;
export function restoreFocusAfterLogin(): void {
  const target = loginOpener?.isConnected ? loginOpener : document.querySelector<HTMLElement>('h1');
  loginOpener = null;
  if (!target) return;
  if (!target.matches('a, button, input, select, textarea, [tabindex]')) target.setAttribute('tabindex', '-1');
  target.focus();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const token = useSyncExternalStore(subscribeSession, getToken, () => null);
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);

  // Who the browser's token belongs to. The token is part of the key, so another token can
  // never be shown the data fetched for the previous one.
  const me = useQuery({
    queryKey: ['me', token],
    queryFn: fetchMe,
    enabled: Boolean(token),
    staleTime: Infinity,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: (count, error) => toApiError(error).isRetryable && count < 1,
    retryDelay: 600,
  });

  // ---- session ends: expired, revoked, or signed out in another tab ----------------------
  const lastToken = useRef(token);
  useEffect(() => {
    if (token === lastToken.current) return;
    lastToken.current = token;
    // The token changed without login()/logout() here: another tab did it
    void clearPrivateData(queryClient);
  }, [token, queryClient]);

  useEffect(() => {
    setSessionLostHandler((reason) => {
      if (!getToken()) return;
      lastToken.current = null;
      clearSession();
      void clearPrivateData(queryClient);
      toast.error(reason === 'SESSION_EXPIRED' ? 'Sua sessão expirou. Entre novamente.' : 'Você precisa entrar novamente.');
      setLoginDialogOpen(true);
    });
    return () => setSessionLostHandler(null);
  }, [queryClient]);

  // The server will refuse the token once it expires; this makes the screen notice on time
  useEffect(() => {
    if (!token) return;
    const expiresAt = Date.parse(getSession()?.expiresAt ?? '');
    if (!Number.isFinite(expiresAt)) return;
    const wait = Math.min(Math.max(expiresAt - Date.now(), 0), MAX_TIMEOUT);
    const timer = setTimeout(() => {
      if (getToken() !== token) return;
      lastToken.current = null;
      clearSession();
      void clearPrivateData(queryClient);
      toast.error('Sua sessão expirou. Entre novamente.');
      setLoginDialogOpen(true);
    }, wait);
    return () => clearTimeout(timer);
  }, [token, queryClient]);

  // ---- the visitor's cart follows them into the account -------------------------------------
  const mergeGuestCart = useCallback(async () => {
    const guestId = peekGuestId();
    if (!guestId) return;
    try {
      const merged = await mergeCartRequest(guestId);
      resetGuestId();
      await queryClient.invalidateQueries({ queryKey: ['cart'] });
      await queryClient.invalidateQueries({ queryKey: ['quote'] });
      for (const a of merged.adjustments) {
        toast.warning(`${a.title} (${a.editionLabel}): você pediu ${a.requested}, mantivemos ${a.kept} pelo estoque disponível.`);
      }
    } catch {
      // The guest id is kept, so the next load tries again. Signing in must not fail for this.
      toast.warning('Não conseguimos trazer o carrinho de visitante agora. Tentaremos de novo em breve.');
    }
  }, [queryClient]);

  // Recovery after a refresh: a guest cart may still be waiting
  const recoveredFor = useRef<string | null>(null);
  useEffect(() => {
    if (!token || !me.data || recoveredFor.current === token) return;
    recoveredFor.current = token;
    void mergeGuestCart();
  }, [token, me.data, mergeGuestCart]);

  // ---- actions -----------------------------------------------------------------------------
  const startSession = useCallback(
    async (response: { token: string; expiresAt: string; user: User }) => {
      lastToken.current = response.token; // so the effect above knows this change is ours
      await clearPrivateData(queryClient); // whatever the previous visitor or user left behind
      setSession(response.token, response.expiresAt);
      queryClient.setQueryData(['me', response.token], response.user);
      recoveredFor.current = response.token;
      await mergeGuestCart();
      setLoginDialogOpen(false);
    },
    [queryClient, mergeGuestCart],
  );

  const login = useCallback(
    async (input: { email: string; password: string }) => startSession(await loginRequest(input)),
    [startSession],
  );
  const register = useCallback(
    async (input: { name: string; email: string; password: string }) => startSession(await registerRequest(input)),
    [startSession],
  );

  const logout = useCallback(async () => {
    const current = getToken();
    lastToken.current = null;
    // Tell the server, but never keep the user signed in because the call failed
    const request = current ? logoutRequest(current).catch(() => undefined) : Promise.resolve();
    clearSession();
    await clearPrivateData(queryClient);
    await request;
    toast.success('Você saiu da conta.');
  }, [queryClient]);

  const status: AuthStatus = !token ? 'anonymous' : me.data ? 'authenticated' : me.isError ? 'anonymous' : 'loading';

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: token ? (me.data ?? null) : null,
      token,
      isLoading: status === 'loading',
      isAuthenticated: status === 'authenticated',
      login,
      register,
      logout,
      loginDialogOpen,
      openLogin: () => {
        loginOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setLoginDialogOpen(true);
      },
      closeLogin: () => setLoginDialogOpen(false),
    }),
    [status, token, me.data, login, register, logout, loginDialogOpen],
  );

  return (
    <AuthContext.Provider value={value}>
      <RealtimeProvider token={token}>{children}</RealtimeProvider>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  return context;
}
