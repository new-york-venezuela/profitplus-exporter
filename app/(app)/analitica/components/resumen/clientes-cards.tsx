import type { ResumenKPIs } from '../../types';
import { StatCard } from './stat-card';

const nf = (n: number) => n.toLocaleString('es-VE');

// One basis for the three cards: customer codes of the current master row, consignment roots excluded (as in
// Seguimiento). Activos is a subset of Total, so the share stays within 100%.
const BASIS = <p className="text-[11px] text-gray-400">Sin consignación</p>;

export function ClientesCards({ kpis }: { kpis: ResumenKPIs }) {
  const share = kpis.customersTotal > 0 ? `${((kpis.activeCustomerCodes / kpis.customersTotal) * 100).toFixed(1)}% del total` : null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatCard label="Total" value={nf(kpis.customersTotal)}>
        <p>Clientes en el maestro</p>
        {BASIS}
      </StatCard>
      <StatCard label="Activos" value={nf(kpis.activeCustomerCodes)}>
        <p>{share ?? 'Con al menos una factura en el período'}</p>
        {BASIS}
      </StatCard>
      <StatCard label="Nuevos" value={nf(kpis.customersNew)}>
        <p>Registrados en el período</p>
        {BASIS}
      </StatCard>
    </div>
  );
}
