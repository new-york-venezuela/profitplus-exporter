'use client';
import { useEffect, useState } from 'react';
import { Modal } from '@/components/modal';
import { apiGet, apiSend } from './api-client';
import { DialogFooter, ErrorBox, INPUT, useSubmit } from './dialog-parts';

interface Settings { enabled: boolean; daysAhead: number; recipients: string[] | null }

export default function AlertSettingsDialog({ onClose }: { onClose: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [daysAhead, setDaysAhead] = useState('7');
  const [recipients, setRecipients] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiGet<{ settings: Settings }>('/api/pricing/alert-settings')
      .then(({ settings }) => {
        if (cancelled) return;
        setEnabled(settings.enabled);
        setDaysAhead(String(settings.daysAhead));
        setRecipients((settings.recipients ?? []).join('\n'));
        setLoaded(true);
      })
      .catch(e => { if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Error'); });
    return () => { cancelled = true; };
  }, []);

  const { submitting, error, run } = useSubmit(async () => {
    const list = recipients.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    await apiSend('/api/pricing/alert-settings', 'PUT', {
      enabled, daysAhead: Number(daysAhead), recipients: list.length > 0 ? list : null,
    });
    onClose();
  });
  const close = () => { if (!submitting) onClose(); };

  return (
    <Modal title="Alertas por correo" onClose={close}>
      {loadError ? (
        <div className="flex flex-col gap-4">
          <ErrorBox><span>{loadError}</span></ErrorBox>
          <div className="flex justify-end">
            <button type="button" onClick={close}
              className="min-h-[44px] rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50">Cerrar</button>
          </div>
        </div>
      ) : !loaded ? (
        <div aria-busy="true" aria-label="Cargando configuración" className="flex flex-col gap-3">
          {[0, 1, 2].map(i => <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />)}
        </div>
      ) : (
        <form onSubmit={e => { e.preventDefault(); if (!submitting) void run(); }} className="flex flex-col gap-4">
          <label className="flex min-h-[44px] items-center gap-3 text-sm text-gray-800">
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="h-5 w-5" />
            Enviar el resumen diario por correo
          </label>
          <div className="flex flex-col gap-1">
            <label htmlFor="alert-days" className="text-sm font-medium text-gray-700">Avisar con (días de anticipación)</label>
            <input id="alert-days" type="number" min={1} max={60} step={1} value={daysAhead}
              onChange={e => setDaysAhead(e.target.value)} className={`${INPUT} min-h-[44px] max-w-[8rem]`} />
            <p className="text-xs text-gray-500">Entre 1 y 60. Además se avisa el último día.</p>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="alert-recipients" className="text-sm font-medium text-gray-700">Destinatarios (un correo por línea)</label>
            <textarea id="alert-recipients" rows={4} value={recipients} onChange={e => setRecipients(e.target.value)} className={INPUT} />
            <p className="text-xs text-gray-500">Si lo dejas vacío: usar administradores y editores de precios.</p>
          </div>
          {error && <ErrorBox><span>{error.message}</span></ErrorBox>}
          <DialogFooter onClose={close} confirmLabel="Guardar" disabled={false} submitting={submitting} />
        </form>
      )}
    </Modal>
  );
}
