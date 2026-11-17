export function HistBanner() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
      <p className="font-semibold mb-1">Datos del sistema anterior (enero 2020 – febrero 2026)</p>
      <p>
        Estos datos provienen del sistema anterior a la migración de marzo de 2026.
        Los clientes, productos y vendedores de este período son identidades
        independientes de los datos actuales — no se pueden cruzar ni sumar con
        las cifras de marzo de 2026 en adelante.
      </p>
      <p className="mt-2">
        Ventas brutas sin IVA y antes de devoluciones. Las devoluciones se restan por la <strong>fecha de la
        devolución</strong> (o por la de la factura original, según el selector). Los montos en USD usan las tasas
        del sistema anterior; un día sin tasa se muestra como &quot;Sin datos&quot;.
      </p>
    </div>
  );
}
