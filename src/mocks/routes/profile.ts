import { http, HttpResponse } from 'msw';
import { fieldErrorsFrom, passwordChangeSchema, profileSchema } from '../../lib/schemas';
import { hashPassword } from '../crypto';
import { getDb, saveDb } from '../db';
import { apiError, authenticate, publicUser } from '../http';
import { detachToken } from '../realtime';

export const AVATAR_MAX_BYTES = 150 * 1024;
const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

// Not `instanceof File`: the File class differs between the page and the mock runtime in some environments
const isFile = (value: unknown): value is File =>
  typeof value === 'object' && value !== null && typeof (value as File).arrayBuffer === 'function' && 'size' in value && 'type' in value;

const validation = (error: Parameters<typeof fieldErrorsFrom>[0]) =>
  apiError(422, 'VALIDATION_ERROR', 'Verifique os campos informados.', fieldErrorsFrom(error));

async function toDataUrl(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:${file.type};base64,${btoa(binary)}`;
}

export const profileRoutes = [
  http.patch('/api/profile', async ({ request }) => {
    const auth = authenticate(request);
    if (!auth.ok) return auth.response;

    const parsed = profileSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validation(parsed.error);

    auth.user.name = parsed.data.name;
    saveDb();
    return HttpResponse.json(publicUser(auth.user));
  }),

  // multipart/form-data with a single "avatar" file
  http.put('/api/profile/avatar', async ({ request }) => {
    const auth = authenticate(request);
    if (!auth.ok) return auth.response;

    const form = await request.formData().catch(() => null);
    const file = form?.get('avatar');
    if (!isFile(file)) {
      return apiError(422, 'VALIDATION_ERROR', 'Envie uma imagem.', { avatar: 'Envie uma imagem' });
    }
    if (!AVATAR_TYPES.includes(file.type)) {
      return apiError(422, 'VALIDATION_ERROR', 'Formato não suportado.', {
        avatar: 'Use uma imagem PNG, JPG ou WebP',
      });
    }
    if (file.size > AVATAR_MAX_BYTES) {
      return apiError(413, 'FILE_TOO_LARGE', 'A imagem é grande demais.', {
        avatar: `A imagem deve ter até ${AVATAR_MAX_BYTES / 1024} KB`,
      });
    }

    auth.user.avatarUrl = await toDataUrl(file);
    saveDb();
    return HttpResponse.json(publicUser(auth.user));
  }),

  http.delete('/api/profile/avatar', ({ request }) => {
    const auth = authenticate(request);
    if (!auth.ok) return auth.response;
    delete auth.user.avatarUrl;
    saveDb();
    return HttpResponse.json(publicUser(auth.user));
  }),

  http.post('/api/profile/password', async ({ request }) => {
    const auth = authenticate(request);
    if (!auth.ok) return auth.response;

    const parsed = passwordChangeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validation(parsed.error);

    const { currentPassword, newPassword } = parsed.data;
    if ((await hashPassword(currentPassword, auth.user.salt)) !== auth.user.passwordHash) {
      return apiError(422, 'INVALID_CURRENT_PASSWORD', 'A senha atual está incorreta.', {
        currentPassword: 'A senha atual está incorreta',
      });
    }

    auth.user.passwordHash = await hashPassword(newPassword, auth.user.salt);
    // Changing the password signs this user out everywhere else
    const db = getDb();
    const revoked = db.sessions.filter((s) => s.userId === auth.user.id && s.token !== auth.session.token);
    db.sessions = db.sessions.filter((s) => !revoked.includes(s));
    for (const s of revoked) detachToken(s.token);
    saveDb();
    return new HttpResponse(null, { status: 204 });
  }),
];
