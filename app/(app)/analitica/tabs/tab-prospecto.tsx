'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import SearchableSelect from '@/lib/components/searchable-select';
import { Modal } from '@/components/modal';
import { parseMargin } from '@/lib/prospect/benefit';
import { ResultPanel } from '../components/prospecto/result-panel';
import type { ProspectoOptions, ProspectoResponse } from '../types';
import type { TabComponentProps } from '../analitica-client';

// Leaflet touches `window` at import time: client-only leaf, like mapa-loader.tsx.
const PinPicker = dynamic(() => import('../components/prospecto/pin-picker'), {
  ssr: false,
  loading: () => <div role="status" className="h-80 flex items-center justify-center text-sm text-gray-500">Cargando mapa…</div>,
});

type Pin = { lat: number; lng: number };

async function errorOf(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return (body as { error?: string }).error ?? 'Error desconocido';
}

export default function TabProspecto(_props: TabComponentProps) {
  const [options, setOptions] = useState<ProspectoOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [tipo, setTipo] = useState('');
  const [ruta, setRuta] = useState<string | null>(null);
  const [margenText, setMargenText] = useState('30');
  const [margenQuery, setMargenQuery] = useState('30');
  const [pin, setPin] = useState<Pin | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinNote, setPinNote] = useState<string | null>(null);
  const [data, setData] = useState<ProspectoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const marginValid = parseMargin(margenText) !== null;

  // Debounce the margin so typing does not fire a request per keystroke.
  useEffect(() => {
    if (!marginValid) return;
    const t = setTimeout(() => setMargenQuery(margenText.trim()), 400);
    return () => clearTimeout(t);
  }, [margenText, marginValid]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/dwh/prospecto?section=options');
        if (cancelled) return;
        if (!res.ok) { setOptionsError(await errorOf(res)); return; }
        setOptions(await res.json());
      } catch {
        if (!cancelled) setOptionsError('No se pudo conectar con el servidor');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!tipo || !ruta) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const qs = new URLSearchParams({ tipo, ruta, margen: margenQuery });
        if (pin) { qs.set('lat', String(pin.lat)); qs.set('lng', String(pin.lng)); }
        const res = await fetch(`/api/dwh/prospecto?${qs.toString()}`);
        if (cancelled) return;
        if (!res.ok) { setError(await errorOf(res)); setData(null); return; }
        const body: ProspectoResponse = await res.json();
        if (!cancelled) setData(body);
      } catch {
        if (!cancelled) setError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tipo, ruta, margenQuery, pin]);

  const routeOptions = useMemo(
    () => (options?.routes ?? []).map(r => ({ value: String(r.number), label: `${r.number} · ${r.name} (${r.customers})` })),
    [options],
  );

  async function confirmPin(p: Pin) {
    setPinOpen(false);
    setPin(p);
    setPinNote(null);
    try {
      const res = await fetch(`/api/dwh/prospecto?section=suggest&lat=${p.lat}&lng=${p.lng}`);
      if (!res.ok) { setPinNote(await errorOf(res)); return; }
      const body: { route: number | null } = await res.json();
      if (body.route !== null && body.route !== undefined) {
        setRuta(String(body.route));
        setPinNote(`Ruta sugerida: ${body.route}. Puede cambiarla.`);
      } else {
        setPinNote('No hay clientes ubicados cerca: elija la ruta manualmente.');
      }
    } catch {
      setPinNote('No se pudo conectar con el servidor');
    }
  }

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="prospecto-tipo" className="block text-xs font-semibold text-gray-500 mb-1">Tipo de tienda</label>
            <select
              id="prospecto-tipo"
              value={tipo}
              onChange={e => setTipo(e.target.value)}
              className="border border-gray-200 rounded px-2 py-1 text-sm"
            >
              <option value="">Seleccione…</option>
              {(options?.types ?? []).map(t => (
                <option key={t.code} value={t.code}>{t.name} ({t.count})</option>
              ))}
            </select>
          </div>
          <div className="w-64">
            <span className="block text-xs font-semibold text-gray-500 mb-1">Ruta</span>
            <SearchableSelect
              value={ruta}
              onChange={setRuta}
              options={routeOptions}
              placeholder="Buscar ruta…"
              ariaLabel="Ruta"
            />
          </div>
          <div>
            <label htmlFor="prospecto-margen" className="block text-xs font-semibold text-gray-500 mb-1">Margen de la tienda (%)</label>
            <input
              id="prospecto-margen"
              type="number"
              inputMode="decimal"
              step="any"
              value={margenText}
              onChange={e => setMargenText(e.target.value)}
              aria-invalid={!marginValid}
              aria-describedby={marginValid ? undefined : 'prospecto-margen-error'}
              className="border border-gray-200 rounded px-2 py-1 text-sm w-24"
            />
          </div>
          <div>
            <button
              type="button"
              onClick={() => setPinOpen(true)}
              className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Marcar en el mapa
            </button>
          </div>
        </div>
        {!marginValid && (
          <p id="prospecto-margen-error" role="alert" className="text-xs text-red-700 mt-2">
            Margen inválido: use un porcentaje entre 0 y 99,9.
          </p>
        )}
        {pin && (
          <p className="text-xs text-gray-600 mt-2">
            Ubicación marcada: {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}{' '}
            <button type="button" className="underline text-blue-700" onClick={() => { setPin(null); setPinNote(null); }}>Quitar</button>
          </p>
        )}
        {pinNote && <p className="text-xs text-gray-600 mt-1">{pinNote}</p>}
        <p className="text-xs text-gray-500 mt-2">Últimas 12 semanas completas</p>
      </div>

      {pinOpen && (
        <Modal title="Marcar en el mapa" onClose={() => setPinOpen(false)}>
          <PinPicker initial={pin} onConfirm={confirmPin} onCancel={() => setPinOpen(false)} />
        </Modal>
      )}

      {optionsError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{optionsError}</p>
      )}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p>
      )}
      {!tipo || !ruta ? (
        <p className="text-sm text-gray-500">Elija un tipo de tienda y una ruta (o marque la ubicación en el mapa) para ver el perfil.</p>
      ) : loading && !data ? (
        <div className="text-sm text-gray-500" role="status">Cargando…</div>
      ) : data ? (
        <div aria-busy={loading}>
          <ResultPanel data={data} />
        </div>
      ) : null}
    </div>
  );
}
