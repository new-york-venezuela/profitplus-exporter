'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';

interface Props {
  page: string;
}

// No @tailwindcss/typography plugin installed — mapping markdown elements
// to plain Tailwind classes directly instead of pulling in `prose` styles
// for what's currently a handful of small help docs.
const markdownComponents: Components = {
  h1: ({ children }) => <h1 className="text-lg font-bold text-gray-900 mt-4 mb-2 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-semibold text-gray-900 mt-4 mb-2 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">{children}</h3>,
  p:  ({ children }) => <p className="text-sm text-gray-700 mb-3 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="list-disc list-inside text-sm text-gray-700 mb-3 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside text-sm text-gray-700 mb-3 space-y-1">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
  code: ({ children }) => <code className="bg-gray-100 text-gray-800 rounded px-1 py-0.5 text-xs font-mono">{children}</code>,
  a: ({ children, href }) => <a href={href} className="text-blue-600 hover:text-blue-700 underline">{children}</a>,
};

export function HelpPanel({ page }: Props) {
  const [open, setOpen]         = useState(false);
  const [content, setContent]   = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!open || content !== null) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/help/${page}`);
        if (cancelled) return;
        if (!res.ok) {
          setError('No se pudo cargar la ayuda de esta página.');
          return;
        }
        setContent(await res.text());
      } catch {
        if (!cancelled) setError('No se pudo conectar con el servidor.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [open, content, page]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Ayuda de esta página"
        title="Ayuda de esta página"
        className="fixed bottom-6 right-6 w-11 h-11 rounded-full bg-blue-600 hover:bg-blue-700
                   text-white text-lg font-semibold shadow-lg flex items-center justify-center z-40"
      >
        ?
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-label="Panel de ayuda"
            className="relative w-full max-w-md h-full bg-white shadow-xl overflow-y-auto p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Ayuda</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar ayuda"
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ✕
              </button>
            </div>

            {loading && <p className="text-sm text-gray-500">Cargando…</p>}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </p>
            )}

            {content !== null && (
              <div>
                <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
