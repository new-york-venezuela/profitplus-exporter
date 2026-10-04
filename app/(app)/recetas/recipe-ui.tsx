// Shared presentational pieces for the recipes module. Kept together so the list
// and the editor render cost states identically.
//
// Invariants (AGENTS.md → "Recipes / Product Costing (FIFO)"):
//  - a null cost is "Sin datos", never $0.00
//  - an estimated cost is always visibly flagged

export function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
        active ? 'bg-green-50 text-green-800' : 'bg-gray-100 text-gray-700'
      }`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-green-600' : 'bg-gray-400'}`} />
      {active ? 'Activa' : 'Inactiva'}
    </span>
  );
}

export function EstimatedBadge() {
  return (
    <span
      title="La cantidad supera el stock con costo registrado; el faltante usa el precio de la compra más reciente."
      className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800"
    >
      Estimado
    </span>
  );
}

export function NoDataBadge() {
  return (
    <span
      title="Este insumo no tiene compras registradas en Profit Plus."
      className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-medium text-red-800"
    >
      Sin datos
    </span>
  );
}

export function CostBadge({ costUsd, estimated }: { costUsd: number | null; estimated: boolean }) {
  if (costUsd === null) return <NoDataBadge />;
  return (
    <span className="inline-flex items-center justify-end gap-2">
      {estimated && <EstimatedBadge />}
      <span className="tabular-nums text-gray-900">{formatUsd(costUsd)}</span>
    </span>
  );
}
