'use client';

import { useMemo, useRef, useState } from 'react';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

export interface SearchableSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  allLabel?: string;
  className?: string;
}

// Client-only combobox filtering an already-fetched, in-memory option list
// as the user types -- no server-side search/debounce, since every option
// list this is used for today (sellers, tiendas) is small enough to fetch
// once. Drop-in replacement for a native <select> wherever the option list
// is data-driven and can grow past a handful of items -- see AGENTS.md's
// "Code Conventions" for when to reach for this instead of <select>.
export default function SearchableSelect({
  value, onChange, options, placeholder = 'Buscar...', allLabel, className,
}: SearchableSelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLabel = useMemo(
    () => options.find(o => o.value === value)?.label ?? '',
    [options, value],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  function handleBlur(e: React.FocusEvent<HTMLDivElement>) {
    // Closing on blur would also fire when focus moves to an option button
    // inside this same container (e.g. via click) before its onClick runs --
    // relatedTarget lets us tell "focus left the whole component" apart from
    // "focus moved to a child inside it."
    if (containerRef.current && e.relatedTarget && containerRef.current.contains(e.relatedTarget as Node)) {
      return;
    }
    setOpen(false);
  }

  function selectOption(v: string | null) {
    onChange(v);
    setQuery('');
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`} onBlur={handleBlur}>
      <input
        type="text"
        role="textbox"
        value={open ? query : selectedLabel}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={e => setQuery(e.target.value)}
        placeholder={placeholder}
        className="border border-gray-200 rounded px-2 py-1 text-sm w-full"
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded border border-gray-200 bg-white shadow-lg text-sm">
          {allLabel && (
            <li>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => selectOption(null)}
                className="block w-full text-left px-2 py-1 hover:bg-gray-50 text-gray-500"
              >
                {allLabel}
              </button>
            </li>
          )}
          {filtered.length === 0 ? (
            <li className="px-2 py-1 text-gray-400">Sin resultados</li>
          ) : (
            filtered.map(o => (
              <li key={o.value}>
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => selectOption(o.value)}
                  className="block w-full text-left px-2 py-1 hover:bg-gray-50"
                >
                  {o.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
