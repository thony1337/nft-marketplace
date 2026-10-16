/* eslint-disable react-refresh/only-export-components -- este arquivo precisa exportar mais que o componente (variantes do botão / `Route` do roteador por arquivos) */
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { Hero } from '../components/Hero';
import { MintJournal } from '../components/MintJournal';
import { PromoBanners } from '../components/PromoBanners';
import { Catalog } from '../pages/Catalog';
import { COLLECTION_IDS, DECIMAL_RE, NETWORK_IDS } from '@/lib/catalog';

const searchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  tab: z.enum(['all', 'new', 'trending']).default('all').catch('all'),
  sort: z.enum(['recent', 'price-asc', 'price-desc', 'name']).default('recent').catch('recent'),
  collection: z.enum(COLLECTION_IDS).optional().catch(undefined),
  network: z.enum(NETWORK_IDS).optional().catch(undefined),
  q: z.coerce.string().trim().min(1).max(80).optional().catch(undefined),
  minPrice: z.coerce.string().regex(DECIMAL_RE).optional().catch(undefined),
  maxPrice: z.coerce.string().regex(DECIMAL_RE).optional().catch(undefined),
});

export const Route = createFileRoute('/')({
  validateSearch: searchSchema,
  component: HomeComponent,
});

function HomeComponent() {
  return (
    <>
      <Hero />
      <Catalog />
      <PromoBanners />
      <MintJournal />
    </>
  );
}
