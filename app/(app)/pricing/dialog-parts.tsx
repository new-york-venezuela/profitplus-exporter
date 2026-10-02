'use client';
import { useCallback, useState, type ReactNode } from 'react';
import { ApiError } from './api-client';

export const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
export const INPUT = `w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 ${FOCUS}`;
const BTN = `min-h-[44px] rounded-md px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;

/** Runs an async confirm handler, tracking submitting state and the server error message. */
export function useSubmit(fn: () => Promise<void>) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const run = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try { await fn(); }
    catch (e) { setError(e instanceof Error ? e : new Error('Error inesperado')); }
    finally { setSubmitting(false); }
  }, [fn]);
  return { submitting, error, setError, run };
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {children}
    </div>
  );
}

export function DialogFooter(props: {
  onClose: () => void; confirmLabel: string; disabled: boolean; submitting: boolean;
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={props.onClose} className={`${BTN} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}>
        Cancelar
      </button>
      <button type="submit" disabled={props.disabled || props.submitting} className={`${BTN} bg-blue-600 text-white hover:bg-blue-700`}>
        {props.submitting ? 'Guardando…' : props.confirmLabel}
      </button>
    </div>
  );
}
