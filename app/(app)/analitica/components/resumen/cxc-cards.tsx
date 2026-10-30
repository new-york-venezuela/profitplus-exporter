import type { Currency, DualAmount, ResumenKPIs } from '../../types';
import { moneyLabel } from '../../lib/format';
import { StatCard } from './stat-card';

function amount(a: DualAmount | null, currency: Currency): string {
  return a === null ? 'Sin datos' : moneyLabel(a, currency);
}

export function CxcCards({ kpis, currency, snapshotLabel }: { kpis: ResumenKPIs; currency: Currency; snapshotLabel?: string }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <StatCard label="Saldo inicial" value={amount(kpis.receivableOpening, currency)}>
        <p>Al cierre del día anterior al período</p>
      </StatCard>
      <StatCard label="+ Facturación" value={amount(kpis.billed, currency)}>
        <p>sin IVA</p>
      </StatCard>
      <StatCard label="− Cobros" value={amount(kpis.collected, currency)}>
        <p>IVA incluido</p>
      </StatCard>
      <StatCard label="Pendiente" value={amount(kpis.receivable, currency)}>
        <p>{snapshotLabel ?? 'Saldo real: toda factura abierta'}</p>
      </StatCard>
    </div>
  );
}
