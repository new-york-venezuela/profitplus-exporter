import type { ClientesParams } from '@/app/(app)/analitica/lib/clientes-params';

// Query for /api/dwh/productos that follows the Clientes scope: the selected chain or store (`tienda`), grupo,
// ruta, the nivel and the product drill (lineas, sublineas, q). `extra` carries section, currency, granularity.
export function productosScopeQuery(p: ClientesParams, dateRange: string, extra: Record<string, string>): URLSearchParams {
  const q = new URLSearchParams({ dateRange, ...extra, nivel: p.nivel });
  if (p.tienda) q.set('tienda', p.tienda);
  if (p.grupo) q.set('grupo', p.grupo);
  if (p.ruta) q.set('ruta', p.ruta);
  if (p.lineas.length > 0) q.set('lineas', p.lineas.join(','));
  if (p.sublineas.length > 0) q.set('sublineas', p.sublineas.join(','));
  if (p.q) q.set('q', p.q);
  return q;
}
