// lib/components/reports/SucursalSelector.tsx

'use client';

import React from 'react';

interface SucursalSelectorProps {
  value: string;
  onChange: (sucursal: string) => void;
}

export function SucursalSelector({ value, onChange }: SucursalSelectorProps) {
  const options = [
    { label: 'Oficina', value: '000001' },
  ];

  return (
    <div className="form-group">
      <label htmlFor="sucursal-select">Sucursal / Oficina</label>
      <select
        id="sucursal-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
