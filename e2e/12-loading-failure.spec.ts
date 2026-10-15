import { addToCartFromPage, expect, signedIn, test } from './fixtures';

test.describe('loading, failure and retry', () => {
  test('a slow detail page shows a skeleton first, then the content', async ({ page, open }) => {
    await open('/nft/nft-1', 'slow');
    await expect(page.getByLabel('Carregando NFT')).toBeAttached(); // the placeholder is on the page while the data is late
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('Carregando NFT')).toHaveCount(0);
  });

  test('a slow cart shows a skeleton, then the items', async ({ page, open, mocks }) => {
    await open('/');
    await addToCartFromPage(page, 'nft-1');
    await mocks.setScenario('slow');
    await page.goto('/cart');
    await expect(page.getByLabel('Carregando carrinho')).toBeAttached(); // the placeholder is on the page while the data is late
    await expect(page.getByRole('list', { name: 'Itens do carrinho' })).toBeVisible({ timeout: 15_000 });
  });

  test('a slow checkout shows a skeleton, then the form', async ({ page, open, mocks }) => {
    await open('/');
    await signedIn(page);
    await addToCartFromPage(page, 'nft-1');
    await mocks.setScenario('slow');
    await page.goto('/checkout');
    await expect(page.getByLabel('Carregando checkout')).toBeAttached(); // the placeholder is on the page while the data is late
    await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeVisible({ timeout: 15_000 });
  });

  test('a failed load says what happened and the retry recovers the page', async ({ page, open, mocks }) => {
    await open('/nft/nft-1', 'offline');
    await expect(page.getByRole('heading', { name: 'Não foi possível carregar este NFT' })).toBeVisible({ timeout: 20_000 });
    await mocks.setScenario('fast');
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible();
  });

  test('a failed cart load can be retried', async ({ page, open, mocks }) => {
    await open('/');
    await addToCartFromPage(page, 'nft-1');
    await mocks.setScenario('offline');
    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: 'Não foi possível carregar seu carrinho' })).toBeVisible({ timeout: 20_000 });
    await mocks.setScenario('fast');
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(page.getByRole('list', { name: 'Itens do carrinho' })).toBeVisible();
  });

  test('buying while offline explains the failure and nothing is added; trying again works', async ({ page, open, mocks }) => {
    await open('/nft/nft-1');
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible(); // loaded, *then* the network goes
    await mocks.setScenario('offline');
    await page.getByRole('button', { name: 'COMPRAR' }).click();
    await expect(page.getByText(/Sem conexão/).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('link', { name: /^Carrinho/ })).toHaveAccessibleName('Carrinho, 0 itens');
    await mocks.setScenario('fast');
    await page.getByRole('button', { name: 'COMPRAR' }).click();
    await expect(page.getByRole('link', { name: /^Carrinho/ })).toHaveAccessibleName('Carrinho, 1 itens');
  });
});
