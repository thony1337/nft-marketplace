import { Link } from '@tanstack/react-router';

// Any address the app does not know. The header and footer stay; only the content is replaced.
export function NotFoundPage() {
  return (
    <div className="py-24 text-center">
      <p aria-hidden className="text-sm font-bold text-primary">404</p>
      <h1 className="mt-2 text-2xl font-bold">Página não encontrada</h1>
      <p className="mt-2 text-sm text-muted-foreground">O endereço que você abriu não existe ou foi movido.</p>
      <Link
        to="/"
        className="mt-6 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        Voltar ao catálogo
      </Link>
    </div>
  );
}

export default NotFoundPage;
