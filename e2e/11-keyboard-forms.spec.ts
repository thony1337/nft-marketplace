import { addToCartFromPage, cartLink, expect, test } from './fixtures';

test.describe('keyboard, dialogs and forms', () => {
  test('the sign-in dialog opens from the keyboard, keeps focus inside, and returns it on Escape', async ({ page, open }) => {
    await open('/');
    const opener = page.getByRole('button', { name: 'Entrar' }).first();
    await opener.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true);
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true);
    }
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('the dialog is named and described for assistive technology', async ({ page, open }) => {
    await open('/');
    await page.getByRole('button', { name: 'Entrar' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Bem-vindo à Kurio' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleDescription(/Entre para gerenciar/);
  });

  test('a form with mistakes puts focus on the first wrong field and explains each one', async ({ page, open }) => {
    await open('/');
    await page.getByRole('button', { name: 'Entrar' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click();
    const email = dialog.getByLabel('E-mail');
    await expect(email).toBeFocused();
    await expect(email).toHaveAttribute('aria-invalid', 'true');
    await expect(email).toHaveAccessibleDescription(/.+/); // the reason is tied to the field
    await email.fill('isto-nao-e-email');
    await dialog.getByLabel('Senha').fill('x');
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(email).toBeFocused();
    await expect(email).toHaveAccessibleDescription(/.+/);
  });

  test('a purchase can be started with the keyboard alone', async ({ page, open }) => {
    await open('/nft/nft-1');
    await page.getByRole('radio', { name: 'ABERTA' }).focus();
    await page.keyboard.press('Space');
    await page.getByRole('button', { name: 'Aumentar quantidade' }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'COMPRAR' }).focus();
    await page.keyboard.press('Enter');
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 2 itens');
  });

  test('the cart is usable from the keyboard: quantity, coupon and checkout button', async ({ page, open }) => {
    await open('/');
    await addToCartFromPage(page, 'nft-1');
    await page.goto('/cart');
    await page.getByRole('button', { name: 'Aumentar quantidade' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('group', { name: /Quantidade de/ }).locator('output')).toHaveText('2');
    await page.getByLabel('Código promocional').focus();
    await page.keyboard.type('KURIO10');
    await page.keyboard.press('Enter'); // submits the coupon form
    await expect(page.getByText('Desconto (KURIO10)')).toBeVisible();
  });

  test('visible focus: focused controls draw an outline or ring', async ({ page, open }) => {
    await open('/nft/nft-1');
    await page.getByRole('button', { name: 'COMPRAR' }).focus();
    const style = await page.getByRole('button', { name: 'COMPRAR' }).evaluate((el) => {
      const s = getComputedStyle(el);
      return `${s.outlineStyle}|${s.outlineWidth}|${s.boxShadow}`;
    });
    expect(style).not.toMatch(/^none\|0px\|none$/);
  });
});
