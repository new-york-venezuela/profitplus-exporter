'use client';

export interface SegmentOption<T extends string> { value: T; label: string; count?: number }

// The one toggle used across the Clientes tab: gray-900 selected look, aria-pressed on every option.
export function SegmentedControl<T extends string>({ value, options, onChange, ariaLabel }: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md ${value === o.value ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
        >
          {o.label}
          {o.count !== undefined && <span className={`ml-1 ${value === o.value ? 'text-gray-300' : 'text-gray-600'}`}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
