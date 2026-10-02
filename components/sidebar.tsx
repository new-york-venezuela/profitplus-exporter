'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';
import type { SessionPayload } from '@/lib/auth/session';
import type { PricingAccessLevel } from '@/lib/pricing/access';
import { visibleNavSections } from '@/lib/nav';

interface Props {
  user: SessionPayload;
  canSeeInventory: boolean;
  canSeeAnalitica: boolean;
  canSeeMapa: boolean;
  pricingAccessLevel: PricingAccessLevel;
}

export function Sidebar({ user, canSeeInventory, canSeeAnalitica, canSeeMapa, pricingAccessLevel }: Props) {
  const pathname = usePathname();
  const router   = useRouter();
  const sections = visibleNavSections({
    isAdmin: user.role === 'admin',
    inventory: canSeeInventory,
    dwh: canSeeAnalitica,
    geo: canSeeMapa,
    pricing: pricingAccessLevel,
  });

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    posthog.reset();
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
    <aside className="w-52 h-full bg-gray-900 flex flex-col shrink-0 overflow-y-auto print:hidden">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-gray-700">
        <span className="text-sm font-bold text-white tracking-tight">
          ◆ ProfitPlus
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4">
        <Link href="/inicio" className={navClass('/inicio')}>
          Inicio
        </Link>
        {sections.map(({ title, links }) => (
          <div key={title}>
            <p className="px-2 mt-5 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {title}
            </p>
            {links.map(({ href, label }) => (
              <Link key={href} href={href} className={navClass(href)}>
                {label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-700">
        <Link
          href="/profile"
          className="block text-xs text-gray-400 hover:text-white mb-2 truncate transition-colors"
        >
          {user.name}
        </Link>
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
