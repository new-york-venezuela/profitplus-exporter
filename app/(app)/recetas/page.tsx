import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { getDb } from '@/lib/db/sqlite';
import { hasRecipesAccess } from '@/lib/recipes/access';
import { HelpPanel } from '@/components/help-panel';
import { RecetasClient } from './recetas-client';

export default async function RecetasPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const db = getDb();
  const allowed = await hasRecipesAccess(db, session.sub, session.role);
  if (!allowed) redirect('/reports/ventas');

  return (
    <>
      <RecetasClient />
      <HelpPanel page="recetas" />
    </>
  );
}
