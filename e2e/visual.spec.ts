import { addToCartFromPage, expect, signedIn, test } from './fixtures';
import type { Page } from '@playwright/test';

// Visual regression of the four main screens at 390, 768 and 1440 px (one project per width).
// Stable data: the mock database always starts from its seed, latency is off, the clock is frozen,
// toasts are masked, and motion is disabled. Baselines are committed (npx playwright test --update-snapshots).
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-03-10T12:00:00-03:00'));
});

async function settled(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  // lazy images below the fold would never load in a screenshot of the whole page: load them now
  await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((img) => ((img as HTMLImageElement).loading = 'eager')));
  await page.waitForFunction(() => [...document.images].every((img) => img.complete));
  const broken = await page.evaluate(() => [...document.images].filter((img) => img.naturalWidth === 0).map((img) => img.src));
  expect(broken, 'images that failed to load').toEqual([]);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}
const shot = (page: Page, name: string) =>
  expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, mask: [page.locator('[data-sonner-toaster]')] });

test.describe('visual regression', () => {
  test('home', async ({ page, open }) => {
    await open('/');
    await expect(page.getByRole('link', { name: /Emerald Ape #042/ }).first()).toBeVisible();
    await settled(page);
    await shot(page, 'home');
  });

  test('NFT detail', async ({ page, open }) => {
    await open('/nft/nft-1');
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible();
    await settled(page);
    await shot(page, 'detail');
  });

  test('cart with a coupon applied', async ({ page, open }) => {
    await open('/');
    await addToCartFromPage(page, 'nft-1', { times: 2 });
    await page.goto('/cart');
    await page.getByLabel('Código promocional').fill('KURIO10');
    await page.getByRole('button', { name: 'Aplicar' }).click();
    await expect(page.getByText('Desconto (KURIO10)')).toBeVisible();
    await settled(page);
    await shot(page, 'cart');
  });

  test('checkout', async ({ page, open }) => {
    await open('/');
    await signedIn(page);
    await addToCartFromPage(page, 'nft-1', { times: 2 });
    await page.goto('/checkout');
    await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled();
    await settled(page);
    await shot(page, 'checkout');
  });

  test('no horizontal scroll at this width on the main screens', async ({ page, open }) => {
    await open('/');
    await signedIn(page);
    await addToCartFromPage(page, 'nft-1');
    for (const path of ['/', '/nft/nft-1', '/cart', '/checkout', '/profile']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(0);
    }
  });
});
