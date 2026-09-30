import { test, expect } from './fixtures';

test.describe('qr codes', () => {
  test('sidebar links to /qr next to Firma Corporativa', async ({ userPage }) => {
    await userPage.goto('/firmas');
    await userPage.getByRole('link', { name: 'Códigos QR' }).click();
    await expect(userPage).toHaveURL('/qr');
  });

  test('create, list, edit and delete a saved QR', async ({ userPage }) => {
    await userPage.goto('/qr');
    await expect(userPage.getByAltText('Vista previa del código QR')).not.toBeVisible();

    await userPage.getByLabel('Nombre', { exact: true }).fill('E2E QR');
    await userPage.getByLabel('Contenido (URL o texto)').fill('https://example.com/e2e');
    await expect(userPage.getByAltText('Vista previa del código QR')).toBeVisible();

    await userPage.getByRole('button', { name: 'Guardar' }).click();
    const list = userPage.getByRole('list', { name: 'Mis códigos QR' });
    await expect(list.getByText('E2E QR')).toBeVisible();

    await list.getByRole('button', { name: 'Editar' }).click();
    await userPage.getByLabel('Nombre', { exact: true }).fill('E2E QR renamed');
    await userPage.getByRole('button', { name: 'Actualizar' }).click();
    await expect(list.getByText('E2E QR renamed')).toBeVisible();

    userPage.once('dialog', d => d.accept());
    await list.getByRole('button', { name: 'Eliminar' }).click();
    await expect(userPage.getByText('Aún no has guardado ningún código QR.')).toBeVisible();
  });
});
