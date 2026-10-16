import { addToCartFromPage, expect, signedIn, test } from './fixtures';

const price = (page: import('@playwright/test').Page) => page.getByText(/^\d+(\.\d+)? ETH$/).first();

test.describe('realtime resilience', () => {
  test('duplicated and out-of-date events never move the screen backwards', async ({ page, open, mocks }) => {
    await open('/nft/nft-1', 'socket-noisy');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible(); // the page has its data: an event before that would have nothing to update
    await expect.poll(() => mocks.socketCount()).toBeGreaterThan(0);
    await mocks.setPrice('nft-1', '3.1');
    await expect(price(page)).toHaveText('3.1 ETH');
    await mocks.setPrice('nft-1', '3.2');
    await expect(price(page)).toHaveText('3.2 ETH');
    await page.waitForTimeout(800); // the late copies of the older states arrive in this window
    await expect(price(page)).toHaveText('3.2 ETH');
    await page.reload();
    await expect(price(page)).toHaveText('3.2 ETH');
  });

  test('a connection that drops is announced, and the screen is brought up to date when it returns', async ({ page, open, mocks }) => {
    await open('/nft/nft-1');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect.poll(() => mocks.socketCount()).toBeGreaterThan(0);

    await mocks.setSocketsDown(true);
    await mocks.dropSockets();
    await expect(page.getByText(/Sem conexão em tempo real/)).toBeVisible();
    await mocks.setPrice('nft-1', '6.5'); // nobody is listening: this event is lost
    await page.waitForTimeout(2500);
    await expect(price(page)).not.toHaveText('6.5 ETH');
    await expect(page.getByText(/Sem conexão em tempo real/)).toBeVisible();

    await mocks.setSocketsDown(false);
    await expect(price(page)).toHaveText('6.5 ETH', { timeout: 20_000 });
    await expect(page.getByText(/Sem conexão em tempo real/)).toHaveCount(0);
  });

  test('a pending order is still pending after a refresh, and ends in the right state', async ({ page, open, mocks }) => {
    await open('/');
    await signedIn(page);
    await addToCartFromPage(page, 'nft-1');
    await mocks.setScenario('default'); // payment takes 1.5 s
    await page.goto('/checkout');
    await page.getByRole('button', { name: 'Confirmar compra' }).click();
    await expect(page.getByRole('heading', { name: 'Processando pagamento…' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: /Processando pagamento|Compra confirmada/ })).toBeVisible();
    await mocks.settleOrders();
    await expect(page.getByRole('heading', { name: 'Compra confirmada' })).toBeVisible();
  });

  test('a payment that finishes while the connection is down is picked up when it comes back', async ({ page, open, mocks }) => {
    await open('/');
    await signedIn(page);
    await addToCartFromPage(page, 'nft-1');
    await mocks.setScenario('default');
    await page.goto('/checkout');
    await page.getByRole('button', { name: 'Confirmar compra' }).click();
    await expect(page.getByRole('heading', { name: 'Processando pagamento…' })).toBeVisible();

    await mocks.setSocketsDown(true);
    await mocks.dropSockets();
    await mocks.settleOrders(); // the event is lost
    await mocks.setSocketsDown(false);
    await expect(page.getByRole('heading', { name: 'Compra confirmada' })).toBeVisible({ timeout: 20_000 });
  });

  test('events for one user never move another user\'s screen', async ({ browser }) => {
    // two separate browsers (two people): one buys, the other is only browsing
    const buyer = await browser.newContext();
    const watcher = await browser.newContext();
    const a = await buyer.newPage();
    const b = await watcher.newPage();
    await a.goto('/nft/nft-1?mockScenario=default');
    await b.goto('/nft/nft-1?mockScenario=default');
    await expect(a.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(b.getByRole('heading', { level: 1 })).toBeVisible();
    // the watcher's own mock server is its own: nothing the buyer does reaches it
    await a.evaluate(() => window.__kurioMocks.setPrice('nft-1', '8.8'));
    await expect(price(a)).toHaveText('8.8 ETH');
    await expect(price(b)).not.toHaveText('8.8 ETH');
    await buyer.close();
    await watcher.close();
  });
});
