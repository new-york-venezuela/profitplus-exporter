'use client';
import type { WizardPrefill } from './wizard-prefill';
// PLACEHOLDER: Task 8 replaces this file with the real promotion wizard (same default-export props).

export default function PromotionWizardSlot({ onCancel }: { initial?: WizardPrefill; onDone: (id: number) => void; onCancel: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-gray-300 p-6">
      <p className="text-sm text-gray-700">Asistente en construcción</p>
      <button type="button" onClick={onCancel}
        className="min-h-[44px] rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        Cancelar
      </button>
    </div>
  );
}
