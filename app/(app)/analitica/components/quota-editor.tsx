'use client';

import { useState } from 'react';

export interface SellerTargetRow {
  salesQuotaUsd: number | null;
  weeklyVisitQuota: number | null;
  newCustomerQuota: number | null;
}

export const EMPTY_TARGET_ROW: SellerTargetRow = { salesQuotaUsd: null, weeklyVisitQuota: null, newCustomerQuota: null };

// Inline click-to-edit quota affordance, same pattern the retired purchase-gap tab used
// for its targetGapDays editor: a value/"Definir" link swaps to a number input +
// "Guardar" button, then calls onSave (SellerProfile's saveQuotaField),
// which persists the change and triggers a profile refetch so the new quota
// is reflected immediately.
//
// `currentValue` (sourced from the seller_targets row for the profile's
// latest-in-range
// periodMonth, fetched once by SellerProfile and shared by all three
// editors below) is the pre-fill/display source for this editor's OWN
// field — NOT the parent Seller360Response's `quotaUsd`/`quota` props,
// which are a SUM across every month in the selected range (see
// quota-resolution.ts's resolveQuotaSum) and only equal one month's row
// when the range is itself a single month. This also matters for SAVING:
// POST /api/admin/seller-targets is a delete-then-reinsert upsert (see
// app/api/admin/seller-targets/route.ts) — any quota field omitted from the
// POST body is written back as null, so saving just this one field without
// the other two current values would silently wipe them. onSave (passed by
// SellerProfile) always sends the full three-field row, only overriding the
// one field this editor owns.
export function QuotaEditor({
  currentValue, field, suffix = '', onSave,
}: {
  currentValue: number | null;
  field: keyof SellerTargetRow;
  suffix?: string;
  onSave: (field: keyof SellerTargetRow, newValue: number) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function save() {
    const parsed = Number(inputValue);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const ok = await onSave(field, parsed);
      if (ok) setEditing(false);
      else setSaveError('No se pudo guardar la meta');
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1 print:hidden">
        <input
          type="number"
          min={0}
          step="any"
          autoFocus
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          className="border border-gray-200 rounded px-1 py-0.5 w-20 text-right text-xs"
        />
        <button disabled={saving} onClick={save} className="text-blue-600 hover:text-blue-800 text-xs">
          Guardar
        </button>
        <button disabled={saving} onClick={() => { setEditing(false); setSaveError(null); }} className="text-gray-400 hover:text-gray-600 text-xs">
          Cancelar
        </button>
        {saveError && <span className="text-red-600 text-xs">{saveError}</span>}
      </span>
    );
  }

  return (
    <button
      onClick={() => { setEditing(true); setInputValue(currentValue === null ? '' : String(currentValue)); }}
      className="text-xs text-blue-600 hover:underline print:hidden"
    >
      {currentValue === null ? `Definir meta${suffix ? ` (${suffix})` : ''}` : `Editar meta (${currentValue}${suffix})`}
    </button>
  );
}

// Persists one quota field. POST /api/admin/seller-targets is a delete-then-reinsert upsert, so the
// body must always carry the full three-field row: any field left out would be written back as null.
export async function saveSellerTargetField(args: {
  salesRepKey: string;
  periodMonth: string;
  current: SellerTargetRow;
  field: keyof SellerTargetRow;
  value: number;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/seller-targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ salesRepKey: args.salesRepKey, periodMonth: args.periodMonth, ...args.current, [args.field]: args.value }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
