import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { getDb } from '@/lib/db/sqlite';
import { hasDwhAccess } from '@/lib/dwh/access';
import { HelpPanel } from '@/components/help-panel';
import { AnaliticaClient } from './analitica-client';

export default async function AnaliticaPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const db = getDb();
  const allowed = await hasDwhAccess(db, session.sub, session.role);
  if (!allowed) redirect('/inicio');

  return (
    <>
      <AnaliticaClient />
      <HelpPanel page="analitica-definiciones" />
    </>
  );
}
