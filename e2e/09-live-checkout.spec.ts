import { addToCartFromPage, expect, signedIn, test } from './fixtures';

const total = (page: import('@playwright/test').Page) =>
  page.getByLabel('Resumo do pedido').getByText('Total', { exact: true }).locator('xpath=following-sibling::dd');

test.describe('live changes during checkout (Socket.IO)', () => {
  test.beforeEach(async ({ page, open, mocks }) => {
    await open('/');
    await signedIn(page);
    await addToCartFromPage(page, 'nft-1', { times: 2 });
    await page.goto('/checkout');
    await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled();
    await expect.poll(() => mocks.socketCount()).toBeGreaterThan(0);
  });

  test('a price change reaches the open checkout without a reload, and the purchase uses the new total', async ({ page, mocks }) => {
    const before = await total(page).textContent();
    await mocks.setPrice('nft-1', '9.9');
    await expect(total(page)).not.toHaveText(before!);
    await expect(page.getByText('19.8 ETH').first()).toBeVisible(); // 2 × 9.9

    await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled();
    const shown = await total(page).textContent();
    await page.getByRole('button', { name: 'Confirmar compra' }).click();
    await expect(page.getByRole('heading', { name: 'Compra confirmada' })).toBeVisible();
    await expect(page.getByLabel('Comprovante').getByText('Total', { exact: true }).locator('xpath=following-sibling::dd')).toHaveText(shown!);
  });

  test('stock running out blocks the purchase on screen, and says why', async ({ page, mocks }) => {
    await mocks.setEditionStock('nft-1', 'open', 0);
    await expect(page.getByText('Estoque insuficiente para esta quantidade.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeDisabled();
    await expect(page.getByRole('link', { name: 'Ajuste o carrinho' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Compra confirmada' })).toHaveCount(0);
  });

  test('a price change that arrives while the confirmation is in flight does not buy at the old total', async ({ page, mocks }) => {
    await mocks.setScenario('slow');
    const old = await total(page).textContent();
    await page.getByRole('button', { name: 'Confirmar compra' }).click();
    await mocks.setPrice('nft-1', '5');
    await expect(page.getByText(/Os valores mudaram/)).toBeVisible({ timeout: 20_000 });
    expect(await mocks.orders()).toHaveLength(0);
    await expect(total(page)).not.toHaveText(old!);
  });
});
