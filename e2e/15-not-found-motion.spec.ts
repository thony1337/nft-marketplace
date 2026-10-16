import { expect, test } from './fixtures';

test.describe('unknown addresses', () => {
  test('an address the app does not know says so and leads back to the catalog', async ({ page, open }) => {
    await open('/this/does/not/exist');
    await expect(page.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeVisible();
    await page.getByRole('link', { name: 'Voltar ao catálogo' }).click();
    await expect(page).toHaveURL(/\/(\?.*)?$/);
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toHaveCount(0);
  });
});

test.describe('skeleton motion', () => {
  const shimmer = (page: import('@playwright/test').Page) =>
    page.evaluate(() => {
      const el = document.querySelector('[aria-busy="true"] [data-slot="skeleton"]');
      return el ? getComputedStyle(el, '::after').animationName : 'no-skeleton';
    });

  test('the placeholder shimmers, and stands still when the user asks for less motion', async ({ page, open }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await open('/nft/nft-1', 'slow');
    await expect.poll(() => shimmer(page)).toBe('kurio-shimmer');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => shimmer(page)).toBe('none');
  });
});
