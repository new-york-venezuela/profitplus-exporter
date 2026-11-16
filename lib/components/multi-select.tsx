'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  ariaLabel?: string;
}

// Searchable checkbox list in a popover; closes on outside click.
export default function MultiSelect({ options, value, onChange, placeholder, ariaLabel }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
  }

  const summary = value.length === 0
    ? placeholder
    : value.length === 1
      ? (options.find(o => o.value === value[0])?.label ?? value[0])
      : `${placeholder} (${value.length})`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={ariaLabel ?? placeholder}
        aria-expanded={open}
        onClick={() => { setOpen(o => !o); setQuery(''); }}
        className="border border-gray-200 rounded px-2 py-1 text-sm bg-white min-w-32 text-left"
      >
        {summary}
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-64 rounded border border-gray-200 bg-white shadow-lg text-sm">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar..."
            className="border-b border-gray-200 px-2 py-1 w-full"
          />
          <ul className="max-h-60 overflow-auto">
            {filtered.length === 0 ? (
              <li className="px-2 py-1 text-gray-400">Sin resultados</li>
            ) : filtered.map(o => (
              <li key={o.value}>
                <label className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)} />
                  {o.label}
                </label>
              </li>
            ))}
          </ul>
          {value.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="w-full text-left px-2 py-1 text-xs text-gray-500 border-t border-gray-200 hover:bg-gray-50">
              Limpiar selección
            </button>
          )}
        </div>
      )}
    </div>
  );
}
