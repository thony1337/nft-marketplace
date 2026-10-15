import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toApiError } from '../api/errors';
import { useAuth } from '../context/AuthContext';
import { fieldErrorsFrom, loginSchema, registerSchema } from '../lib/schemas';

export type AuthMode = 'login' | 'register';

type Values = { name: string; email: string; password: string; confirm: string };
const EMPTY: Values = { name: '', email: '', password: '', confirm: '' };

const DEMO = { email: 'anthony@example.com', password: 'Senha@123' };
const showDemo = import.meta.env.VITE_ENABLE_MOCKS === 'true';

export function AuthForm({ mode, onSuccess }: { mode: AuthMode; onSuccess: () => void }) {
  const { login, register } = useAuth();
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputs = useRef<Partial<Record<keyof Values, HTMLInputElement | null>>>({});

  const fields: (keyof Values)[] = mode === 'register' ? ['name', 'email', 'password', 'confirm'] : ['email', 'password'];
  const [shown, setShown] = useState(false);

  const set = (field: keyof Values, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: '' }));
  };

  // Focus moves only after the inputs are enabled again (they are disabled while submitting)
  const [focusRequest, setFocusRequest] = useState<{ field: keyof Values } | null>(null);
  useEffect(() => {
    if (focusRequest) inputs.current[focusRequest.field]?.focus();
  }, [focusRequest]);

  const focusFirstError = (found: Record<string, string>) => {
    const first = fields.find((f) => found[f]);
    if (first) setFocusRequest({ field: first });
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return; // a second click or Enter while the first request is running
    setFormError('');

    const parsed = (mode === 'login' ? loginSchema : registerSchema).safeParse(values);
    const found: Record<string, string> = parsed.success ? {} : fieldErrorsFrom(parsed.error);
    // The confirmation is only checked here: the server never sees it
    if (mode === 'register' && !found.password && values.password !== values.confirm) found.confirm = 'As senhas não conferem';
    if (!parsed.success || Object.keys(found).length > 0) {
      setErrors(found);
      focusFirstError(found);
      return;
    }
    setErrors({});

    setSubmitting(true);
    try {
      if (mode === 'login') await login(parsed.data as { email: string; password: string });
      else await register(parsed.data as { name: string; email: string; password: string });
      onSuccess();
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.fieldErrors) {
        setErrors(apiError.fieldErrors);
        focusFirstError(apiError.fieldErrors);
      } else {
        setFormError(
          apiError.isRetryable ? `${apiError.message} Tente novamente.` : apiError.message,
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const labels: Record<keyof Values, string> = { name: 'Nome', email: 'E-mail', password: 'Senha', confirm: 'Confirmar senha' };
  const placeholders: Record<keyof Values, string> = {
    name: 'Nome de usuário',
    email: mode === 'login' ? 'contato@email.com' : 'Digite seu e-mail',
    password: 'Senha',
    confirm: 'Confirmar senha',
  };
  const inputClass = 'h-10 w-full rounded-sm border border-primary/30 bg-background/40 px-3 text-sm text-foreground placeholder:text-muted-foreground/80 aria-[invalid=true]:border-destructive';
  const isPassword = (f: keyof Values) => f === 'password' || f === 'confirm';

  const notAvailable = (what: string) => () => toast.info(`${what} não está disponível nesta versão.`);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-busy={submitting}>
      {formError && (
        <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </div>
      )}

      {fields.map((field) => {
        const error = errors[field];
        return (
          <div key={field} className="space-y-1.5">
            {/* the design shows placeholders only; the label stays for assistive technology */}
            <Label htmlFor={`${mode}-${field}`} className="sr-only">{labels[field]}</Label>
            <div className="relative">
              <Input
                id={`${mode}-${field}`}
                ref={(el) => {
                  inputs.current[field] = el;
                }}
                name={field}
                type={isPassword(field) ? (shown ? 'text' : 'password') : field === 'email' ? 'email' : 'text'}
                autoComplete={
                  isPassword(field) ? (mode === 'login' ? 'current-password' : 'new-password') : field === 'email' ? 'email' : 'name'
                }
                autoFocus={field === fields[0]}
                value={values[field]}
                onChange={(e) => set(field, e.target.value)}
                disabled={submitting}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${mode}-${field}-error` : undefined}
                placeholder={placeholders[field]}
                className={`${inputClass} ${isPassword(field) ? 'pr-10' : ''}`}
              />
              {field === 'password' && (
                <button
                  type="button"
                  aria-label={shown ? 'Ocultar texto' : 'Mostrar texto'}
                  aria-pressed={shown}
                  onClick={() => setShown((v) => !v)}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-primary"
                >
                  {shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                </button>
              )}
            </div>
            {error && (
              <p id={`${mode}-${field}-error`} className="text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
        );
      })}

      {mode === 'login' && (
        <div className="text-right">
          <button type="button" aria-disabled="true" onClick={notAvailable('A recuperação de senha')} className="text-xs text-primary hover:underline">
            Esqueceu a senha?
          </button>
        </div>
      )}
      {mode === 'register' && (
        <p className="text-xs text-muted-foreground">A senha precisa de 8 caracteres, com letras e números.</p>
      )}

      <Button type="submit" className="h-11 w-full rounded-sm font-bold" disabled={submitting}>
        {submitting ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
      </Button>

      {showDemo && mode === 'login' && (
        <button
          type="button"
          onClick={() => {
            setValues((v) => ({ ...v, ...DEMO }));
            setErrors({});
          }}
          className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          Preencher com a conta de demonstração
        </button>
      )}

      {/* Social sign-in is part of the design but not of this challenge: shown, plainly unavailable */}
      <div className="relative !mt-6 flex items-center justify-center" role="separator">
        <span aria-hidden className="absolute inset-x-[-2.5rem] top-1/2 h-px bg-primary/20" />
        <span className="relative bg-card px-3 text-xs">Ou continue com</span>
      </div>
      <button type="button" aria-disabled="true" onClick={notAvailable('O acesso com Google')} className="flex h-10 w-full items-center justify-center gap-3 rounded-sm border border-primary/30 text-xs text-primary opacity-80">
        <GoogleMark /> Continuar com Google
      </button>
      <button type="button" aria-disabled="true" onClick={notAvailable('O acesso com Facebook')} className="flex h-10 w-full items-center justify-center gap-3 rounded-sm border border-primary/30 text-xs text-primary opacity-80">
        <span aria-hidden className="text-base font-bold leading-none text-[#4267b2]">f</span> Continuar com Facebook
      </button>
    </form>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="size-5">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
