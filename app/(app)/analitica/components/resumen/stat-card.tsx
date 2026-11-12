import type { ReactNode } from 'react';

export function StatCard({ label, value, children, warn }: { label: string; value: string; children?: ReactNode; warn?: boolean }) {
  return (
    <div className="bg-white border border-gray-300 rounded-lg shadow-sm px-3 py-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-xl font-bold leading-tight ${warn ? 'text-orange-600' : 'text-gray-900'}`}>{value}</p>
      {children && <div className="mt-1 text-xs leading-snug text-gray-600">{children}</div>}
    </div>
  );
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex justify-between gap-2">
      <span>{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </p>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-sm font-bold text-gray-900 mb-1">{children}</h2>;
}
