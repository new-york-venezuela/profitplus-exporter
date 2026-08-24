import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { getDb } from '@/lib/db/sqlite';
import { hasInventoryAccess } from '@/lib/inventory/access';
import { HelpPanel } from '@/components/help-panel';
import { AjustesClient } from './ajustes-client';

export default async function AjustesPage({
  searchParams,
}: {
  searchParams: Promise<{ co_art?: string; co_alma?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const db = getDb();
  const allowed = await hasInventoryAccess(db, session.sub, session.role);
  if (!allowed) redirect('/reports/ventas');

  const params = await searchParams;

  return (
    <>
      <AjustesClient initialCoArt={params.co_art} initialCoAlma={params.co_alma} />
      <HelpPanel page="ajustes" />
    </>
  );
}
