import { test, expect } from './fixtures';

test.describe('admin user management', () => {
  test('non-admin cannot access the users page', async ({ userPage }) => {
    await userPage.goto('/admin/users');
    await expect(userPage).toHaveURL('/reports/ventas');
  });

  test('admin can view the seeded users', async ({ adminPage }) => {
    await adminPage.goto('/admin/users');
    await expect(adminPage.getByRole('cell', { name: 'E2E Admin' })).toBeVisible();
    await expect(adminPage.getByRole('cell', { name: 'E2E User' })).toBeVisible();
  });

  test('admin can create a new user and it appears in the list', async ({ adminPage }) => {
    await adminPage.goto('/admin/users');
    await adminPage.getByRole('button', { name: '+ Crear usuario' }).click();

    await adminPage.getByLabel('Nombre').fill('Created By Test');
    await adminPage.getByLabel('Email').fill('created-by-test@e2e.test');
    await adminPage.getByLabel('Contraseña').fill('CreatedPass123!');
    await adminPage.getByLabel('Rol').selectOption('user');
    await adminPage.getByRole('button', { name: 'Crear', exact: true }).click();

    await expect(adminPage.getByRole('cell', { name: 'Created By Test' })).toBeVisible();
  });

  test('admin can delete a user', async ({ adminPage }) => {
    await adminPage.goto('/admin/users');
    await adminPage.getByRole('button', { name: '+ Crear usuario' }).click();
    await adminPage.getByLabel('Nombre').fill('To Be Deleted');
    await adminPage.getByLabel('Email').fill('to-be-deleted@e2e.test');
    await adminPage.getByLabel('Contraseña').fill('DeletePass123!');
    await adminPage.getByLabel('Rol').selectOption('user');
    await adminPage.getByRole('button', { name: 'Crear', exact: true }).click();
    await expect(adminPage.getByRole('cell', { name: 'To Be Deleted' })).toBeVisible();

    const row = adminPage.getByRole('row', { name: /To Be Deleted/ });
    adminPage.once('dialog', dialog => dialog.accept());
    await row.getByRole('button', { name: '✕' }).click();

    await expect(adminPage.getByRole('cell', { name: 'To Be Deleted' })).not.toBeVisible();
  });

  test('admin can grant and revoke the inventory module for a user', async ({ adminPage }) => {
    await adminPage.goto('/admin/users');
    await adminPage.getByRole('button', { name: '+ Crear usuario' }).click();
    await adminPage.getByLabel('Nombre').fill('Module Grant Target');
    await adminPage.getByLabel('Email').fill('module-grant-target@e2e.test');
    await adminPage.getByLabel('Contraseña').fill('ModuleGrantPass123!');
    await adminPage.getByLabel('Rol').selectOption('user');
    await adminPage.getByRole('button', { name: 'Crear', exact: true }).click();
    await expect(adminPage.getByRole('cell', { name: 'Module Grant Target' })).toBeVisible();

    const row = adminPage.getByRole('row', { name: /Module Grant Target/ });
    const inventoryCheckbox = row.getByRole('checkbox');
    await expect(inventoryCheckbox).not.toBeChecked();

    // The checkbox is a fully controlled component: it only reflects the
    // toggle after handleToggleInventoryModule's async PUT resolves and
    // React re-renders, with no native pre-toggle of its own. Playwright's
    // .check()/.uncheck() verify the DOM state immediately after the click
    // event and fail ("did not change its state") because that verification
    // races the pending fetch — confirmed via a diagnostic spec showing the
    // click's own PUT succeeds (200) and the checkbox does become checked
    // once the response lands. Use .click() + expect(...).toBeChecked()
    // instead, since the latter polls/retries rather than checking once.
    await inventoryCheckbox.click();
    await expect(inventoryCheckbox).toBeChecked();
    // Persisted server-side, not just local state.
    await adminPage.reload();
    await expect(adminPage.getByRole('row', { name: /Module Grant Target/ }).getByRole('checkbox')).toBeChecked();

    await adminPage.getByRole('row', { name: /Module Grant Target/ }).getByRole('checkbox').click();
    await expect(adminPage.getByRole('row', { name: /Module Grant Target/ }).getByRole('checkbox')).not.toBeChecked();
    await adminPage.reload();
    await expect(adminPage.getByRole('row', { name: /Module Grant Target/ }).getByRole('checkbox')).not.toBeChecked();
  });

  test('admin can reset another user\'s password', async ({ adminPage }) => {
    await adminPage.goto('/admin/users');
    await adminPage.getByRole('button', { name: '+ Crear usuario' }).click();
    await adminPage.getByLabel('Nombre').fill('Reset Target');
    await adminPage.getByLabel('Email').fill('reset-target@e2e.test');
    await adminPage.getByLabel('Contraseña').fill('OriginalPass123!');
    await adminPage.getByLabel('Rol').selectOption('user');
    await adminPage.getByRole('button', { name: 'Crear', exact: true }).click();
    await expect(adminPage.getByRole('cell', { name: 'Reset Target' })).toBeVisible();

    const row = adminPage.getByRole('row', { name: /Reset Target/ });
    await row.getByRole('button', { name: 'Reset' }).click();
    await adminPage.getByLabel('Nueva contraseña').fill('AdminResetPass123!');
    await adminPage.getByLabel('Confirmar contraseña').fill('AdminResetPass123!');
    await adminPage.getByRole('button', { name: 'Guardar' }).click();

    // Modal closes on success — its "Guardar" button is no longer in the DOM.
    await expect(adminPage.getByRole('button', { name: 'Guardar' })).not.toBeVisible();
  });
});
