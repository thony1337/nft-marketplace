import { lazy } from 'react';
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { Toaster } from '@/components/ui/sonner';

// Devtools are loaded only in development and never reach the production bundle
const TanStackRouterDevtools = import.meta.env.PROD
  ? () => null
  : lazy(() =>
      import('@tanstack/react-router-devtools').then((m) => ({
        default: m.TanStackRouterDevtools,
      })),
    );

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 xl:px-0">
        <Outlet />
      </main>
      <Footer />
      <Toaster />
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </div>
  );
}
