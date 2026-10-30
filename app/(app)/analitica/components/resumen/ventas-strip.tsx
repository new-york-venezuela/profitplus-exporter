import type { Currency, DualAmount, ResumenKPIs } from '../../types';
import { moneyLabel, priceLabel } from '../../lib/format';
import { averagePrice } from '../../lib/net-sales';
import { Row, StatCard } from './stat-card';

const nf = (n: number) => n.toLocaleString('es-VE');

function price(amount: DualAmount, units: number, currency: Currency): string {
  const avg = averagePrice(amount, units);
  return avg === null ? 'Sin datos' : priceLabel(avg, currency);
}

export function VentasStrip({ kpis, currency }: { kpis: ResumenKPIs; currency: Currency }) {
  const netUnits = kpis.unitsSold - kpis.unitsReturned;
  const rate = kpis.returnRate === null ? '—' : `${(kpis.returnRate * 100).toFixed(1)}%`;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatCard label="Ventas brutas" value={moneyLabel(kpis.salesGross, currency)}>
        <Row label="Unidades" value={nf(kpis.unitsSold)} />
        <Row label="Clientes / tiendas" value={nf(kpis.activeCustomers)} />
        <Row label="Precio promedio" value={price(kpis.salesGross, kpis.unitsSold, currency)} />
      </StatCard>
      <StatCard
        label="Devoluciones"
        value={moneyLabel(kpis.returns, currency)}
        warn={kpis.returnRate !== null && kpis.returnRate > 0.05}
      >
        <Row label="Tasa de devolución" value={rate} />
        <Row label="Unidades" value={nf(kpis.unitsReturned)} />
        <Row label="Clientes / tiendas" value={nf(kpis.customersWithReturns)} />
        <Row label="Precio promedio" value={price(kpis.returns, kpis.unitsReturned, currency)} />
      </StatCard>
      <StatCard label="Neto" value={moneyLabel(kpis.salesNet, currency)}>
        <Row label="Unidades" value={nf(netUnits)} />
        <Row label="Clientes / tiendas" value={nf(kpis.customersNet)} />
        <Row label="Precio promedio" value={price(kpis.salesNet, netUnits, currency)} />
      </StatCard>
    </div>
  );
}
