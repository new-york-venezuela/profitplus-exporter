import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db/mssql';
import { requirePricingAccess } from '@/lib/pricing/access';
import { listCustomerFilterOptions } from '@/lib/pricing/customers-query';
import { captureException } from '@/lib/analytics/posthog';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requirePricingAccess(request, 'view');
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json(await listCustomerFilterOptions(await getPool()));
  } catch (error) {
    console.error('Pricing customer filters error:', error);
    captureException(error, auth.session.sub);
    return NextResponse.json({ error: 'Error al consultar filtros' }, { status: 500 });
  }
}
