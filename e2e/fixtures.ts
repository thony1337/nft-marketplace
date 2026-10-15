import { expect, test as base, type Page } from '@playwright/test';

type KurioMocks = {
  setScenario(name: string): void;
  reset(name?: string): void;
  expireSessions(): void;
  setPrice(nftId: string, price: string): void;
  setEditionStock(nftId: string, editionId: string, stock: number): void;
  settleOrders(): void;
  dropSockets(): void;
  setSocketsDown(down: boolean): void;
  socketCount(): number;
};
declare global {
  interface Window {
    __kurioMocks: KurioMocks;
  }
}

// What the tests may do to the mock *server*: choose a scenario, move the market, finish payments,
// cut the live connection. The page itself is only ever touched through its interface.
export function mocksFor(page: Page) {
  const call = <K extends keyof KurioMocks>(method: K, ...args: Parameters<KurioMocks[K]>) =>
    page.evaluate(([m, a]) => (window.__kurioMocks[m as keyof KurioMocks] as (...x: unknown[]) => unknown)(...(a as unknown[])), [method, args] as const);
  return {
    setScenario: (name: string) => call('setScenario', name),
    expireSessions: () => call('expireSessions'),
    setPrice: (id: string, price: string) => call('setPrice', id, price),
    setEditionStock: (id: string, edition: string, stock: number) => call('setEditionStock', id, edition, stock),
    settleOrders: () => call('settleOrders'),
    dropSockets: () => call('dropSockets'),
    setSocketsDown: (down: boolean) => call('setSocketsDown', down),
    socketCount: () => page.evaluate(() => window.__kurioMocks.socketCount()),
    // what the mock server has stored (the result of an operation, not a way to cause one)
    orders: () =>
      page.evaluate(() => {
        const db = JSON.parse(localStorage.getItem('kurio:mock-db:v1') ?? '{}') as { orders?: { id: string; status: string; idempotencyKey: string }[] };
        return db.orders ?? [];
      }),
  };
}

// The mock server is a service worker: until it controls the page, requests would reach the dev server
export async function mockServerReady(page: Page) {
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), undefined, { timeout: 15_000 });
}

export const DEMO = { email: 'anthony@example.com', password: 'Senha@123', name: 'Anthony Silva' };
export const OTHER = { email: 'collector@example.com', password: 'Senha@123', name: 'CryptoCollector' };

export const test = base.extend<{ mocks: ReturnType<typeof mocksFor>; open: (path?: string, scenario?: string) => Promise<void> }>({
  // Dev-only overlays (TanStack Router/Query devtools) float over the bottom tab bar on phones and
  // swallow clicks; they are not part of the product, so the tests keep them out of the way.
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      const hide = () => {
        const style = document.createElement('style');
        style.textContent =
          'button[aria-label*="TanStack"], .tsqd-parent-container, .tsqd-open-btn-container, [class*="TanStackRouterDevtools"] { display: none !important; }';
        document.head.appendChild(style);
      };
      if (document.head) hide();
      else document.addEventListener('DOMContentLoaded', hide, { once: true });
    });
    await use(page);
  },
  mocks: async ({ page }, use) => use(mocksFor(page)),
  // Opens a page with the mock server on and a chosen scenario (default: no latency, instant payments)
  open: async ({ page }, use) => {
    await use(async (path = '/', scenario = 'fast') => {
      const url = new URL(path, 'http://x');
      url.searchParams.set('mockScenario', scenario);
      await page.goto(`${url.pathname}${url.search}${url.hash}`);
      await page.waitForFunction(() => Boolean(window.__kurioMocks));
      await mockServerReady(page);
    });
  },
});
export { expect };

// ---- steps shared by the specs --------------------------------------------------------------

export async function signInThroughDialog(page: Page, who = DEMO) {
  await page.getByRole('button', { name: 'Entrar' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('E-mail').fill(who.email);
  await dialog.getByLabel('Senha').fill(who.password);
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('link', { name: `Perfil de ${who.name}` })).toBeVisible();
}

// Fast path for specs that are about something else: sign in through the API the page uses
export async function signedIn(page: Page, who = DEMO) {
  await mockServerReady(page);
  await page.evaluate(async ({ email, password }) => {
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (!res.ok) throw new Error(`login failed: ${res.status}`);
    const body = (await res.json()) as { token: string; expiresAt: string };
    localStorage.setItem('auth_token', body.token);
    localStorage.setItem('auth_expires_at', body.expiresAt);
  }, who);
  await page.reload();
  await expect(page.getByRole('link', { name: `Perfil de ${who.name}` })).toBeVisible();
}

// Puts an NFT in the cart the way a user does: on its page, with COMPRAR
export async function addToCartFromPage(page: Page, nftId = 'nft-1', { edition = 'ABERTA', times = 1 } = {}) {
  await page.goto(`/nft/${nftId}`);
  await page.getByRole('radio', { name: edition }).click();
  for (let i = 1; i < times; i++) await page.getByRole('button', { name: 'Aumentar quantidade' }).click();
  await page.getByRole('button', { name: 'COMPRAR' }).click();
  await expect(page.getByText(/adicionado ao carrinho/).first()).toBeVisible();
}

export const cartLink = (page: Page) => page.getByRole('link', { name: /^Carrinho/ });

// "Sair" is in the header on wide screens; on phones the header is gone and it lives in the profile menu
export async function signOut(page: Page) {
  const header = page.getByRole('banner').getByRole('button', { name: 'Sair' });
  if (await header.isVisible()) {
    await header.click();
    return;
  }
  const back = page.url();
  await page.getByRole('link', { name: /^Perfil de/ }).click();
  await page.getByRole('navigation', { name: 'Seção do perfil' }).getByRole('button', { name: 'Sair' }).click();
  await expect(page.getByRole('heading', { name: 'Entre para ver seu perfil' })).toBeVisible();
  await page.goto(back);
}
