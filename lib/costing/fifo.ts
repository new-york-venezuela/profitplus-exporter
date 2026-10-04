export interface CostLayer {
  remaining: number;   // cantidad - cantidad_usada, already computed and pre-filtered (> 0) by the caller
  costBsd:   number;   // saCostoHistoricoEntrada.costo for this layer
}

export interface FifoCostResult {
  costBsd:   number;
  estimated: boolean;  // true if the requested quantity exceeded total remaining stock (shortfall priced at the most recent layer)
  hasData:   boolean;  // false only when `layers` is empty — no purchase history at all for this article
}

/**
 * Walks cost layers oldest-first, consuming `quantity` from each layer's
 * remaining balance until covered. `layers` must already be sorted
 * oldest-first (ascending fecha_emision).
 */
export function computeFifoCost(layers: CostLayer[], quantity: number): FifoCostResult {
  if (layers.length === 0) {
    return { costBsd: 0, estimated: false, hasData: false };
  }

  let remainingNeeded = quantity;
  let totalCostBsd = 0;

  for (const layer of layers) {
    if (remainingNeeded <= 0) break;
    const take = Math.min(layer.remaining, remainingNeeded);
    totalCostBsd += take * layer.costBsd;
    remainingNeeded -= take;
  }

  if (remainingNeeded > 0) {
    const mostRecentLayer = layers[layers.length - 1]!;
    totalCostBsd += remainingNeeded * mostRecentLayer.costBsd;
    return { costBsd: totalCostBsd, estimated: true, hasData: true };
  }

  return { costBsd: totalCostBsd, estimated: false, hasData: true };
}
