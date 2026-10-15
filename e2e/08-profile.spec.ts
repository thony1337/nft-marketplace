import { expect, signedIn, test, DEMO, signOut } from './fixtures';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const ADDRESS = '0x1234567890abcdef1234567890ABCDEF12345678';

test.describe('profile', () => {
  test.beforeEach(async ({ page, open }) => {
    await open('/');
    await signedIn(page);
    await page.goto('/profile');
    await expect(page.getByRole('heading', { level: 1, name: 'Meu perfil' })).toBeVisible();
  });

  test('a visitor is asked to sign in', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/profile?mockScenario=fast');
    await expect(page.getByRole('heading', { name: 'Entre para ver seu perfil' })).toBeVisible();
    await context.close();
  });

  test('changes the name (validated first) and the header follows', async ({ page }) => {
    const name = page.getByLabel('Nome de exibição');
    const save = page.getByRole('button', { name: 'Salvar', exact: true });
    await name.fill('A');
    await save.click();
    await expect(page.getByText('Informe seu nome')).toBeVisible();
    await name.fill('Anthony Martins');
    await save.click();
    await expect(page.getByRole('link', { name: 'Perfil de Anthony Martins' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('link', { name: 'Perfil de Anthony Martins' })).toBeVisible();
    await expect(page.getByLabel('E-mail')).toHaveAttribute('readonly', '');
  });

  test('avatar: a valid image is shown and can be removed; a big file or a wrong type is refused', async ({ page }) => {
    const input = page.getByLabel('Escolher foto');
    await input.setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: Buffer.alloc(151 * 1024) });
    await expect(page.getByText('A imagem deve ter até 150 KB.')).toBeVisible();
    await input.setInputFiles({ name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('oi') });
    await expect(page.getByText('Use uma imagem PNG, JPG ou WebP.')).toBeVisible();

    await input.setInputFiles({ name: 'ok.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByAltText(`Foto de ${DEMO.name}`)).toBeVisible();
    await page.reload();
    await expect(page.getByAltText(`Foto de ${DEMO.name}`)).toBeVisible();
    await page.getByRole('button', { name: 'Remover foto' }).click();
    await expect(page.getByAltText(`Foto de ${DEMO.name}`)).toHaveCount(0);
  });

  test('password: each mistake is explained on its field; the right change works and keeps this session', async ({ page }) => {
    const current = page.getByLabel('Senha atual');
    const next = page.getByLabel('Nova senha', { exact: true });
    const confirm = page.getByLabel('Confirmar nova senha');
    const submit = page.getByRole('button', { name: 'Salvar', exact: true });

    await current.fill('Errada@123'); await next.fill('Nova@12345'); await confirm.fill('Nova@12345');
    await submit.click();
    await expect(page.getByText('A senha atual está incorreta')).toBeVisible();
    await expect(current).toHaveAttribute('aria-invalid', 'true');

    await current.fill('Senha@123'); await next.fill('Nova@12345'); await confirm.fill('Outra@12345');
    await submit.click();
    await expect(page.getByText('As senhas não conferem')).toBeVisible();

    await next.fill('curta'); await confirm.fill('curta');
    await submit.click();
    await expect(page.getByText(/ao menos 8 caracteres/)).toBeVisible();

    await next.fill('Nova@12345'); await confirm.fill('Nova@12345');
    await submit.click();
    await expect(page.getByText(/Senha alterada/)).toBeVisible();
    await expect(current).toHaveValue('');
    await expect(page.getByRole('link', { name: `Perfil de ${DEMO.name}` })).toBeVisible();

    // the new password is the one that works now
    await signOut(page);
    await page.getByRole('button', { name: 'Entrar' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('E-mail').fill(DEMO.email);
    await dialog.getByLabel('Senha').fill('Senha@123');
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await dialog.getByLabel('Senha').fill('Nova@12345');
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('link', { name: `Perfil de ${DEMO.name}` })).toBeVisible();
  });

  test('wallets: register (with validation), make primary, rename, remove with confirmation', async ({ page }) => {
    await page.getByRole('button', { name: 'Carteiras' }).click();
    const list = page.getByRole('region', { name: 'Suas carteiras' });
    const form = page.getByRole('form', { name: 'Cadastrar carteira' });
    await expect(list.getByText('MetaMask Principal')).toBeVisible();

    await form.getByLabel('Apelido da carteira').fill('Ledger');
    await form.getByLabel('Endereço da carteira').fill('0x123');
    await form.getByRole('button', { name: 'Salvar carteira' }).click();
    await expect(page.getByText(/Endereço inválido/)).toBeVisible();
    await form.getByLabel('Endereço da carteira').fill(ADDRESS);
    await form.getByLabel('Rede').selectOption('polygon');
    await form.getByRole('button', { name: 'Salvar carteira' }).click();
    await expect(list.getByText('Ledger')).toBeVisible();

    await form.getByLabel('Apelido da carteira').fill('Outra');
    await form.getByLabel('Endereço da carteira').fill(ADDRESS);
    await form.getByRole('button', { name: 'Salvar carteira' }).click();
    await expect(page.getByText('Esta carteira já está cadastrada')).toBeVisible();

    await page.getByRole('button', { name: 'Tornar Ledger a carteira principal' }).click();
    await expect(page.getByRole('button', { name: 'Tornar MetaMask Principal a carteira principal' })).toBeVisible();

    await page.getByRole('button', { name: 'Renomear Ledger' }).click();
    await page.getByLabel('Nome da carteira').fill('Cofre');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(list.getByText('Cofre')).toBeVisible();

    await page.getByRole('button', { name: 'Remover Cofre' }).click();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(list.getByText('Cofre')).toBeVisible();
    await page.getByRole('button', { name: 'Remover Cofre' }).click();
    await page.getByRole('button', { name: 'Confirmar remoção de Cofre' }).click();
    await expect(list.getByText('Cofre')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('region', { name: 'Suas carteiras' }).getByText('MetaMask Principal')).toBeVisible();
  });
});
