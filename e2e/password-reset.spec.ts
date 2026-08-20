import { test, expect, submitReliably } from './fixtures';
import { clearMailhog, waitForResetEmail } from './helpers/mailhog';

test.describe('forgot password', () => {
  test.beforeEach(async () => {
    await clearMailhog();
  });

  test('shows confirmation message after submitting a known email', async ({ page }) => {
    await page.goto('/forgot-password');
    await submitReliably(page, async () => {
      const emailField = page.getByLabel('Correo electrónico');
      await emailField.fill('user@e2e.test');
      await expect(emailField).toHaveValue('user@e2e.test');
      await page.getByRole('button', { name: 'Enviar instrucciones' }).click();
    });

    await expect(page.getByText(/Si el correo existe en nuestro sistema/)).toBeVisible();
  });

  test('full flow: request reset, follow emailed link, set new password, log in', async ({ page }) => {
    await page.goto('/forgot-password');
    await submitReliably(page, async () => {
      const emailField = page.getByLabel('Correo electrónico');
      await emailField.fill('reset-flow@e2e.test');
      await expect(emailField).toHaveValue('reset-flow@e2e.test');
      await page.getByRole('button', { name: 'Enviar instrucciones' }).click();
    });
    await expect(page.getByText(/Si el correo existe en nuestro sistema/)).toBeVisible();

    const { resetUrl } = await waitForResetEmail('reset-flow@e2e.test');
    await page.goto(resetUrl);

    await expect(page.getByLabel('Nueva contraseña')).toBeVisible();
    await submitReliably(page, async () => {
      const newPasswordField = page.getByLabel('Nueva contraseña');
      const confirmPasswordField = page.getByLabel('Confirmar contraseña');
      await newPasswordField.fill('NewPass456!');
      await expect(newPasswordField).toHaveValue('NewPass456!');
      await confirmPasswordField.fill('NewPass456!');
      await expect(confirmPasswordField).toHaveValue('NewPass456!');
      await page.getByRole('button', { name: 'Restablecer contraseña' }).click();
    });

    await expect(page.getByText('Tu contraseña ha sido restablecida correctamente.')).toBeVisible();

    await page.getByRole('link', { name: 'Iniciar sesión' }).click();
    await submitReliably(page, async () => {
      const emailField = page.getByLabel('Correo electrónico');
      const passwordField = page.getByLabel('Contraseña', { exact: true });
      await emailField.fill('reset-flow@e2e.test');
      await expect(emailField).toHaveValue('reset-flow@e2e.test');
      await passwordField.fill('NewPass456!');
      await expect(passwordField).toHaveValue('NewPass456!');
      await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    });
    await expect(page).toHaveURL('/reports/ventas');
  });

  test('invalid token shows an error state', async ({ page }) => {
    await page.goto('/password-reset?token=not-a-real-token');
    await expect(page.getByText('Este enlace de restablecimiento es inválido o ha expirado.')).toBeVisible();
  });
});
