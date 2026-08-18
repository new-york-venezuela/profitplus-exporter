'use client';

import { useState, useEffect, type FormEvent, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

type VerifyState = 'checking' | 'valid' | 'invalid';

function PasswordResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [verifyState, setVerifyState] = useState<VerifyState>('checking');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerifyState('invalid');
      return;
    }

    fetch(`/api/auth/password-reset/verify?token=${encodeURIComponent(token)}`)
      .then(res => setVerifyState(res.ok ? 'valid' : 'invalid'))
      .catch(() => setVerifyState('invalid'));
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);

    const res = await fetch(`/api/auth/password-reset/${encodeURIComponent(token as string)}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ newPassword }),
    });

    setLoading(false);

    if (res.ok) {
      setSuccess(true);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'No se pudo restablecer la contraseña');
    }
  }

  return (
    <div className="w-full max-w-sm bg-white rounded-lg shadow-md p-8">
      <div className="mb-8">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-1">
          {process.env.NEXT_PUBLIC_APP_NAME ?? 'ProfitPlus Exporter'}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Restablecer contraseña</h1>
      </div>

      {verifyState === 'checking' && (
        <p className="text-sm text-gray-500">Verificando enlace...</p>
      )}

      {verifyState === 'invalid' && (
        <div className="space-y-4">
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            Este enlace de restablecimiento es inválido o ha expirado.
          </p>
          <Link
            href="/forgot-password"
            className="block text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Solicitar un nuevo enlace
          </Link>
        </div>
      )}

      {verifyState === 'valid' && success && (
        <div className="space-y-4">
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
            Tu contraseña ha sido restablecida correctamente.
          </p>
          <Link
            href="/login"
            className="block text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Iniciar sesión
          </Link>
        </div>
      )}

      {verifyState === 'valid' && !success && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nueva contraseña
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar contraseña
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4
                       rounded-md text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Restableciendo...' : 'Restablecer contraseña'}
          </button>
        </form>
      )}
    </div>
  );
}

export default function PasswordResetPage() {
  return (
    <Suspense fallback={null}>
      <PasswordResetForm />
    </Suspense>
  );
}
