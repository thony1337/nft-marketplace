type PaginationProps = {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
};

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const base = 'flex size-8 items-center justify-center text-sm font-bold';

  return (
    <nav aria-label="Paginação" className="mt-10 flex justify-end gap-2">
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          aria-label={`Página ${p}`}
          aria-current={p === page ? 'page' : undefined}
          onClick={() => onChange(p)}
          className={`${base} ${p === page ? 'bg-primary text-primary-foreground' : 'border border-foreground/60 hover:text-primary'}`}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        aria-label="Próxima página"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className={`${base} border border-foreground/60 hover:text-primary disabled:opacity-40`}
      >
        ›
      </button>
    </nav>
  );
}