'use client';

import { useState } from 'react';
import { Modal }    from '@/components/modal';

interface UserRow {
  id:        number;
  email:     string;
  name:      string;
  role:      'user' | 'admin';
  createdAt: number;
}

interface Props {
  initialUsers:  UserRow[];
  currentUserId: number;
}

export function UsersClient({ initialUsers, currentUserId }: Props) {
  const [userList, setUserList]       = useState<UserRow[]>(initialUsers);
  const [modal, setModal]             = useState<'create' | 'reset' | null>(null);
  const [selectedId, setSelectedId]   = useState<number | null>(null);
  const [formError, setFormError]     = useState<string | null>(null);
  const [submitting, setSubmitting]   = useState(false);

  // ── Create user form state ──────────────────────────────────────────
  const [newEmail,    setNewEmail]    = useState('');
  const [newName,     setNewName]     = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole,     setNewRole]     = useState<'user' | 'admin'>('user');

  // ── Reset password form state ───────────────────────────────────────
  const [resetPwd,    setResetPwd]    = useState('');
  const [resetConfirm,setResetConfirm]= useState('');

  async function handleCreate() {
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: newEmail, name: newName, password: newPassword, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error); return; }
      // Refresh list
      const listRes = await fetch('/api/admin/users');
      setUserList(await listRes.json());
      setModal(null);
      setNewEmail(''); setNewName(''); setNewPassword(''); setNewRole('user');
    } catch { setFormError('Error de red'); }
    finally  { setSubmitting(false); }
  }

  async function handleResetPassword() {
    if (!selectedId) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/admin/users/${selectedId}/reset-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ newPassword: resetPwd, confirmPassword: resetConfirm }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error); return; }
      setModal(null);
      setResetPwd(''); setResetConfirm('');
    } catch { setFormError('Error de red'); }
    finally  { setSubmitting(false); }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`¿Eliminar a ${name}?`)) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setUserList(prev => prev.filter(u => u.id !== id));
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? 'No se pudo eliminar');
    }
  }

  const inputClass = `w-full border border-gray-300 rounded-md px-3 py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500`;

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
        <button
          onClick={() => { setModal('create'); setFormError(null); }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm
                     font-medium rounded-md transition-colors"
        >
          + Crear usuario
        </button>
      </div>

      {/* Users table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {['Nombre', 'Email', 'Rol', 'Creado', 'Acciones'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold
                                       text-gray-600 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {userList.map(user => (
              <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                <td className="px-4 py-3 text-gray-600">{user.email}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    user.role === 'admin'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {user.role === 'admin' ? 'Administrador' : 'Usuario'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {new Date(user.createdAt).toLocaleDateString('es-VE')}
                </td>
                <td className="px-4 py-3 flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedId(user.id);
                      setResetPwd('');
                      setResetConfirm('');
                      setFormError(null);
                      setModal('reset');
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Reset
                  </button>
                  {user.id !== currentUserId && (
                    <button
                      onClick={() => handleDelete(user.id, user.name)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {userList.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">
            No hay usuarios registrados.
          </div>
        )}
      </div>

      {/* Create user modal */}
      {modal === 'create' && (
        <Modal title="Crear usuario" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                     className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                     className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                     className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
              <select value={newRole} onChange={e => setNewRole(e.target.value as 'user' | 'admin')}
                      className={inputClass}>
                <option value="user">Usuario</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {formError}
              </p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setModal(null)}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                Cancelar
              </button>
              <button onClick={handleCreate} disabled={submitting}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm
                                 font-medium rounded-md disabled:opacity-50">
                {submitting ? 'Creando…' : 'Crear'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reset password modal */}
      {modal === 'reset' && (
        <Modal title="Restablecer contraseña" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
              <input type="password" value={resetPwd} onChange={e => setResetPwd(e.target.value)}
                     className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
              <input type="password" value={resetConfirm} onChange={e => setResetConfirm(e.target.value)}
                     className={inputClass} />
            </div>
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {formError}
              </p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setModal(null)}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                Cancelar
              </button>
              <button onClick={handleResetPassword} disabled={submitting}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm
                                 font-medium rounded-md disabled:opacity-50">
                {submitting ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
