import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const cards = (page: Page) => page.locator('#catalogo a[href^="/nft/"]');
const count = async (page: Page) => Number(/(\d+)\s+resultado/.exec(await page.locator('#catalogo [aria-live="polite"]').innerText())?.[1]);
const prices = async (page: Page) =>
  (await cards(page).allInnerTexts()).map((t) => Number(/([\d.]+)\s*ETH/.exec(t)?.[1]));
const firstTitle = async (page: Page) => (await cards(page).first().getByRole('img').getAttribute('alt')) ?? '';

async function search(page: Page, term: string) {
  const box = page.getByRole('searchbox', { name: 'Buscar NFTs' });
  // the lupa opens and closes the field, and the field stays open after a search
  if (!(await box.isVisible())) await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await box.fill(term);
  await box.press('Enter');
}
// On phones the filters are a sheet, opened from the button beside the search field
async function openFilters(page: Page) {
  const aside = page.getByRole('complementary', { name: 'Filtros' });
  const opener = page.getByRole('button', { name: 'Filtros', exact: true });
  // the page may still be loading: wait for whichever of the two shows up (the aside on desktop, the button on phones)
  await expect(aside.or(opener)).toBeVisible();
  if (!(await aside.isVisible())) await opener.click();
  await expect(aside).toBeVisible();
  return aside;
}
async function goToPage(page: Page, n: number) {
  await page.getByRole('navigation', { name: 'Paginação' }).getByRole('button', { name: `Página ${n}`, exact: true }).click();
}
async function loaded(page: Page) {
  await expect(page.locator('#catalogo [aria-live="polite"]')).toBeVisible();
  await expect(cards(page).first()).toBeVisible();
}

test.describe('catalog', () => {
  test('search finds what was typed, keeps it in the URL, and says so when nothing matches', async ({ page, open }) => {
    await open('/');
    await loaded(page);
    const title = await firstTitle(page);

    await search(page, title);
    await expect(page).toHaveURL(/[?&]q=/);
    await expect(page.locator('#catalogo [aria-live="polite"]')).toContainText(`“${title}”`);
    expect(await count(page)).toBeGreaterThanOrEqual(1);
    for (const alt of await cards(page).getByRole('img').evaluateAll((els) => els.map((e) => e.getAttribute('alt') ?? ''))) {
      expect(alt.toLowerCase()).toContain(title.toLowerCase());
    }

    await search(page, 'zzzz-sem-resultado');
    await expect(page.getByText('Nenhum NFT encontrado para esses filtros.')).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
  });

  test('combined filters narrow the list, are written in the URL, and can be cleared', async ({ page, open }) => {
    await open('/');
    await loaded(page);
    const all = await count(page);

    const aside = await openFilters(page);
    const options = aside.getByRole('button', { pressed: false });
    await options.first().click(); // first collection
    await expect(page).toHaveURL(/collection=/);
    await expect(aside.getByRole('button', { pressed: true })).toHaveCount(1);
    const afterCollection = await count(page);
    expect(afterCollection).toBeLessThanOrEqual(all);

    await aside.getByRole('heading', { name: 'Rede' }).locator('xpath=following-sibling::ul[1]').getByRole('button').first().click();
    await expect(page).toHaveURL(/network=/);
    await expect(page).toHaveURL(/collection=/); // the first filter is still there
    await expect(aside.getByRole('button', { pressed: true })).toHaveCount(2);
    expect(await count(page)).toBeLessThanOrEqual(afterCollection);

    await aside.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(page).not.toHaveURL(/collection=|network=/);
    await expect.poll(() => count(page)).toBe(all);
    await expect(aside.getByRole('button', { name: 'Limpar filtros' })).toHaveCount(0);
  });

  test('each option shows how many NFTs it would list, and picking it agrees', async ({ page, open }) => {
    await open('/');
    await loaded(page);
    const aside = await openFilters(page);
    const first = aside.getByRole('button', { pressed: false }).first();
    const shown = Number(/\((\d+)\)/.exec(await first.innerText())?.[1]);
    expect(shown).toBeGreaterThan(0);
    await first.click();
    await expect(page).toHaveURL(/collection=/);
    await expect.poll(() => count(page)).toBe(shown);
  });

  test('the price sliders narrow the list once applied, and the range survives a refresh', async ({ page, open }) => {
    await open('/');
    await loaded(page);
    const aside = await openFilters(page);
    await aside.getByRole('slider', { name: 'Preço mínimo (ETH)' }).fill('100');
    await aside.getByRole('slider', { name: 'Preço máximo (ETH)' }).fill('300');
    await expect(aside.getByText('Preço: 1,00 - 3,00 ETH')).toBeVisible();
    await aside.getByRole('button', { name: 'Aplicar' }).click();
    await expect(page).toHaveURL(/minPrice=(%22)?1\.00/);
    await expect(page).toHaveURL(/maxPrice=(%22)?3\.00/);
    await expect.poll(async () => (await prices(page)).every((p) => p >= 1 && p <= 3)).toBe(true);
    await page.reload();
    await expect((await openFilters(page)).getByText('Preço: 1,00 - 3,00 ETH')).toBeVisible();
  });

  test('tabs and price range work from the URL and the list obeys them', async ({ page, open }) => {
    await open('/?minPrice=1&maxPrice=2');
    await loaded(page);
    for (const p of await prices(page)) {
      expect(p).toBeGreaterThanOrEqual(1);
      expect(p).toBeLessThanOrEqual(2);
    }
    const tabs = page.getByRole('tab');
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/tab=/);
  });

  test('sorting by price orders the cards, in both directions, and shows in the URL', async ({ page, open }) => {
    await open('/');
    await loaded(page);
    const sort = page.getByLabel('Ordenar por:');

    await sort.selectOption('price-asc');
    await expect(page).toHaveURL(/sort=price-asc/);
    await expect.poll(async () => { const p = await prices(page); return p.every((v, i) => i === 0 || v >= p[i - 1]); }).toBe(true);

    await sort.selectOption('price-desc');
    await expect(page).toHaveURL(/sort=price-desc/);
    await expect.poll(async () => { const p = await prices(page); return p.every((v, i) => i === 0 || v <= p[i - 1]); }).toBe(true);
  });

  test('pagination, and any filter change goes back to page 1', async ({ page, open }) => {
    await open('/');
    await loaded(page);
    const first = await firstTitle(page);

    await goToPage(page, 2);
    await expect(page).toHaveURL(/page=2/);
    await expect.poll(() => firstTitle(page)).not.toBe(first);

    await page.getByLabel('Ordenar por:').selectOption('price-asc');
    await expect(page).toHaveURL(/page=1/);
  });

  test('the browser history restores each state, and a shared URL opens the same state', async ({ page, open }) => {
    await open('/?sort=price-asc');
    await loaded(page);
    const pageOne = await firstTitle(page);

    await goToPage(page, 2);
    await expect(page).toHaveURL(/page=2/);
    const pageTwo = await firstTitle(page);

    await page.goBack();
    await expect(page).toHaveURL(/page=1/);
    await expect.poll(() => firstTitle(page)).toBe(pageOne);
    await page.goForward();
    await expect.poll(() => firstTitle(page)).toBe(pageTwo);

    await page.reload();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByLabel('Ordenar por:')).toHaveValue('price-asc');
    await expect.poll(() => firstTitle(page)).toBe(pageTwo);
  });

  test('an empty catalog and a failing one say so', async ({ page, open }) => {
    await open('/', 'empty');
    await expect(page.getByText('Nenhum NFT encontrado para esses filtros.')).toBeVisible();

    await open('/', 'server-error');
    await expect(page.getByRole('alert').filter({ hasText: 'Erro ao carregar o catálogo de NFTs.' })).toBeVisible({ timeout: 20_000 });
  });
});
