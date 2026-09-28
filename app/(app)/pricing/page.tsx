import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { getDb } from '@/lib/db/sqlite';
import { getPricingAccessLevel } from '@/lib/pricing/access';
import PricingClient from './pricing-client';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const db = getDb();
  const accessLevel = await getPricingAccessLevel(db, session.sub, session.role);
  if (accessLevel === 'none') redirect('/reports/ventas');

  return <PricingClient canEdit={accessLevel === 'edit'} />;
}
