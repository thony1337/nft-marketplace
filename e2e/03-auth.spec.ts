import { DEMO, expect, OTHER, signInThroughDialog, test, signOut } from './fixtures';

test.describe('account', () => {
  test('signs up, lands signed in, and the session survives a refresh', async ({ page, open }) => {
    await open('/');
    await page.getByRole('button', { name: 'Entrar' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('tab', { name: 'Criar conta' }).click();
    await dialog.getByLabel('Nome').fill('Maria Teste');
    await dialog.getByLabel('E-mail').fill('maria@example.com');
    await dialog.getByLabel('Senha', { exact: true }).fill('Senha@123');
    await dialog.getByLabel('Confirmar senha').fill('Senha@123');
    await dialog.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Perfil de Maria Teste' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('link', { name: 'Perfil de Maria Teste' })).toBeVisible();
  });

  test('registration shows what is wrong, field by field, and refuses a taken e-mail', async ({ page, open }) => {
    await open('/');
    await page.getByRole('button', { name: 'Entrar' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('tab', { name: 'Criar conta' }).click();
    await dialog.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await expect(dialog.getByText('Informe seu nome')).toBeVisible();
    await dialog.getByLabel('Nome').fill('Ana');
    await dialog.getByLabel('E-mail').fill(DEMO.email);
    await dialog.getByLabel('Senha', { exact: true }).fill('curta');
    await dialog.getByLabel('Confirmar senha').fill('curta');
    await dialog.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await expect(dialog.getByText(/ao menos 8 caracteres/)).toBeVisible();
    await dialog.getByLabel('Senha', { exact: true }).fill('Senha@123');
    await dialog.getByLabel('Confirmar senha').fill('Outra@12345');
    await dialog.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await expect(dialog.getByText('As senhas não conferem')).toBeVisible();
    await dialog.getByLabel('Confirmar senha').fill('Senha@123');
    await dialog.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await expect(dialog.getByText(/já|cadastrad|existe/i).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /^Perfil de/ })).toHaveCount(0);
  });

  test('wrong credentials are explained and nothing is signed in', async ({ page, open }) => {
    await open('/');
    await page.getByRole('button', { name: 'Entrar' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('E-mail').fill(DEMO.email);
    await dialog.getByLabel('Senha').fill('Errada@123');
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test('logout clears the account from the screen, and the next visit is anonymous', async ({ page, open }) => {
    await open('/');
    await signInThroughDialog(page);
    await signOut(page);
    await expect(page.getByRole('button', { name: 'Entrar' }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole('link', { name: /^Perfil de/ })).toHaveCount(0);
  });

  test('an expired session is announced and asks for sign-in again', async ({ page, open, mocks }) => {
    await open('/');
    await signInThroughDialog(page);
    await mocks.expireSessions();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Entrar' }).first()).toBeVisible();
    await expect(page.getByText(/sessão expirou/i).first()).toBeVisible();
  });

  test('another user on the same browser sees none of the previous user\'s data', async ({ page, open }) => {
    await open('/nft/nft-1');
    await signInThroughDialog(page);
    await page.getByRole('button', { name: /Favoritar/ }).click();
    await expect(page.getByRole('button', { name: /Favoritado/ })).toBeVisible();
    await signOut(page);
    await signInThroughDialog(page, OTHER);
    await expect(page.getByRole('button', { name: /Favoritar/ })).toBeVisible();
    await page.goto('/profile');
    await page.getByRole('button', { name: 'Carteiras' }).click();
    await expect(page.getByRole('button', { name: 'Remover Carteira Principal' })).toBeVisible();
    await expect(page.getByText('MetaMask Principal')).toHaveCount(0);
  });
});
