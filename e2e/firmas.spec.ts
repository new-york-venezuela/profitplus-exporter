import { test, expect } from './fixtures';

test.describe('firmas (signature generator)', () => {
  test('editing the full name updates the live preview', async ({ userPage }) => {
    await userPage.goto('/firmas');

    const preview = userPage.locator('h2:has-text("Vista Previa")').locator('..');

    await expect(preview.getByText('Eugenio Doñaque')).toBeVisible();

    await userPage.getByLabel('Nombre Completo').fill('Jane Doe');

    await expect(preview.getByText('Jane Doe')).toBeVisible();
    await expect(preview.getByText('Eugenio Doñaque')).not.toBeVisible();
  });

  test('toggling WhatsApp shows the WhatsApp field and preview line', async ({ userPage }) => {
    await userPage.goto('/firmas');

    await expect(userPage.getByPlaceholder('+58 000 000 0000')).not.toBeVisible();

    await userPage.getByLabel('Incluir número de WhatsApp (WA)').check();

    await expect(userPage.getByPlaceholder('+58 000 000 0000')).toBeVisible();
  });

  test('copy HTML button shows a confirmation message', async ({ userPage, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await userPage.goto('/firmas');

    await userPage.getByRole('button', { name: /Copiar Código HTML Bruto/ }).click();

    await expect(userPage.getByText('¡Código HTML copiado!')).toBeVisible();
  });
});
