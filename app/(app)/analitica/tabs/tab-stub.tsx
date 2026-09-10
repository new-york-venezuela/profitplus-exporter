import type { Currency, DateRange } from '../types';

export default function TabStub({
  title,
  dateRange,
  currency,
}: {
  title: string;
  dateRange?: DateRange;
  currency?: Currency;
}) {
  return (
    <div className="bg-white border border-yellow-200 rounded-lg p-6 flex flex-col items-center justify-center">
      <h2 className="text-lg font-bold text-gray-900 mb-2">{title}</h2>
      <p className="text-sm text-gray-600 mb-4">
        Este módulo está planeado pero requiere datos adicionales en el Data Warehouse.
      </p>
      <p className="text-xs text-gray-500">
        Consulta la documentación del DWH para conocer las tablas faltantes.
      </p>
    </div>
  );
}
