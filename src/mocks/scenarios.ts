import { getDb } from './db';
import { mulberry32 } from './random';

export type ScenarioName =
  | 'default'
  | 'fast'
  | 'slow'
  | 'variable'
  | 'empty'
  | 'server-error'
  | 'offline'
  | 'timeout'
  | 'session-expired'
  | 'favorites-error'
  | 'coupon-expired'
  | 'payment-declined'
  | 'order-timeout'
  | 'purchase-price-change'
  | 'purchase-sold-out'
  | 'socket-noisy';

export type Scenario = {
  description: string;
  latency: { min: number; max: number } | 'infinite';
  offline?: boolean;
  emptyCatalog?: boolean;
  sessionExpired?: boolean;
  couponsExpired?: boolean;
  // How the simulated payment of a new order ends. Default: confirmed after 1.5 s.
  payment?: { outcome: 'confirmed' | 'declined'; delayMs: number };
  // The order is saved but the response never arrives; retrying with the same key recovers it
  timeoutAfterOrderCreated?: boolean;
  // The first order attempt finds the market changed under it (happens once per reset)
  duringPurchase?: 'price-change' | 'sell-out';
  // Every event is delivered twice and followed by a stale one (an older version)
  socket?: 'noisy';
  failing?: ReadonlyArray<{
    method: string;
    path: string; // regular expression tested against the URL path
    status: number;
    code: string;
    message: string;
  }>;
};

const instant = { min: 0, max: 0 };

export const SCENARIOS: Record<ScenarioName, Scenario> = {
  default: { description: 'Latência curta e variável (150 a 450 ms)', latency: { min: 150, max: 450 } },
  fast: {
    description: 'Sem latência, para testes automatizados',
    latency: instant,
    payment: { outcome: 'confirmed', delayMs: 0 },
  },
  slow: { description: 'Rede lenta (1,5 a 3 s)', latency: { min: 1500, max: 3000 } },
  variable: {
    description: 'Latência muito variável (50 ms a 2,5 s): respostas podem chegar fora de ordem',
    latency: { min: 50, max: 2500 },
  },
  empty: { description: 'Catálogo vazio', latency: instant, emptyCatalog: true },
  'server-error': {
    description: 'A listagem de NFTs responde 503',
    latency: instant,
    failing: [
      {
        method: 'GET',
        path: '^/api/nfts$',
        status: 503,
        code: 'SERVICE_UNAVAILABLE',
        message: 'Serviço temporariamente indisponível',
      },
    ],
  },
  offline: { description: 'Falha de conexão em toda requisição', latency: instant, offline: true },
  timeout: { description: 'Nenhuma requisição responde (estoura o timeout)', latency: 'infinite' },
  'session-expired': {
    description: 'Toda rota autenticada responde sessão expirada',
    latency: instant,
    sessionExpired: true,
  },
  'payment-declined': {
    description: 'O pagamento do pedido é recusado após 1,5 s',
    latency: { min: 100, max: 200 },
    payment: { outcome: 'declined', delayMs: 1500 },
  },
  'order-timeout': {
    description: 'O pedido é criado, mas a resposta nunca chega. Repetir com a mesma chave recupera o pedido',
    latency: { min: 100, max: 200 },
    timeoutAfterOrderCreated: true,
  },
  'purchase-price-change': {
    description: 'O preço de um item sobe no momento de confirmar a compra (uma vez)',
    latency: { min: 100, max: 200 },
    duringPurchase: 'price-change',
  },
  'purchase-sold-out': {
    description: 'A edição de um item esgota no momento de confirmar a compra (uma vez)',
    latency: { min: 100, max: 200 },
    duringPurchase: 'sell-out',
  },
  'socket-noisy': {
    description: 'Eventos em tempo real chegam duplicados e, depois, uma versão antiga atrasada',
    latency: { min: 100, max: 200 },
    socket: 'noisy',
  },
  'coupon-expired': {
    description: 'Todos os cupons estão expirados (inclusive os já aplicados)',
    latency: instant,
    couponsExpired: true,
  },
  'favorites-error': {
    description: 'Favoritar e desfavoritar respondem 500 (para ver o rollback otimista)',
    latency: { min: 300, max: 300 },
    failing: [
      { method: 'PUT', path: '^/api/favorites/[^/]+$', status: 500, code: 'INTERNAL_ERROR', message: 'Não foi possível atualizar os favoritos' },
      { method: 'DELETE', path: '^/api/favorites/[^/]+$', status: 500, code: 'INTERNAL_ERROR', message: 'Não foi possível atualizar os favoritos' },
    ],
  },
};

export function isScenarioName(value: unknown): value is ScenarioName {
  return typeof value === 'string' && value in SCENARIOS;
}

export function activeScenario(): Scenario {
  return SCENARIOS[getDb().scenario] ?? SCENARIOS.default;
}

// Seeded so a given scenario produces the same latency sequence on every run
let latencyRandom = mulberry32(1);

export function reseedLatency(seed = 1): void {
  latencyRandom = mulberry32(seed);
}

export function nextLatency(range: { min: number; max: number }): number {
  return Math.round(range.min + latencyRandom() * (range.max - range.min));
}
