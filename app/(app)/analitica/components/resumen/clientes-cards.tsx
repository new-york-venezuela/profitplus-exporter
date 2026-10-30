import type { ResumenKPIs } from '../../types';
import { StatCard } from './stat-card';

const nf = (n: number) => n.toLocaleString('es-VE');

export function ClientesCards({ kpis }: { kpis: ResumenKPIs }) {
  const share = kpis.customersTotal > 0 ? `${((kpis.activeCustomers / kpis.customersTotal) * 100).toFixed(1)}% del total` : null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatCard label="Total" value={nf(kpis.customersTotal)}>
        <p>Clientes en el maestro</p>
      </StatCard>
      <StatCard label="Activos" value={nf(kpis.activeCustomers)}>
        <p>{share ?? 'Con al menos una factura en el período'}</p>
      </StatCard>
      <StatCard label="Nuevos" value={nf(kpis.customersNew)}>
        <p>Registrados en el período</p>
      </StatCard>
    </div>
  );
}
