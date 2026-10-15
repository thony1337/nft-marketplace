import { addToCartFromPage, cartLink, expect, signInThroughDialog, test, signOut } from './fixtures';

test.describe('purchase', () => {
  test('from the catalog to a confirmed receipt', async ({ page, open }) => {
    await open('/');
    // the catalog → an NFT
    await page.getByRole('link', { name: /Emerald Ape #042/ }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible();
    await page.getByRole('radio', { name: 'ABERTA' }).click();
    await page.getByRole('button', { name: 'Aumentar quantidade' }).click();
    await page.getByRole('button', { name: 'COMPRAR' }).click();
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 2 itens');

    // the cart → sign in on the way → the checkout
    await page.getByRole('link', { name: /^Carrinho/ }).click();
    await expect(page.getByRole('list', { name: 'Itens do carrinho' })).toBeVisible();
    await page.getByRole('button', { name: 'Entrar para finalizar' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('E-mail').fill('anthony@example.com');
    await dialog.getByLabel('Senha').fill('Senha@123');
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.getByRole('button', { name: 'Finalizar compra' }).click();

    await expect(page.getByRole('heading', { name: 'Finalizar compra' })).toBeVisible();
    await expect(page.getByRole('radio', { name: /MetaMask Principal/ })).toBeChecked(); // the primary one
    const total = await page.getByLabel('Resumo do pedido').getByText('Total', { exact: true }).locator('xpath=following-sibling::dd').textContent();
    await page.getByRole('button', { name: 'Confirmar compra' }).click();

    // receipt
    await expect(page.getByRole('heading', { name: 'Compra confirmada' })).toBeVisible();
    const receipt = page.getByLabel('Comprovante');
    await expect(receipt.getByText('Emerald Ape #042')).toBeVisible();
    await expect(receipt.getByText(/2 × /)).toBeVisible();
    await expect(receipt.getByText('Total', { exact: true }).locator('xpath=following-sibling::dd')).toHaveText(total!);
    await expect(page).toHaveURL(/\/orders\/ord_\d+/);

    // the cart was used up
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 0 itens');
    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible();
  });

  test('the receipt survives a refresh and keeps its values when the price moves later', async ({ page, open, mocks }) => {
    await open('/');
    await signInThroughDialog(page);
    await addToCartFromPage(page, 'nft-1');
    await page.goto('/checkout');
    await page.getByRole('button', { name: 'Confirmar compra' }).click();
    await expect(page.getByRole('heading', { name: 'Compra confirmada' })).toBeVisible();
    const before = await page.getByLabel('Comprovante').innerText();
    await mocks.setPrice('nft-1', '7.77');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Compra confirmada' })).toBeVisible();
    expect(await page.getByLabel('Comprovante').innerText()).toBe(before);
    expect(before).not.toContain('7.77');
  });

  test('a visitor reaching the checkout is asked to sign in, and the cart is kept', async ({ page, open }) => {
    await open('/');
    await addToCartFromPage(page, 'nft-1');
    await page.goto('/checkout');
    await expect(page.getByRole('heading', { name: 'Entre para finalizar a compra' })).toBeVisible();
    await expect(page.getByText('Seu carrinho continua guardado.')).toBeVisible();
  });

  test('another user cannot open someone else\'s receipt', async ({ page, open }) => {
    await open('/');
    await signInThroughDialog(page);
    await addToCartFromPage(page, 'nft-1');
    await page.goto('/checkout');
    await page.getByRole('button', { name: 'Confirmar compra' }).click();
    await expect(page.getByRole('heading', { name: 'Compra confirmada' })).toBeVisible();
    const address = page.url();
    await signOut(page);
    await signInThroughDialog(page, { email: 'collector@example.com', password: 'Senha@123', name: 'CryptoCollector' });
    await page.goto(new URL(address).pathname);
    await expect(page.getByRole('heading', { name: 'Pedido não encontrado' })).toBeVisible();
  });
});
