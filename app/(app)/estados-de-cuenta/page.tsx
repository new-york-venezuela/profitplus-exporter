import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { getDb } from '@/lib/db/sqlite';
import { hasStatementsAccess } from '@/lib/statements/access';
import { EstadosDeCuentaClient } from './estados-de-cuenta-client';

export default async function EstadosDeCuentaPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const allowed = await hasStatementsAccess(getDb(), session.sub, session.role);
  if (!allowed) redirect('/reports/ventas');
  return <EstadosDeCuentaClient />;
}
