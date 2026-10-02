// app/api/pricing/price-lists/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePricingAccess } from '@/lib/pricing/access';
import { listPriceListDtos } from '@/lib/pricing/lists-service';
import { buildListsDeps } from '@/lib/pricing/http';
import { captureException } from '@/lib/analytics/posthog';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requirePricingAccess(request, 'view');
  if (!auth.ok) return auth.response;
  try {
    const { priceLists, currencies } = await listPriceListDtos(await buildListsDeps());
    // assignedCustomerCount kept for Plan 1 UI consumers.
    return NextResponse.json({
      priceLists: priceLists.map(p => ({ ...p, assignedCustomerCount: p.customerCount })),
      currencies,
    });
  } catch (error) {
    console.error('Pricing price-lists list error:', error);
    captureException(error, auth.session.sub);
    return NextResponse.json({ error: 'Error al consultar listas de precio' }, { status: 500 });
  }
}
