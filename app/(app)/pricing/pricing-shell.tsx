'use client';
import { useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { HelpPanel } from '@/components/help-panel';
import { nextTabId } from '@/lib/pricing/tab-nav';
import SegmentsTab from './segments-tab';
import ListsTab from './lists-tab';
import PromotionsTab from './promotions-tab';

export const TABS: { id: string; label: string; helpPage: string }[] = [
  { id: 'segmentos', label: 'Segmentos', helpPage: 'pricing-segmentos' },
  { id: 'listas', label: 'Listas', helpPage: 'pricing-listas' },
  { id: 'promociones', label: 'Promociones', helpPage: 'pricing-promociones' },
];

const tabDomId = (id: string) => `pricing-tab-${id}`;
const panelDomId = (id: string) => `pricing-panel-${id}`;

export default function PricingShell({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const active = TABS.find(t => t.id === params.get('tab')) ?? TABS[0];
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function select(id: string) {
    const next = new URLSearchParams(params.toString());
    next.set('tab', id);
    next.delete('segment');
    next.delete('list');
    next.delete('promo');
    next.delete('new');
    router.replace(`/pricing?${next.toString()}`);
  }

  function onKeyDown(e: React.KeyboardEvent, id: string) {
    const target = nextTabId(TABS.map(t => t.id), id, e.key);
    if (!target) return;
    e.preventDefault();
    select(target);
    tabRefs.current[target]?.focus();
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Precios</h1>
      <div role="tablist" aria-label="Secciones de precios" className="flex gap-1 border-b border-gray-200 mb-4">
        {TABS.map(t => (
          <button key={t.id} id={tabDomId(t.id)} ref={el => { tabRefs.current[t.id] = el; }}
            role="tab" aria-selected={t.id === active.id} aria-controls={panelDomId(t.id)}
            tabIndex={t.id === active.id ? 0 : -1}
            onClick={() => select(t.id)} onKeyDown={e => onKeyDown(e, t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${
              t.id === active.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={panelDomId(active.id)} aria-labelledby={tabDomId(active.id)}>
        {active.id === 'segmentos' && <SegmentsTab canEdit={canEdit} />}
        {active.id === 'listas' && <ListsTab canEdit={canEdit} />}
        {active.id === 'promociones' && <PromotionsTab canEdit={canEdit} />}
      </div>
      {/* keyed: HelpPanel caches the first markdown it loads, so each tab needs its own instance */}
      <HelpPanel key={active.helpPage} page={active.helpPage} />
    </div>
  );
}
