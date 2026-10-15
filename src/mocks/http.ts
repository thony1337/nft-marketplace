import { HttpResponse } from 'msw';
import { getDb, type Session } from './db';
import { activeScenario } from './scenarios';
import type { DbUser } from './seed';
import type { ApiErrorBody, User } from '../types';

export function apiError(
  status: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string>,
) {
  const body: ApiErrorBody = { code, message, ...(fieldErrors ? { fieldErrors } : {}) };
  return HttpResponse.json(body, { status });
}

// Never leaks the salt or the hash
export function publicUser(user: DbUser): User {
  return { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl };
}

export type AuthResult =
  | { ok: true; user: DbUser; session: Session }
  | { ok: false; response: Response };

const unauthenticated = () =>
  apiError(401, 'UNAUTHENTICATED', 'É necessário entrar para continuar.');
const expired = () => apiError(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.');

// Every private route starts here, so each user only ever sees their own data
export function authenticate(request: Request): AuthResult {
  if (activeScenario().sessionExpired) return { ok: false, response: expired() };

  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return { ok: false, response: unauthenticated() };

  const db = getDb();
  const session = db.sessions.find((s) => s.token === token);
  if (!session) return { ok: false, response: unauthenticated() };
  if (Date.parse(session.expiresAt) <= Date.now()) return { ok: false, response: expired() };

  const user = db.users.find((u) => u.id === session.userId);
  if (!user) return { ok: false, response: unauthenticated() };

  return { ok: true, user, session };
}

const GUEST_ID_RE = /^[A-Za-z0-9-]{8,64}$/;

export type CartOwner = { ok: true; key: string; userId?: string } | { ok: false; response: Response };

// A cart belongs to a signed-in user or, before login, to an anonymous guest id.
// Sending a token always wins: a bad or expired token is an error, never a silent guest cart.
export function resolveCartOwner(request: Request): CartOwner {
  if (request.headers.get('Authorization')) {
    const auth = authenticate(request);
    if (!auth.ok) return auth;
    return { ok: true, key: `user:${auth.user.id}`, userId: auth.user.id };
  }
  const guestId = request.headers.get('X-Guest-Id') ?? '';
  if (!GUEST_ID_RE.test(guestId)) {
    return {
      ok: false,
      response: apiError(400, 'GUEST_ID_REQUIRED', 'Identificador de visitante ausente ou inválido.'),
    };
  }
  return { ok: true, key: `guest:${guestId}` };
}
