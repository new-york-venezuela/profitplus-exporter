import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { getDb } from '@/lib/db/sqlite';
import { hasInventoryAccess } from '@/lib/inventory/access';
import { hasDwhAccess } from '@/lib/dwh/access';
import { Sidebar }    from '@/components/sidebar';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const db = getDb();
  const canSeeInventory = await hasInventoryAccess(db, session.sub, session.role);
  const canSeeAnalitica  = await hasDwhAccess(db, session.sub, session.role);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={session} canSeeInventory={canSeeInventory} canSeeAnalitica={canSeeAnalitica} />
      <main className="flex-1 overflow-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
}
