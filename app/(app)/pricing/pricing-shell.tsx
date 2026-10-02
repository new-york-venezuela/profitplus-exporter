'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { HelpPanel } from '@/components/help-panel';
import SegmentsTab from './segments-tab';

export const TABS: { id: string; label: string; helpPage: string }[] = [
  { id: 'segmentos', label: 'Segmentos', helpPage: 'pricing-segmentos' },
];

export default function PricingShell({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const active = TABS.find(t => t.id === params.get('tab')) ?? TABS[0];

  function select(id: string) {
    const next = new URLSearchParams(params.toString());
    next.set('tab', id);
    next.delete('segment');
    router.replace(`/pricing?${next.toString()}`);
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Precios</h1>
      <div role="tablist" aria-label="Secciones de precios" className="flex gap-1 border-b border-gray-200 mb-4">
        {TABS.map(t => (
          <button key={t.id} role="tab" aria-selected={t.id === active.id} onClick={() => select(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${
              t.id === active.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {active.id === 'segmentos' && <SegmentsTab canEdit={canEdit} />}
      <HelpPanel page={active.helpPage} />
    </div>
  );
}
