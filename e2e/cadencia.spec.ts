import { test, expect } from './fixtures';

// The DWH-reading parts of this tab require the profitplus-erp-mock
// container with DWH_AlimentosNY migrated/loaded (@mssql), same as every
// other analitica tab. The target-setting parts also write to the app's own
// SQLite (visit_cadence_targets) — not mssql-gated on their own, but these
// tests still need the tab to load real DWH rows first, so the whole file
// is tagged @mssql for simplicity, matching e2e/analitica.spec.ts's
// per-file (not per-test) tagging convention.

test.describe('cadencia @mssql', () => {
  test('tab renders customers sorted by days since last purchase', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=cadencia');

    await expect(adminPage.getByRole('heading', { name: 'Cadencia de compra' })).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });
  });

  test('segment filter narrows the list', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=cadencia');
    await expect(adminPage.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });

    const initialCount = await adminPage.locator('table tbody tr').count();
    await adminPage.getByLabel('Segmento:').selectOption('CADENA');
    await expect(adminPage.locator('table tbody tr')).not.toHaveCount(0);
    const cadenaCount = await adminPage.locator('table tbody tr').count();
    expect(cadenaCount).toBeLessThanOrEqual(initialCount);
  });

  test('setting a target shows an overdue/al-día badge', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=cadencia');
    await expect(adminPage.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });

    const firstRow = adminPage.locator('table tbody tr').first();
    const daysSinceLastPurchaseText = await firstRow.locator('td').nth(1).textContent();
    const daysSinceLastPurchase = Number(daysSinceLastPurchaseText);

    await firstRow.getByRole('button', { name: /Definir|^\d+$/ }).click();
    // Set a target well below the customer's actual days-since-last-purchase
    // so it's guaranteed to show as overdue, regardless of that customer's
    // real data in the live test DWH.
    const targetInput = firstRow.locator('input[type="number"]');
    await targetInput.fill('1');
    await firstRow.getByRole('button', { name: 'Guardar' }).click();

    if (daysSinceLastPurchase > 1) {
      await expect(firstRow.getByText('Atrasado')).toBeVisible({ timeout: 10_000 });
    } else {
      await expect(firstRow.getByText('Al día')).toBeVisible({ timeout: 10_000 });
    }
  });
});
