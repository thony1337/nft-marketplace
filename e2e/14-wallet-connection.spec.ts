import { addToCartFromPage, expect, signedIn, test } from './fixtures';
import type { Page } from '@playwright/test';

async function toCheckout(page: Page, open: (path?: string) => Promise<void>) {
  await open('/');
  await signedIn(page);
  await addToCartFromPage(page, 'nft-1');
  await page.goto('/checkout');
  await expect(page.getByRole('radio', { name: /MetaMask Principal/ })).toBeChecked();
}

const status = (page: Page) => page.getByRole('status').filter({ hasText: /Carteira|Conectando/ });
const connectButton = (page: Page) => page.getByRole('button', { name: 'Conectar carteira', exact: true });
const disconnectButton = (page: Page) => page.getByRole('button', { name: 'Desconectar', exact: true });
const pay = (page: Page) => page.getByRole('button', { name: 'Confirmar compra' });

test.describe('checkout: wallet connection', () => {
  test('the chosen wallet is connected, can be disconnected, and paying needs it connected again', async ({ page, open }) => {
    await toCheckout(page, open);
    await expect(status(page)).toContainText('Carteira conectada');
    await expect(pay(page)).toBeEnabled();

    await disconnectButton(page).click();
    await expect(status(page)).toHaveText('Carteira desconectada');
    await expect(pay(page)).toBeDisabled();
    await expect(page.getByText('Conecte a carteira escolhida para confirmar a compra.')).toBeVisible();

    await connectButton(page).click();
    await expect(status(page)).toContainText('Carteira conectada');
    await expect(pay(page)).toBeEnabled();
  });

  test('the connection is kept after a refresh', async ({ page, open }) => {
    await toCheckout(page, open);
    await disconnectButton(page).click();
    await expect(status(page)).toHaveText('Carteira desconectada');
    await page.reload();
    await expect(status(page)).toHaveText('Carteira desconectada');
    await expect(pay(page)).toBeDisabled();
  });

  test('a wallet that refuses is explained, nothing gets connected, and trying again works', async ({ page, open, mocks }) => {
    await toCheckout(page, open);
    await disconnectButton(page).click();
    await expect(status(page)).toHaveText('Carteira desconectada');

    await mocks.setScenario('wallet-refused');
    await connectButton(page).click();
    await expect(page.getByRole('alert').filter({ hasText: 'A carteira recusou a conexão' })).toBeVisible();
    await expect(status(page)).toHaveText('Carteira desconectada');
    await expect(pay(page)).toBeDisabled();

    await mocks.setScenario('fast');
    await connectButton(page).click();
    await expect(status(page)).toContainText('Carteira conectada');
    await expect(page.getByRole('alert').filter({ hasText: 'A carteira recusou a conexão' })).toHaveCount(0);
    await expect(pay(page)).toBeEnabled();
  });

  test('each wallet has its own state, and connecting one disconnects the other', async ({ page, open }) => {
    await toCheckout(page, open);
    await page.getByRole('radio', { name: /Coinbase Vault/ }).check();
    await expect(status(page)).toHaveText('Carteira desconectada');
    await expect(pay(page)).toBeDisabled();

    await connectButton(page).click();
    await expect(status(page)).toContainText('Carteira conectada');
    await expect(pay(page)).toBeEnabled();

    await page.getByRole('radio', { name: /MetaMask Principal/ }).check();
    await expect(status(page)).toHaveText('Carteira desconectada'); // one connection at a time
  });

  test('the server refuses a payment from a wallet that is no longer connected, and the screen catches up', async ({ page, open, mocks }) => {
    await toCheckout(page, open);
    await expect(pay(page)).toBeEnabled();
    // the connection ends somewhere else (another tab, the wallet itself) while this screen still shows it
    await page.evaluate(async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/wallets/wallet-1/disconnect', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`disconnect failed: ${res.status}`);
    });
    await expect(status(page)).toContainText('Carteira conectada'); // not told yet
    await pay(page).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Conecte a carteira escolhida para pagar.' })).toBeVisible();
    await expect(status(page)).toHaveText('Carteira desconectada');
    await expect(pay(page)).toBeDisabled();
    expect(await mocks.orders()).toHaveLength(0);
    await expect(page.getByRole('heading', { name: 'Compra confirmada' })).toHaveCount(0);
  });
});
