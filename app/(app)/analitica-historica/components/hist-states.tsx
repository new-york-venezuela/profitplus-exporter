export function HistLoading() {
  return <div className="p-6 space-y-3"><div className="text-sm text-gray-500">Cargando…</div></div>;
}

export function HistError({ message }: { message: string }) {
  return (
    <div className="p-6 space-y-3">
      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{message}</p>
    </div>
  );
}

export function HistEmpty({ message }: { message?: string }) {
  return (
    <div className="h-40 flex items-center justify-center text-sm text-gray-400 text-center px-4">
      {message ?? 'Sin datos en el período seleccionado.'}
    </div>
  );
}
