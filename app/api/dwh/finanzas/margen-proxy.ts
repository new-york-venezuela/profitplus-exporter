import type { MargenProxy } from '@/app/(app)/analitica/types';

// Part 2 of docs/superpowers/specs/2026-09-15-analitica-ui-and-margin-design.md:
// Compras is used as a proxy for COGS (Fact_Sales has never recorded real
// product cost — see docs/DATA_WAREHOUSE_GUIDE.md's Cost Data Gap section),
// distinct from Margen Operativo (which nets against ALL of
// dwh.vw_GastosOperativos, not just the Compras category within it). Kept in
// its own file (not exported from route.ts) so it's unit-testable without
// touching a Next.js route handler file's export whitelist (route.ts may
// only export GET/POST/etc. and a few reserved names like `dynamic`).
export function computeMargenProxy(input: {
  ingresos: number;
  compras: number;
  gastosOperativos: number;
}): MargenProxy {
  const { ingresos, compras, gastosOperativos } = input;
  const utilidadBruta = ingresos - compras;
  const otrosGastosOperativos = gastosOperativos - compras;
  const margenOperativo = ingresos - gastosOperativos;
  return {
    ingresos,
    compras,
    utilidadBruta,
    margenBrutoRate: ingresos > 0 ? utilidadBruta / ingresos : null,
    otrosGastosOperativos,
    margenOperativo,
    margenOperativoRate: ingresos > 0 ? margenOperativo / ingresos : null,
  };
}
