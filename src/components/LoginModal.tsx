import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { restoreFocusAfterLogin, useAuth } from '../context/AuthContext';
import { AuthForm, type AuthMode } from './AuthForm';

const TABS: { id: AuthMode; label: string }[] = [
  { id: 'login', label: 'Entrar' },
  { id: 'register', label: 'Criar conta' },
];

const DESCRIPTION: Record<AuthMode, string> = {
  login: 'Entre para gerenciar sua carteira, coleção e perfil de criador. Também para comprar, favoritar e acompanhar seus pedidos.',
  register: 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.',
};

// Opened from anywhere with useAuth().openLogin()
export function LoginModal() {
  const { loginDialogOpen, closeLogin } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');

  return (
    <Dialog open={loginDialogOpen} onOpenChange={(open) => !open && closeLogin()}>
      <DialogContent
        className="gap-0 overflow-hidden rounded-md border-primary/30 bg-card p-0 sm:max-w-[500px] max-sm:fixed max-sm:inset-0 max-sm:left-0 max-sm:top-0 max-sm:h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:overflow-y-auto max-sm:rounded-none max-sm:border-0 max-sm:bg-background"
        onCloseAutoFocus={(event) => {
          event.preventDefault(); // Radix would send focus to a Trigger we do not have
          restoreFocusAfterLogin();
        }}
      >
        <DialogHeader className="px-10 pt-10 text-center sm:text-center max-sm:px-6 max-sm:pt-16">
          <p aria-hidden className="mb-10 text-center text-3xl font-bold tracking-[0.2em] sm:hidden">KURIO</p>
          <DialogTitle className="sr-only">Bem-vindo à Kurio</DialogTitle>
          <div role="tablist" aria-label="Acesso" className="flex items-center justify-center text-lg font-bold">
            {TABS.map((tab, i) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`auth-tab-${tab.id}`}
                aria-selected={mode === tab.id}
                aria-controls="auth-panel"
                onClick={() => setMode(tab.id)}
                className={`px-3 transition-colors ${i === 0 ? 'border-r border-primary' : ''} ${mode === tab.id ? 'text-primary' : 'text-foreground hover:text-primary'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <DialogDescription className="mx-auto mt-5 max-w-[340px] text-center text-xs leading-relaxed text-foreground">
            {DESCRIPTION[mode]}
          </DialogDescription>
        </DialogHeader>

        <div role="tabpanel" id="auth-panel" aria-labelledby={`auth-tab-${mode}`} className="px-10 pb-10 pt-6 max-sm:px-6">
          {/* key: switching tabs starts a clean form */}
          <AuthForm key={mode} mode={mode} onSuccess={closeLogin} />
        </div>
        <div aria-hidden className="h-2.5 bg-primary max-sm:hidden" />
      </DialogContent>
    </Dialog>
  );
}
