import axios from 'axios';
import { getGuestId, getToken } from '../lib/session';
import { toApiError } from './errors';

export const api = axios.create({
  baseURL: '/api',
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
});

const GUEST_ROUTES = /^\/(cart|quote)(\/|$)/;

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (GUEST_ROUTES.test(config.url ?? '')) {
    // A visitor's cart is keyed by this id. Only created when a cart is actually used, and
    // never for a signed-in user.
    config.headers['X-Guest-Id'] = getGuestId();
  }
  return config;
});

// The auth layer registers what should happen when the server says the session is over.
// The client only reports it; it never decides what the app does about it.
type SessionLostHandler = (reason: 'SESSION_EXPIRED' | 'UNAUTHENTICATED') => void;
let onSessionLost: SessionLostHandler | null = null;
export function setSessionLostHandler(handler: SessionLostHandler | null): void {
  onSessionLost = handler;
}

api.interceptors.response.use(undefined, (error: unknown) => {
  const apiError = toApiError(error);
  // Only a request that actually carried a token can lose a session, and only if that token is
  // still the current one: a late answer for an old token must not sign out a newer login.
  const sent = axios.isAxiosError(error) ? String(error.config?.headers?.Authorization ?? '') : '';
  const sentToken = sent.startsWith('Bearer ') && sent.slice(7) === getToken();
  if (sentToken && apiError.status === 401 && apiError.isSessionProblem) {
    onSessionLost?.(apiError.code as 'SESSION_EXPIRED' | 'UNAUTHENTICATED');
  }
  return Promise.reject(error); // unchanged: callers use toApiError() when they want the shape
});
