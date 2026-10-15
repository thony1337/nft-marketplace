import { addToCartFromPage, expect, signedIn, test } from './fixtures';
import type { Page } from '@playwright/test';

async function toCheckout(page: Page, open: (path?: string) => Promise<void>) {
  await open('/');
  await signedIn(page);
  await addToCartFromPage(page, 'nft-1');
  await page.goto('/checkout');
  await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled();
}

test.describe('checkout: collector data', () => {
  test('comes filled from the account and the chosen wallet, and follows the wallet', async ({ page, open }) => {
    await toCheckout(page, open);
    await expect(page.getByLabel('Nome de exibição')).toHaveValue('Anthony Silva');
    await expect(page.getByLabel('E-mail')).toHaveValue('anthony@example.com');
    await expect(page.getByLabel('Rede')).toHaveValue('ethereum');
    await expect(page.getByLabel('Endereço da carteira')).toHaveValue(/^0x71C7/);

    await page.getByRole('radio', { name: /Coinbase Vault/ }).check();
    await expect(page.getByLabel('Rede')).toHaveValue('polygon');
    await expect(page.getByLabel('Tipo de carteira')).toHaveValue('coinbase');
    await expect(page.getByLabel('Endereço da carteira')).toHaveValue(/^0x94B2/);
  });

  test('a wrong field stops the purchase, is explained on the field, and takes the focus', async ({ page, open }) => {
    await toCheckout(page, open);
    const username = page.getByLabel('Nome de usuário');
    await username.fill('A!');
    await page.getByLabel('E-mail').fill('not-an-email');
    await page.getByRole('button', { name: 'Confirmar compra' }).click();

    await expect(page.getByText('Use de 3 a 20 letras minúsculas, números ou _')).toBeVisible();
    await expect(page.getByText('E-mail inválido')).toBeVisible();
    await expect(username).toBeFocused();
    await expect(username).toHaveAttribute('aria-invalid', 'true');
    await expect(page).toHaveURL(/\/checkout/); // nothing was sent: still here, no order

    await username.fill('anthony_s');
    await page.getByLabel('E-mail').fill('anthony@example.com');
    await page.getByRole('button', { name: 'Confirmar compra' }).click();
    await expect(page).toHaveURL(/\/orders\//);
  });

  test('another receiving wallet is validated, and the receipt says who bought and where it goes', async ({ page, open }) => {
    await toCheckout(page, open);
    await page.getByLabel('Usar outra carteira?').check();
    await page.getByLabel('Endereço da carteira').fill('0x123');
    await page.getByLabel('Rede').selectOption('polygon');
    await page.getByLabel('Tipo de carteira').selectOption('other');
    await page.getByRole('button', { name: 'Confirmar compra' }).click();
    await expect(page.getByText(/Endereço inválido/)).toBeVisible();

    const other = '0x1234567890abcdef1234567890abcdef12345678';
    await page.getByLabel('Endereço da carteira').fill(other);
    await page.getByRole('button', { name: 'Confirmar compra' }).click();
    await expect(page.getByRole('heading', { name: /Processando pagamento|Compra confirmada/ })).toBeVisible();
    const receipt = page.getByLabel('Comprovante');
    await expect(receipt.getByText('Anthony Silva (@anthonysilva)')).toBeVisible();
    await expect(receipt.getByText('0x1234…5678')).toBeVisible();
  });
});
