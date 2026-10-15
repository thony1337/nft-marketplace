import { expect, signInThroughDialog, test } from './fixtures';

const heart = (page: import('@playwright/test').Page) => page.getByRole('button', { name: /^Favoritar$|^Favoritado$/ });

test.describe('favorites', () => {
  test('a visitor is asked to sign in instead of favoriting', async ({ page, open }) => {
    await open('/nft/nft-1');
    await heart(page).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('favoriting flips the heart at once and is kept after a refresh', async ({ page, open }) => {
    await open('/nft/nft-1');
    await signInThroughDialog(page);
    await heart(page).click();
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'true');
    await heart(page).click();
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'false');
    await page.reload();
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'false');
  });

  test('when the server refuses, the heart goes back and the user is told; trying again works', async ({ page, open, mocks }) => {
    await open('/nft/nft-1');
    await signInThroughDialog(page);
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'false');

    await mocks.setScenario('favorites-error');
    await heart(page).click();
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'true'); // optimistic
    await expect(page.getByText(/Não foi possível favoritar/)).toBeVisible();
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'false'); // rolled back

    await mocks.setScenario('fast');
    await heart(page).click();
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'true'); // the server really has it
  });

  test('a failed removal brings the favorite back', async ({ page, open, mocks }) => {
    await open('/nft/nft-1');
    await signInThroughDialog(page);
    await heart(page).click();
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'true'); // favorites loaded before we act
    await mocks.setScenario('favorites-error');
    await heart(page).click();
    await expect(page.getByText(/Não foi possível remover/)).toBeVisible();
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'true');
  });
});
