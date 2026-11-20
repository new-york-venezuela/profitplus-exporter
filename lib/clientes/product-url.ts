// Query for /api/dwh/productos that follows a Clientes scope: the selected chain or store (`tienda`), grupo and
// ruta. `extra` carries section, nivel, currency or granularity.
export function productosScopeQuery(
  scope: { tienda: string | null; grupo: string | null; ruta: string | null },
  dateRange: string,
  extra: Record<string, string>,
): URLSearchParams {
  const q = new URLSearchParams({ dateRange, ...extra });
  if (scope.tienda) q.set('tienda', scope.tienda);
  if (scope.grupo) q.set('grupo', scope.grupo);
  if (scope.ruta) q.set('ruta', scope.ruta);
  return q;
}
