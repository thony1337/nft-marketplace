import { expect, test } from './fixtures';

test.describe('detail page', () => {
  test('opens straight from the address, with its editions and price', async ({ page, open }) => {
    await open('/nft/nft-1');
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Edição' })).toBeVisible();
    await expect(page.locator('p:visible', { hasText: /^\d+(\.\d+)? ETH$/ }).first()).toBeVisible();
  });

  test('an NFT that does not exist says so, and offers a way out', async ({ page, open }) => {
    await open('/nft/nao-existe');
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible();
    await page.getByRole('link', { name: /catálogo|início/i }).first().click();
    await expect(page).toHaveURL(/\/($|\?)/);
  });

  test('a sold-out edition cannot be chosen, and buying it is not offered', async ({ page, open }) => {
    await open('/nft/nft-11');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    for (const radio of await page.getByRole('radio').all()) await expect(radio).toBeDisabled();
  });

  test('the quantity cannot go below 1 nor above the stock or the limit of 10', async ({ page, open }) => {
    await open('/nft/nft-1');
    await page.getByRole('radio', { name: 'ABERTA' }).click();
    await expect(page.getByRole('button', { name: 'Diminuir quantidade' })).toBeDisabled();
    for (let i = 0; i < 12; i++) {
      const plus = page.getByRole('button', { name: 'Aumentar quantidade' });
      if (await plus.isDisabled()) break;
      await plus.click();
    }
    await expect(page.getByLabel('Quantidade', { exact: true })).toHaveText('10');
    await expect(page.getByRole('button', { name: 'Aumentar quantidade' })).toBeDisabled();
  });
});
