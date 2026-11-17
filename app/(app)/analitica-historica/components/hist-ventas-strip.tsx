import type { Currency, DualAmount, HistKpis } from '../types';
import { priceLabel } from '../../analitica/lib/format';
import { averagePrice } from '../../analitica/lib/net-sales';
import { Row, StatCard } from '../../analitica/components/resumen/stat-card';
import { histMoney } from '../lib/format';

const nf = (n: number) => n.toLocaleString('es-VE');

function price(amount: DualAmount, units: number, currency: Currency): string {
  const avg = averagePrice(amount, units);
  return avg === null ? 'Sin datos' : priceLabel(avg, currency);
}

// Brutas / Devoluciones / Neto cards, same layout as the main Resumen's VentasStrip
// minus the consignment note (legacy data has no consignment flag).
export function HistVentasStrip({ kpis, currency }: { kpis: HistKpis; currency: Currency }) {
  const netUnits = kpis.unitsSold - kpis.unitsReturned;
  const rate = kpis.returnRate === null ? '—' : `${(kpis.returnRate * 100).toFixed(1)}%`;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <StatCard label="Ventas brutas" value={histMoney(kpis.salesGross, currency)}>
        <Row label="Unidades" value={nf(kpis.unitsSold)} />
        <Row label="Clientes / tiendas" value={nf(kpis.customersWithSales)} />
        <Row label="Precio promedio" value={price(kpis.salesGross, kpis.unitsSold, currency)} />
      </StatCard>
      <StatCard
        label="Devoluciones"
        value={histMoney(kpis.returns, currency)}
        warn={kpis.returnRate !== null && kpis.returnRate > 0.05}
      >
        <Row label="Tasa de devolución" value={rate} />
        <Row label="Unidades" value={nf(kpis.unitsReturned)} />
        <Row label="Clientes / tiendas" value={nf(kpis.customersWithReturns)} />
        <Row label="Precio promedio" value={price(kpis.returns, kpis.unitsReturned, currency)} />
      </StatCard>
      <StatCard label="Neto" value={histMoney(kpis.salesNet, currency)}>
        <Row label="Unidades" value={nf(netUnits)} />
        <Row label="Clientes / tiendas" value={nf(kpis.customersNet)} />
        <Row label="Precio promedio" value={price(kpis.salesNet, netUnits, currency)} />
      </StatCard>
    </div>
  );
}
