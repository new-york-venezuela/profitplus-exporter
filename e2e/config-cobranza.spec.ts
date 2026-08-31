import { test, expect } from './fixtures';

// The threshold lives in a singleton settings row (no per-test isolation),
// so tests that read/write it must not run concurrently with each other.
test.describe.configure({ mode: 'serial' });

test.describe('admin config-cobranza', () => {
  test('non-admin cannot access the page', async ({ userPage }) => {
    await userPage.goto('/admin/config-cobranza');
    await expect(userPage).toHaveURL('/reports/ventas');
  });

  test('sidebar link navigates admins to the page', async ({ adminPage }) => {
    await adminPage.goto('/reports/ventas');
    await adminPage.getByRole('link', { name: 'Config. Cobranza' }).click();
    await expect(adminPage).toHaveURL('/admin/config-cobranza');
    await expect(adminPage.getByRole('heading', { name: 'Configuración de Cobranza' })).toBeVisible();
  });

  test('shows the seeded default threshold', async ({ adminPage }) => {
    await adminPage.goto('/admin/config-cobranza');
    await expect(adminPage.getByLabel('Días de anticipación')).toHaveValue('3');
  });

  test('admin can update the threshold and it persists across reload', async ({ adminPage }) => {
    await adminPage.goto('/admin/config-cobranza');

    const input = adminPage.getByLabel('Días de anticipación');
    await input.fill('7');
    await adminPage.getByRole('button', { name: 'Guardar' }).click();

    await expect(adminPage.getByText('Guardado')).toBeVisible();

    await adminPage.reload();
    await expect(adminPage.getByLabel('Días de anticipación')).toHaveValue('7');

    // Restore the seeded default so other tests in this file stay order-independent.
    await adminPage.getByLabel('Días de anticipación').fill('3');
    await adminPage.getByRole('button', { name: 'Guardar' }).click();
    await expect(adminPage.getByText('Guardado')).toBeVisible();
  });

  test('rejects a non-positive threshold with a visible error', async ({ adminPage }) => {
    await adminPage.goto('/admin/config-cobranza');

    const valueBeforeAttempt = await adminPage.getByLabel('Días de anticipación').inputValue();

    const input = adminPage.getByLabel('Días de anticipación');
    await input.fill('0');
    await adminPage.getByRole('button', { name: 'Guardar' }).click();

    await expect(adminPage.getByText(/Ingresa un número entre/)).toBeVisible();

    // Rejected value must not have been persisted — reload shows whatever
    // was actually saved before this test ran, not the invalid "0".
    // (This spec's other tests run in parallel against the same singleton
    // settings row, so asserting a fixed baseline here would be racy.)
    await adminPage.reload();
    await expect(adminPage.getByLabel('Días de anticipación')).toHaveValue(valueBeforeAttempt);
  });

  test('rejects a threshold above the maximum with a visible error', async ({ adminPage }) => {
    await adminPage.goto('/admin/config-cobranza');

    const valueBeforeAttempt = await adminPage.getByLabel('Días de anticipación').inputValue();

    const input = adminPage.getByLabel('Días de anticipación');
    await input.fill('9999');
    await adminPage.getByRole('button', { name: 'Guardar' }).click();

    await expect(adminPage.getByText(/Ingresa un número entre/)).toBeVisible();

    await adminPage.reload();
    await expect(adminPage.getByLabel('Días de anticipación')).toHaveValue(valueBeforeAttempt);
  });

  test('"Guardado" confirmation clears once the field is edited again', async ({ adminPage }) => {
    await adminPage.goto('/admin/config-cobranza');

    const input = adminPage.getByLabel('Días de anticipación');
    const originalValue = await input.inputValue();

    await input.fill('5');
    await adminPage.getByRole('button', { name: 'Guardar' }).click();
    await expect(adminPage.getByText('Guardado')).toBeVisible();

    await input.fill('6');
    await expect(adminPage.getByText('Guardado')).not.toBeVisible();

    // Restore, keeping this spec order-independent.
    await input.fill(originalValue);
    await adminPage.getByRole('button', { name: 'Guardar' }).click();
    await expect(adminPage.getByText('Guardado')).toBeVisible();
  });

  test('shows an empty state for last run when the reminder job has never executed', async ({ adminPage }) => {
    await adminPage.goto('/admin/config-cobranza');
    await expect(adminPage.getByText('El recordatorio diario aún no se ha ejecutado.')).toBeVisible();
  });
});
