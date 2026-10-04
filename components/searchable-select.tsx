'use client';

import { useState, useEffect, useRef, useMemo } from 'react';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  id?: string;
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Plain-Tailwind searchable dropdown — this app has no combobox/autocomplete
// library, so this is a minimal from-scratch implementation matching the
// existing free-text-input styling used everywhere else.
export function SearchableSelect({ id, options, value, onChange, placeholder, className }: SearchableSelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLabel = useMemo(
    () => options.find(o => o.value === value)?.label ?? '',
    [options, value],
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (q === '') return options;
    return options.filter(o => normalize(o.label).includes(q));
  }, [options, query]);

  const inputClass = className ?? `w-full border border-gray-300 rounded-md px-2 py-1 text-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500`;

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        value={open ? query : selectedLabel}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={e => setQuery(e.target.value)}
        className={inputClass}
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full min-w-[16rem] overflow-y-auto
                       bg-white border border-gray-200 rounded-md shadow-lg text-sm">
          {filtered.length === 0 && (
            <li className="px-2 py-1.5 text-gray-400">Sin resultados</li>
          )}
          {filtered.map(o => (
            <li
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`px-2 py-1.5 cursor-pointer hover:bg-blue-50 ${o.value === value ? 'bg-blue-50 font-medium' : ''}`}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
