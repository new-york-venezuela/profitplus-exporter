export function HistoricoBanner() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
      <p className="font-semibold mb-1">Datos del sistema anterior (enero – diciembre 2025)</p>
      <p>
        Estos datos provienen del sistema anterior a la migración de marzo de 2026.
        Los clientes, productos y vendedores de este período son identidades
        independientes de los datos actuales — no se pueden cruzar ni sumar con
        las cifras de 2026 en adelante. Esta pestaña solo muestra el año 2025: enero y febrero de 2026 del sistema anterior no se muestran.
      </p>
      <p className="mt-2">
        Ventas brutas sin IVA y antes de devoluciones. Las devoluciones se restan por <strong>fecha de la factura
        original</strong>, igual que en el resto de Analítica (una devolución sin factura identificable se
        cuenta en su propia fecha). Las devoluciones de facturas anteriores a enero 2025 no se incluyen.
      </p>
    </div>
  );
}
