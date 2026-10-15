import { Fragment } from 'react';
import { Link } from '@tanstack/react-router';

// "Início / Mercado / Carrinho": the last item is where the user is; Mercado is out of scope, so it is text
export function Breadcrumb({ trail }: { trail: string[] }) {
  return (
    <nav aria-label="Breadcrumb" className="pt-6 text-sm font-bold">
      <Link to="/" className="hover:text-primary">
        Início
      </Link>
      {trail.map((label, i) => (
        <Fragment key={label}>
          {' / '}
          {i === trail.length - 1 ? <span aria-current="page">{label}</span> : <span>{label}</span>}
        </Fragment>
      ))}
    </nav>
  );
}
