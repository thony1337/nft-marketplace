import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Informe o e-mail')
  .pipe(z.email('E-mail inválido'))
  .transform((email) => email.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, 'A senha deve ter ao menos 8 caracteres')
  .regex(/[A-Za-z]/, 'A senha deve ter ao menos uma letra')
  .regex(/\d/, 'A senha deve ter ao menos um número');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe a senha'),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome').max(60, 'O nome deve ter até 60 caracteres'),
  email: emailSchema,
  password: passwordSchema,
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome').max(60, 'O nome deve ter até 60 caracteres'),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual'),
    newPassword: passwordSchema,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ['newPassword'],
    message: 'A nova senha deve ser diferente da atual',
  });

export const WALLET_NETWORKS = ['ethereum', 'polygon'] as const;
export const walletSchema = z.object({
  name: z.string().trim().min(2, 'Informe um nome').max(30, 'O nome deve ter até 30 caracteres'),
  address: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Endereço inválido (0x seguido de 40 caracteres hexadecimais)'),
  network: z.enum(WALLET_NETWORKS, 'Escolha uma rede'),
});
export const walletPatchSchema = z
  .object({ name: walletSchema.shape.name, isPrimary: z.literal(true) })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nada para atualizar' });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

// First message per field, ready to show under each input
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    // errors inside `collector` are reported under the field's own name
    const path = issue.path[0] === 'collector' ? issue.path.slice(1) : issue.path;
    const key = String(path[0] ?? 'form');
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export type ProfileInput = z.infer<typeof profileSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
export type WalletInput = z.infer<typeof walletSchema>;

export const couponSchema = z.object({
  code: z.string().trim().min(1, 'Informe o código do cupom').max(30, 'Código muito longo'),
});

export const WALLET_TYPES = ['metamask', 'coinbase', 'walletconnect', 'other'] as const;
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

// Empty optional fields are simply left out (the form drops them before sending)
const optionalText = (max: number, message: string) => z.string().trim().max(max, message).optional();

export const collectorSchema = z.object({
  displayName: z.string().trim().min(2, 'Informe o nome de exibição').max(60, 'Use até 60 caracteres'),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, 'Use de 3 a 20 letras minúsculas, números ou _'),
  profileName: z.string().trim().min(2, 'Informe o nome do perfil').max(60, 'Use até 60 caracteres'),
  email: emailSchema,
  network: z.enum(WALLET_NETWORKS, 'Selecione uma rede'),
  walletAddress: z.string().trim().regex(ADDRESS_RE, 'Endereço inválido (0x seguido de 40 caracteres hexadecimais)'),
  walletType: z.enum(WALLET_TYPES, 'Selecione uma carteira'),
  secondaryWallet: optionalText(60, 'Use até 60 caracteres').refine(
    (v) => !v || ADDRESS_RE.test(v) || /^[a-z0-9-]{3,}\.eth$/i.test(v),
    'Informe um nome .eth ou um endereço 0x válido',
  ),
  ensName: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{3,30}$/, 'Use de 3 a 30 letras minúsculas, números ou hífen')
    .optional(),
  referralCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{4,20}$/, 'Use de 4 a 20 letras, números ou hífen')
    .optional(),
  note: optionalText(200, 'Use até 200 caracteres'),
});
export type CollectorInput = z.infer<typeof collectorSchema>;

export const createOrderSchema = z.object({
  walletId: z.string().min(1, 'Escolha uma carteira'),
  quoteFingerprint: z.string().min(1, 'Cotação ausente'),
  collector: collectorSchema,
});
export const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_-]{8,80}$/;
