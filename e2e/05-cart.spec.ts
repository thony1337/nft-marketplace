import { addToCartFromPage, cartLink, expect, signedIn, signInThroughDialog, test, signOut } from './fixtures';

test.describe('cart', () => {
  test('a visitor builds a cart, and it is still there after a refresh', async ({ page, open }) => {
    await open('/');
    await addToCartFromPage(page, 'nft-1', { times: 2 });
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 2 itens');
    await page.goto('/cart');
    await expect(page.getByRole('list', { name: 'Itens do carrinho' }).getByText('Emerald Ape #042')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('list', { name: 'Itens do carrinho' }).getByText('Emerald Ape #042')).toBeVisible();
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 2 itens');
  });

  test('changes the quantity and removes the item, with the totals following', async ({ page, open }) => {
    await open('/');
    await addToCartFromPage(page, 'nft-1');
    await page.goto('/cart');
    const total = page.getByLabel('Resumo do pedido').getByText('Total', { exact: true }).locator('xpath=following-sibling::dd');
    const before = await total.textContent();
    await page.getByRole('button', { name: 'Aumentar quantidade' }).click();
    await expect(page.getByRole('group', { name: /Quantidade de/ }).locator('output')).toHaveText('2');
    await expect(total).not.toHaveText(before!);
    await page.getByRole('button', { name: /^Remover / }).click();
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible();
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 0 itens');
  });

  test('coupons: unknown and expired are explained; a valid one discounts and can be removed', async ({ page, open }) => {
    await open('/');
    await addToCartFromPage(page, 'nft-1');
    await page.goto('/cart');
    const coupon = page.getByLabel('Código promocional');
    const apply = page.getByRole('button', { name: 'Aplicar' });
    const total = page.getByLabel('Resumo do pedido').getByText('Total', { exact: true }).locator('xpath=following-sibling::dd');
    const before = await total.textContent();

    await coupon.fill('NADA');
    await apply.click();
    await expect(page.getByText('Cupom inválido.')).toBeVisible();
    await coupon.fill('EXPIRADO20');
    await apply.click();
    await expect(page.getByText('Este cupom expirou.')).toBeVisible();

    await coupon.fill('kurio10');
    await apply.click();
    await expect(page.getByText('Desconto (KURIO10)')).toBeVisible();
    await expect(total).not.toHaveText(before!);
    await page.reload();
    await expect(page.getByText('Desconto (KURIO10)')).toBeVisible(); // kept by the server, not by the screen

    await page.getByRole('button', { name: 'Remover cupom KURIO10' }).click();
    await expect(page.getByText('Desconto (KURIO10)')).toHaveCount(0);
    await expect(total).toHaveText(before!);
  });

  test('the visitor\'s cart is merged into the account on sign-in, not lost', async ({ page, open }) => {
    await open('/');
    await addToCartFromPage(page, 'nft-1', { times: 2 });
    await page.goto('/');
    await signInThroughDialog(page);
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 2 itens');
    await page.reload();
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 2 itens');
  });

  test('a signed-in cart is not shown to the next user of the browser', async ({ page, open }) => {
    await open('/');
    await signedIn(page);
    await addToCartFromPage(page, 'nft-1');
    await signOut(page);
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 0 itens');
    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible();
  });

  test('stock lost after adding blocks the checkout and says how to fix it', async ({ page, open, mocks }) => {
    await open('/');
    await addToCartFromPage(page, 'nft-1', { times: 3 });
    await page.goto('/cart');
    await expect(page.getByRole('button', { name: 'Entrar para finalizar' })).toBeEnabled();
    await mocks.setEditionStock('nft-1', 'open', 1);
    await expect(page.getByText('Só restam 1. Reduza a quantidade para continuar.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar para finalizar' })).toBeDisabled();
    await page.getByRole('button', { name: 'Diminuir quantidade' }).click();
    await expect(page.getByRole('button', { name: 'Entrar para finalizar' })).toBeEnabled();
  });
});
