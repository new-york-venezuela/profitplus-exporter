export function computeGapVsBaseline(ownPenetration: number | null, baselinePenetration: number | null): number | null {
  if (ownPenetration === null || baselinePenetration === null) return null;
  return ownPenetration - baselinePenetration;
}
