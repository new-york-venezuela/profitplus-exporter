import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { getDb } from '@/lib/db/sqlite';
import { hasInventoryAccess } from '@/lib/inventory/access';
import { HelpPanel } from '@/components/help-panel';
import { AjustesClient } from './ajustes-client';

export default async function AjustesPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const db = getDb();
  const allowed = await hasInventoryAccess(db, session.sub, session.role);
  if (!allowed) redirect('/reports/ventas');

  return (
    <>
      <AjustesClient />
      <HelpPanel page="ajustes" />
    </>
  );
}
