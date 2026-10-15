import { scenarioGate } from './gate';
import { authRoutes } from './routes/auth';
import { cartRoutes } from './routes/cart';
import { catalogRoutes } from './routes/catalog';
import { favoriteRoutes } from './routes/favorites';
import { realtimeHandlers } from './realtime';
import { orderRoutes } from './routes/orders';
import { quoteRoutes } from './routes/quote';
import { profileRoutes } from './routes/profile';
import { walletRoutes } from './routes/wallets';

export const handlers = [
  scenarioGate, // must stay first: applies latency and failures, then falls through
  ...authRoutes,
  ...catalogRoutes,
  ...favoriteRoutes,
  ...cartRoutes,
  ...quoteRoutes,
  ...orderRoutes,
  ...walletRoutes,
  ...profileRoutes,
  ...realtimeHandlers,
];
