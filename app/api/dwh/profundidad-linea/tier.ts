export type DepthTier = 'primera' | 'segunda' | 'addon' | 'sin-ventas';

export interface TierThresholds {
  firstLineMinPenetration: number;
  secondLineMinPenetration: number;
}

export const DEFAULT_TIER_THRESHOLDS: TierThresholds = {
  firstLineMinPenetration: 0.7,
  secondLineMinPenetration: 0.3,
};

export function classifyTier(
  penetration: number | null,
  hasAnySales: boolean,
  thresholds: TierThresholds,
): DepthTier {
  if (!hasAnySales) return 'sin-ventas';
  const p = penetration ?? 0;
  if (p >= thresholds.firstLineMinPenetration) return 'primera';
  if (p >= thresholds.secondLineMinPenetration) return 'segunda';
  return 'addon';
}
