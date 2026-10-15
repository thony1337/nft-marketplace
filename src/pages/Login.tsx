import { useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { AuthForm, type AuthMode } from '../components/AuthForm';

// Only local paths: `?redirect=https://evil.example` must never send the user away
function safeRedirect(value: unknown): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

export function Login() {
  const [mode, setMode] = useState<AuthMode>('login');
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { redirect?: unknown };

  return (
    <div className="mx-auto mt-16 w-full max-w-md rounded-xl border border-border bg-card p-6 sm:p-8">
      <h1 className="mb-1 text-2xl font-bold">{mode === 'login' ? 'Entrar na conta' : 'Criar conta'}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {mode === 'login' ? 'Use seu e-mail e senha para continuar.' : 'Leva menos de um minuto.'}
      </p>

      <AuthForm key={mode} mode={mode} onSuccess={() => navigate({ to: safeRedirect(search.redirect) })} />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === 'login' ? 'Ainda não tem conta?' : 'Já tem conta?'}{' '}
        <button
          type="button"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          {mode === 'login' ? 'Criar conta' : 'Entrar'}
        </button>
      </p>
    </div>
  );
}
