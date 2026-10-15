import { addToCartFromPage, cartLink, expect, signedIn, test } from './fixtures';

async function readyToPay(page: import('@playwright/test').Page, open: (p?: string, s?: string) => Promise<void>, times = 1) {
  await open('/');
  await signedIn(page);
  await addToCartFromPage(page, 'nft-1', { times });
  await page.goto('/checkout');
  await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled();
}

test.describe('payment failures', () => {
  test('a declined payment says so, and the cart is exactly as it was', async ({ page, open, mocks }) => {
    await readyToPay(page, open, 2);
    await mocks.setScenario('payment-declined');
    await page.getByRole('button', { name: 'Confirmar compra' }).click();
    await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible();
    await expect(page.getByText('Pagamento recusado pela carteira.')).toBeVisible();
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 2 itens');
    await page.getByRole('link', { name: 'Voltar ao carrinho' }).click();
    await expect(page.getByRole('list', { name: 'Itens do carrinho' }).getByText('Emerald Ape #042')).toBeVisible();
  });

  test('a repeated click creates one order, not two', async ({ page, open, mocks }) => {
    await readyToPay(page, open);
    await mocks.setScenario('default'); // a little latency: the second click lands while the first is in flight
    await page.getByRole('button', { name: 'Confirmar compra' }).dblclick();
    await expect(page.getByRole('heading', { name: /Processando pagamento|Compra confirmada/ })).toBeVisible();
    await mocks.settleOrders();
    await expect(page.getByRole('heading', { name: 'Compra confirmada' })).toBeVisible();
    expect(await mocks.orders()).toHaveLength(1);
  });

  test('the answer never arrives: the user can recover the same order instead of creating another', async ({ page, open, mocks }) => {
    test.setTimeout(60_000);
    await readyToPay(page, open);
    await mocks.setScenario('order-timeout'); // the order is created and paid, the reply is lost
    await page.getByRole('button', { name: 'Confirmar compra' }).click();
    // the payment finishes and uses the cart up: the page must not strand the user on an empty cart
    await expect(page.getByRole('heading', { name: 'Sua compra pode ter sido concluída' })).toBeVisible({ timeout: 20_000 });
    const created = await mocks.orders();
    expect(created).toHaveLength(1);

    await mocks.setScenario('default');
    await page.getByRole('button', { name: 'Ver meu pedido' }).click();
    await expect(page).toHaveURL(new RegExp(`/orders/${created[0].id}$`));
    await expect(page.getByRole('heading', { name: 'Compra confirmada' })).toBeVisible();
    const after = await mocks.orders();
    expect(after).toHaveLength(1); // still one
    expect(after[0].idempotencyKey).toBe(created[0].idempotencyKey);
  });

  test('after a refresh in the middle of that, the unfinished purchase is recovered too', async ({ page, open, mocks }) => {
    test.setTimeout(60_000);
    await readyToPay(page, open);
    await mocks.setScenario('order-timeout');
    await page.getByRole('button', { name: 'Confirmar compra' }).click();
    await expect(page.getByRole('heading', { name: 'Sua compra pode ter sido concluída' })).toBeVisible({ timeout: 20_000 });
    await mocks.setScenario('default');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Sua compra pode ter sido concluída' })).toBeVisible();
    await page.getByRole('button', { name: 'Ver meu pedido' }).click();
    await expect(page).toHaveURL(/\/orders\/ord_\d+$/);
    expect(await mocks.orders()).toHaveLength(1);
  });

  test('the price moves just as the purchase is confirmed: nothing is bought until the user confirms the new total', async ({ page, open, mocks }) => {
    await readyToPay(page, open);
    const total = page.getByLabel('Resumo do pedido').getByText('Total', { exact: true }).locator('xpath=following-sibling::dd');
    const before = await total.textContent();
    await mocks.setScenario('purchase-price-change');
    await page.getByRole('button', { name: 'Confirmar compra' }).click();
    await expect(page.getByText(/Os valores mudaram\. Revise o resumo abaixo e confirmar novamente|Os valores mudaram/)).toBeVisible();
    expect(await mocks.orders()).toHaveLength(0);
    await expect(total).not.toHaveText(before!);
    await page.getByRole('button', { name: 'Confirmar compra' }).click();
    await expect(page.getByRole('heading', { name: /Processando pagamento|Compra confirmada/ })).toBeVisible();
    expect(await mocks.orders()).toHaveLength(1);
  });

  test('the item sells out as the purchase is confirmed: it is blocked and explained', async ({ page, open, mocks }) => {
    await readyToPay(page, open);
    await mocks.setScenario('purchase-sold-out');
    await page.getByRole('button', { name: 'Confirmar compra' }).click();
    await expect(page.getByText(/Um item ficou sem estoque/)).toBeVisible();
    expect(await mocks.orders()).toHaveLength(0);
    await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeDisabled();
    await expect(page.getByRole('link', { name: 'Ajuste o carrinho' })).toBeVisible();
  });
});
