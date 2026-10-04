import type { ReactNode } from 'react';

export type KpiTone = 'sales' | 'returns' | 'collections' | 'customers';

const TONE_CLASSES: Record<KpiTone, { panel: string; title: string }> = {
  sales: { panel: 'border-blue-300 bg-blue-50/50', title: 'text-blue-700' },
  returns: { panel: 'border-red-300 bg-red-50/50', title: 'text-red-700' },
  collections: { panel: 'border-amber-300 bg-amber-50/50', title: 'text-amber-700' },
  customers: { panel: 'border-green-300 bg-green-50/50', title: 'text-green-700' },
};

export function KpiGroup({ title, tone, children }: { title: string; tone: KpiTone; children: ReactNode }) {
  const t = TONE_CLASSES[tone];
  return (
    <section className={`rounded-xl border-2 p-3 ${t.panel}`} aria-label={title}>
      <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${t.title}`}>{title}</h3>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </section>
  );
}
