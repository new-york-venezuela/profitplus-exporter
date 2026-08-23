import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { getDb } from '@/lib/db/sqlite';
import { hasInventoryAccess } from '@/lib/inventory/access';
import { DashboardClient } from './dashboard-client';

export default async function InventoryDashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const db = getDb();
  const allowed = await hasInventoryAccess(db, session.sub, session.role);
  if (!allowed) redirect('/reports/ventas');

  return <DashboardClient />;
}
