import { weeklyBenefit, type MixLine } from './benefit';
import { MIN_PEERS, type PeerCandidate, type PeerTier } from './peers';

export interface ProductTotals {
  productCode: string;
  productName: string;
  units: number;
  /** Sum of USD net amount over the units that had a USD amount; null when usdUnits is 0. */
  usdNet: number | null;
  usdUnits: number;
}

export interface PeerView {
  code: string;
  name: string;
  typeName?: string;
  routeNumber: number | null;
  weeklyUnits: number;
  weeklyBenefitUsd: number | null;
}

export interface ProspectResult {
  tier: PeerTier;
  peerCount: number;
  lowPeers: boolean;
  units: { median: number; p25: number; p75: number } | null;
  mix: MixLine[];
  benefit: { medianUsd: number; p25Usd: number; p75Usd: number; incomplete: boolean } | null;
  peers: PeerView[];
  excludedNoRoute: number;
}

/** Linear-interpolation quantile of an ascending-sorted array. */
export function quantile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function cost(rows: ProductTotals[]): number | null {
  const usdUnits = rows.reduce((s, r) => s + r.usdUnits, 0);
  if (usdUnits <= 0) return null;
  const usdNet = rows.reduce((s, r) => s + (r.usdNet ?? 0), 0);
  return usdNet / usdUnits;
}

export function buildMix(rows: ProductTotals[], topN = 8): MixLine[] {
  const total = rows.reduce((s, r) => s + r.units, 0);
  if (rows.length === 0 || total <= 0) return [];
  const sorted = [...rows].sort((a, b) => b.units - a.units || a.productCode.localeCompare(b.productCode));
  const line = (r: ProductTotals): MixLine => ({
    productCode: r.productCode, productName: r.productName, share: r.units / total, costUsd: cost([r]),
  });
  const mix = sorted.slice(0, topN).map(line);
  const rest = sorted.slice(topN);
  if (rest.length > 0) {
    mix.push({
      productCode: 'OTROS',
      productName: 'Otros',
      share: rest.reduce((s, r) => s + r.units, 0) / total,
      costUsd: cost(rest),
    });
  }
  return mix;
}

export function buildResult(args: {
  tier: PeerTier;
  peers: PeerCandidate[];
  products: ProductTotals[];
  margin: number;
  excludedNoRoute: number;
}): ProspectResult {
  const { tier, peers, products, margin, excludedNoRoute } = args;
  const peerCount = peers.length;
  const base = { tier, peerCount, lowPeers: peerCount < MIN_PEERS, excludedNoRoute };
  if (peerCount === 0) return { ...base, units: null, mix: [], benefit: null, peers: [] };

  const sorted = peers.map((p) => p.weeklyUnits).sort((a, b) => a - b);
  const units = { median: quantile(sorted, 0.5)!, p25: quantile(sorted, 0.25)!, p75: quantile(sorted, 0.75)! };
  const mix = buildMix(products);
  const at = (u: number) => weeklyBenefit(u, mix, margin);
  const med = at(units.median);
  const allNull = mix.every((l) => l.costUsd === null);
  return {
    ...base,
    units,
    mix,
    benefit: {
      medianUsd: med.benefitUsd,
      p25Usd: at(units.p25).benefitUsd,
      p75Usd: at(units.p75).benefitUsd,
      incomplete: med.incomplete,
    },
    peers: peers.map((p) => ({
      code: p.code,
      name: p.name,
      routeNumber: p.routeNumber,
      weeklyUnits: p.weeklyUnits,
      weeklyBenefitUsd: allNull ? null : at(p.weeklyUnits).benefitUsd,
    })),
  };
}
