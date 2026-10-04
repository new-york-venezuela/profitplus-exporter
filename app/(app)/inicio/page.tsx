import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { getDb } from '@/lib/db/sqlite';
import { hasInventoryAccess } from '@/lib/inventory/access';
import { hasDwhAccess } from '@/lib/dwh/access';
import { hasGeoAccess } from '@/lib/geo/access';
import { hasRecipesAccess } from '@/lib/recipes/access';
import { getPricingAccessLevel } from '@/lib/pricing/access';
import { visibleNavSections } from '@/lib/nav';

export default async function InicioPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const db = getDb();
  const sections = visibleNavSections({
    isAdmin: session.role === 'admin',
    inventory: await hasInventoryAccess(db, session.sub, session.role),
    dwh: await hasDwhAccess(db, session.sub, session.role),
    geo: await hasGeoAccess(db, session.sub, session.role),
    recipes: await hasRecipesAccess(db, session.sub, session.role),
    pricing: await getPricingAccessLevel(db, session.sub, session.role),
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Bienvenido, {session.name}</h1>
      <p className="mt-1 text-sm text-gray-500">Accesos rápidos a lo que puedes usar.</p>

      {sections.map(({ title, links }) => (
        <section key={title} className="mt-8">
          <h2 className="mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {links.map(({ href, label, description }) => (
              <Link
                key={href}
                href={href}
                className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-500 hover:bg-blue-50"
              >
                <span className="block text-sm font-semibold text-gray-900">{label}</span>
                <span className="mt-1 block text-sm text-gray-500">{description}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
