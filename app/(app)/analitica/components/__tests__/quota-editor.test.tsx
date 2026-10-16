import { screen } from '../../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EMPTY_TARGET_ROW, QuotaEditor, saveSellerTargetField } from '../quota-editor';

afterEach(cleanup);

describe('QuotaEditor', () => {
  test('shows "Definir meta" when empty, edits inline and saves the typed number', async () => {
    const onSave = mock(async () => true);
    render(<QuotaEditor currentValue={null} field="salesQuotaUsd" suffix="USD" onSave={onSave} />);
    await userEvent.click(screen.getByRole('button', { name: 'Definir meta (USD)' }));
    await userEvent.type(screen.getByRole('spinbutton'), '1500');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('salesQuotaUsd', 1500));
    expect(screen.queryByRole('spinbutton')).toBeNull();
  });
  test('shows the current value and pre-fills the editor', async () => {
    render(<QuotaEditor currentValue={80} field="weeklyVisitQuota" onSave={async () => true} />);
    await userEvent.click(screen.getByRole('button', { name: 'Editar meta (80)' }));
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('80');
  });
  test('a failed save keeps the editor open with an error', async () => {
    render(<QuotaEditor currentValue={null} field="newCustomerQuota" onSave={async () => false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Definir meta' }));
    await userEvent.type(screen.getByRole('spinbutton'), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('No se pudo guardar la meta')).toBeTruthy();
    expect(screen.getByRole('spinbutton')).toBeTruthy();
  });
  test('a negative value is never saved', async () => {
    const onSave = mock(async () => true);
    render(<QuotaEditor currentValue={null} field="salesQuotaUsd" onSave={onSave} />);
    await userEvent.click(screen.getByRole('button', { name: 'Definir meta' }));
    await userEvent.type(screen.getByRole('spinbutton'), '-5');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('spinbutton')).toBeTruthy();
  });
});

describe('saveSellerTargetField', () => {
  const fetchMock = mock(async (_url: string, _init?: RequestInit) => ({ ok: true }) as Response);
  beforeEach(() => { fetchMock.mockClear(); globalThis.fetch = fetchMock as unknown as typeof fetch; });

  test('always POSTs the full four-field row so the upsert never nulls the other quotas', async () => {
    const ok = await saveSellerTargetField({
      salesRepKey: '12', periodMonth: '2026-10',
      current: { salesQuotaUsd: 100, weeklyVisitQuota: 2, newCustomerQuota: null, unitsQuota: null },
      field: 'newCustomerQuota', value: 4,
    });
    expect(ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/admin/seller-targets');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      salesRepKey: '12', periodMonth: '2026-10', salesQuotaUsd: 100, weeklyVisitQuota: 2, newCustomerQuota: 4, unitsQuota: null,
    });
  });
  test('false on a non-ok response and on a network error', async () => {
    fetchMock.mockImplementationOnce(async () => ({ ok: false }) as Response);
    expect(await saveSellerTargetField({ salesRepKey: '1', periodMonth: '2026-10', current: EMPTY_TARGET_ROW, field: 'salesQuotaUsd', value: 1 })).toBe(false);
    fetchMock.mockImplementationOnce(async () => { throw new Error('offline'); });
    expect(await saveSellerTargetField({ salesRepKey: '1', periodMonth: '2026-10', current: EMPTY_TARGET_ROW, field: 'salesQuotaUsd', value: 1 })).toBe(false);
  });
});
