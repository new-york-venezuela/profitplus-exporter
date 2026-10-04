import { dualFromRow, returnRate, subtractDual } from '@/app/(app)/analitica/lib/net-sales';
import type { VentasRow } from '@/app/(app)/analitica/types';

// Shared by the top-level ventas rows and the tienda/producto child levels so
// every level of the tree computes net, rate, discount and units identically.
export function mapVentasRecord(r: Record<string, unknown>): Omit<VentasRow, 'label' | 'value' | 'title'> {
  const salesGross = dualFromRow(r.SalesGrossBs, r.SalesGrossUsd);
  const returns = dualFromRow(r.ReturnsBs, r.ReturnsUsd);
  const grossAmount = Number(r.GrossAmount ?? 0);
  const discountAmount = Number(r.DiscountAmount ?? 0);
  return {
    salesGross,
    returns,
    salesNet: subtractDual(salesGross, returns),
    returnRate: returnRate(returns, salesGross),
    avgDiscount: grossAmount > 0 ? discountAmount / grossAmount : null,
    units: Number(r.UnitsSold ?? 0),
  };
}
