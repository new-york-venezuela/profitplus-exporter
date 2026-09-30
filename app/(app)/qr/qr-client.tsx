'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildQrSvg } from '@/lib/qr/render';
import type { QrCodeDto } from '@/lib/qr/dto';

type LogoMode = 'default' | 'custom' | 'none';

const DEFAULTS = { name: '', content: '', logoMode: 'default' as LogoMode, fgColor: '#000000' };

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Browsers report SVG as image/svg+xml and JPG as image/jpeg; the renderer's allowlist uses those.
async function logoDataUrl(mode: LogoMode, file: File | null, savedId: number | null): Promise<string | null> {
  if (mode === 'none') return null;
  if (mode === 'default') return blobToDataUrl(await (await fetch('/qr-default-logo.svg')).blob());
  if (file) return blobToDataUrl(file);
  if (savedId !== null) {
    const res = await fetch(`/api/qr/${savedId}/logo`);
    if (res.ok) return blobToDataUrl(await res.blob());
  }
  return null;
}

function download(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

function slug(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'qr';
}

async function svgToPngBlob(svg: string, px = 1024): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('No se pudo generar la imagen'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = px;
    canvas.getContext('2d')!.drawImage(img, 0, 0, px, px);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('No se pudo generar el PNG'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function QrClient() {
  const [items, setItems] = useState<QrCodeDto[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(DEFAULTS);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoHref, setLogoHref] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadItems = useCallback(async () => {
    const res = await fetch('/api/qr');
    if (res.ok) setItems((await res.json()).items);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/qr')
      .then(res => (res.ok ? res.json() : null))
      .then(json => { if (json && !cancelled) setItems(json.items); });
    return () => { cancelled = true; };
  }, []);

  // Resolve the logo to a data URL whenever the logo choice changes.
  useEffect(() => {
    let cancelled = false;
    logoDataUrl(form.logoMode, logoFile, editingId).then(u => { if (!cancelled) setLogoHref(u); }).catch(() => { if (!cancelled) setLogoHref(null); });
    return () => { cancelled = true; };
  }, [form.logoMode, logoFile, editingId]);

  const preview = useMemo(() => {
    if (!form.content.trim()) return { svg: null as string | null, error: null as string | null };
    try {
      return { svg: buildQrSvg({ content: form.content.trim(), fgColor: form.fgColor, logoHref }), error: null };
    } catch (e) {
      return { svg: null, error: e instanceof Error ? e.message : 'Contenido demasiado largo para un QR' };
    }
  }, [form.content, form.fgColor, logoHref]);

  function reset() {
    setEditingId(null);
    setForm(DEFAULTS);
    setLogoFile(null);
    setError(null);
  }

  function edit(item: QrCodeDto) {
    setEditingId(item.id);
    setForm({ name: item.name, content: item.content, logoMode: item.logoMode, fgColor: item.fgColor });
    setLogoFile(null);
    setError(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set('name', form.name);
      body.set('content', form.content);
      body.set('logoMode', form.logoMode);
      body.set('fgColor', form.fgColor);
      if (logoFile && form.logoMode === 'custom') body.set('logo', logoFile);
      const res = await fetch(editingId === null ? '/api/qr' : `/api/qr/${editingId}`, {
        method: editingId === null ? 'POST' : 'PATCH',
        body,
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Error al guardar'); return; }
      setEditingId(json.item.id);
      setLogoFile(null);
      await loadItems();
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: QrCodeDto) {
    if (!window.confirm(`¿Eliminar "${item.name}"?`)) return;
    const res = await fetch(`/api/qr/${item.id}`, { method: 'DELETE' });
    if (res.ok) {
      if (editingId === item.id) reset();
      await loadItems();
    }
  }

  async function downloadSaved(item: QrCodeDto, kind: 'png' | 'svg') {
    const href = await logoDataUrl(item.logoMode, null, item.id);
    const svg = buildQrSvg({ content: item.content, fgColor: item.fgColor, logoHref: href });
    if (kind === 'svg') {
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      download(url, `${slug(item.name)}.svg`);
      URL.revokeObjectURL(url);
    } else {
      const url = URL.createObjectURL(await svgToPngBlob(svg));
      download(url, `${slug(item.name)}.png`);
      URL.revokeObjectURL(url);
    }
  }

  async function downloadPreview(kind: 'png' | 'svg') {
    if (!preview.svg) return;
    const name = slug(form.name);
    const blob = kind === 'svg' ? new Blob([preview.svg], { type: 'image/svg+xml' }) : await svgToPngBlob(preview.svg);
    const url = URL.createObjectURL(blob);
    download(url, `${name}.${kind}`);
    URL.revokeObjectURL(url);
  }

  const input = 'w-full border rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none';
  const canSave = form.name.trim() !== '' && form.content.trim() !== '' && !preview.error && !busy
    && (form.logoMode !== 'custom' || logoFile !== null || editingId !== null);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-10">
      <header className="border-b pb-4">
        <h1 className="text-2xl font-bold text-slate-900">Generador de Códigos QR</h1>
        <p className="text-sm text-slate-600 mt-1">
          Crea códigos QR con el logo de la empresa (o el tuyo), descárgalos y guárdalos para reutilizarlos.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 border-b pb-2">
            {editingId === null ? 'Nuevo código QR' : 'Editando código QR'}
          </h2>
          <div className="space-y-3 text-sm">
            <div>
              <label htmlFor="qr-name" className="block text-slate-700 font-medium mb-1">Nombre</label>
              <input id="qr-name" className={input} value={form.name} maxLength={100}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej. Menú de temporada" />
            </div>
            <div>
              <label htmlFor="qr-content" className="block text-slate-700 font-medium mb-1">Contenido (URL o texto)</label>
              <textarea id="qr-content" className={input} rows={3} value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="qr-logo-mode" className="block text-slate-700 font-medium mb-1">Logo</label>
                <select id="qr-logo-mode" className={input} value={form.logoMode}
                  onChange={e => { setForm(f => ({ ...f, logoMode: e.target.value as LogoMode })); setLogoFile(null); }}>
                  <option value="default">Logo de la empresa</option>
                  <option value="custom">Subir mi logo</option>
                  <option value="none">Sin logo</option>
                </select>
              </div>
              <div>
                <label htmlFor="qr-color" className="block text-slate-700 font-medium mb-1">Color</label>
                <input id="qr-color" type="color" className="h-10 w-full border rounded-lg" value={form.fgColor}
                  onChange={e => setForm(f => ({ ...f, fgColor: e.target.value }))} />
              </div>
            </div>
            {form.logoMode === 'custom' && (
              <div>
                <label htmlFor="qr-logo-file" className="block text-slate-700 font-medium mb-1">Archivo de logo (PNG, JPG o SVG, máx. 1 MB)</label>
                <input id="qr-logo-file" type="file" accept="image/png,image/jpeg,image/svg+xml"
                  onChange={e => {
                    const f = e.target.files?.[0] ?? null;
                    if (f && f.size > 1_000_000) { setError('El logo no puede superar 1 MB'); e.target.value = ''; return; }
                    setError(null);
                    setLogoFile(f);
                  }} />
              </div>
            )}
            {(error || preview.error) && <p role="alert" className="text-red-600">{error ?? preview.error}</p>}
            <div className="flex gap-2 pt-2">
              <button onClick={save} disabled={!canSave}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50">
                {editingId === null ? 'Guardar' : 'Actualizar'}
              </button>
              {editingId !== null && (
                <button onClick={reset} className="px-4 py-2 rounded-lg border text-slate-700">Nuevo</button>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 border-b pb-2">Vista previa</h2>
          <div className="flex items-center justify-center min-h-64 bg-slate-50 rounded-lg">
            {preview.svg
              // eslint-disable-next-line @next/next/no-img-element
              ? <img alt="Vista previa del código QR" className="w-64 h-64"
                  src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(preview.svg)}`} />
              : <p className="text-sm text-slate-500">Escribe un contenido para ver el QR.</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => downloadPreview('png')} disabled={!preview.svg}
              className="px-4 py-2 rounded-lg border text-slate-700 disabled:opacity-50">Descargar PNG</button>
            <button onClick={() => downloadPreview('svg')} disabled={!preview.svg}
              className="px-4 py-2 rounded-lg border text-slate-700 disabled:opacity-50">Descargar SVG</button>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">Mis códigos QR</h2>
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">Aún no has guardado ningún código QR.</p>
        ) : (
          <ul className="divide-y border rounded-xl bg-white" aria-label="Mis códigos QR">
            {items.map(item => (
              <li key={item.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 truncate">{item.name}</p>
                  <p className="text-sm text-slate-500 truncate">{item.content}</p>
                </div>
                <div className="flex gap-2 shrink-0 text-sm">
                  <button onClick={() => edit(item)} className="px-3 py-1 rounded border">Editar</button>
                  <button onClick={() => downloadSaved(item, 'png')} className="px-3 py-1 rounded border">PNG</button>
                  <button onClick={() => downloadSaved(item, 'svg')} className="px-3 py-1 rounded border">SVG</button>
                  <button onClick={() => remove(item)} className="px-3 py-1 rounded border text-red-600">Eliminar</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
