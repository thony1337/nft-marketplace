import { http, HttpResponse } from 'msw';
import { fieldErrorsFrom, loginSchema, registerSchema } from '../../lib/schemas';
import type { AuthResponse } from '../../types';
import { hashPassword } from '../crypto';
import { createSession, getDb, saveDb } from '../db';
import { apiError, authenticate, publicUser } from '../http';
import { detachToken } from '../realtime';
import type { DbUser } from '../seed';

const authResponse = (user: DbUser, token: string, expiresAt: string): AuthResponse => ({
  token,
  expiresAt,
  user: publicUser(user),
});

export const authRoutes = [
  http.post('/api/auth/register', async ({ request }) => {
    const body = await request.json().catch(() => null);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, 'VALIDATION_ERROR', 'Verifique os campos informados.', fieldErrorsFrom(parsed.error));
    }

    const { name, email, password } = parsed.data;
    const db = getDb();
    if (db.users.some((u) => u.email === email)) {
      return apiError(409, 'EMAIL_TAKEN', 'Este e-mail já está cadastrado.', {
        email: 'Este e-mail já está cadastrado',
      });
    }

    const salt = crypto.randomUUID();
    const user: DbUser = {
      id: `user-${db.users.length + 1}`,
      name,
      email,
      salt,
      passwordHash: await hashPassword(password, salt),
    };
    db.users.push(user);
    const session = createSession(user.id);
    saveDb();

    return HttpResponse.json(authResponse(user, session.token, session.expiresAt), { status: 201 });
  }),

  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, 'VALIDATION_ERROR', 'Verifique os campos informados.', fieldErrorsFrom(parsed.error));
    }

    const { email, password } = parsed.data;
    const user = getDb().users.find((u) => u.email === email);
    // Same answer for unknown e-mail and wrong password, so accounts cannot be probed
    if (!user || (await hashPassword(password, user.salt)) !== user.passwordHash) {
      return apiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
    }

    const session = createSession(user.id);
    return HttpResponse.json(authResponse(user, session.token, session.expiresAt));
  }),

  http.get('/api/auth/me', ({ request }) => {
    const auth = authenticate(request);
    if (!auth.ok) return auth.response;
    return HttpResponse.json(publicUser(auth.user));
  }),

  http.post('/api/auth/logout', ({ request }) => {
    // Idempotent: logging out with an unknown or expired token also succeeds
    const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/, '');
    const db = getDb();
    db.sessions = db.sessions.filter((s) => s.token !== token);
    detachToken(token);
    saveDb();
    return new HttpResponse(null, { status: 204 });
  }),
];
