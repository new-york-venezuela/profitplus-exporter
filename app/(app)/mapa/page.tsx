import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { getDb } from '@/lib/db/sqlite';
import { hasGeoAccess } from '@/lib/geo/access';
import MapaLoader from './mapa-loader';

export const dynamic = 'force-dynamic';

export default async function MapaPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const allowed = await hasGeoAccess(getDb(), session.sub, session.role);
  if (!allowed) redirect('/inicio');

  return <MapaLoader />;
}
