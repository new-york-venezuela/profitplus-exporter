export function resolveTarget(
  legalEntityKey: number,
  segment: 'CADENA' | 'INDEPENDIENTES' | null,
  entityOverrides: Map<number, number>,
  segmentDefaults: Map<string, number>,
): number | null {
  const override = entityOverrides.get(legalEntityKey);
  if (override !== undefined) return override;
  if (segment === null) return null;
  return segmentDefaults.get(segment) ?? null;
}
