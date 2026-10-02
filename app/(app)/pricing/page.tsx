import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { getDb } from '@/lib/db/sqlite';
import { getPricingAccessLevel } from '@/lib/pricing/access';
import { Suspense } from 'react';
import PricingShell from './pricing-shell';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const db = getDb();
  const accessLevel = await getPricingAccessLevel(db, session.sub, session.role);
  if (accessLevel === 'none') redirect('/inicio');

  return <Suspense fallback={null}><PricingShell canEdit={accessLevel === 'edit'} /></Suspense>;
}
