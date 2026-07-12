'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import type { SessionPayload } from '@/lib/auth/session';

interface Props {
  user: SessionPayload;
}

const NAV_REPORTS = [
  { href: '/reports/ventas',  label: 'Ventas'  },
  { href: '/reports/compras', label: 'Compras' },
];

export function Sidebar({ user }: Props) {
  const pathname = usePathname();
  const router   = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  function navClass(href: string) {
    return `block px-3 py-2 rounded-md text-sm transition-colors ${
      pathname === href
        ? 'bg-blue-600 text-white font-medium'
        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
    }`;
  }

  return (
    <aside className="w-52 min-h-screen bg-gray-900 flex flex-col shrink-0">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-gray-700">
        <span className="text-sm font-bold text-white tracking-tight">
          ◆ ProfitPlus
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4">
        <p className="px-2 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Reportes
        </p>
        {NAV_REPORTS.map(({ href, label }) => (
          <Link key={href} href={href} className={navClass(href)}>
            {label}
          </Link>
        ))}

        {user.role === 'admin' && (
          <>
            <p className="px-2 mt-5 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Admin
            </p>
            <Link href="/admin/users" className={navClass('/admin/users')}>
              Usuarios
            </Link>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-700">
        <p className="text-xs text-gray-400 mb-2 truncate">{user.name}</p>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-400 hover:text-white transition-colors"
        >
          Salir →
        </button>
      </div>
    </aside>
  );
}
