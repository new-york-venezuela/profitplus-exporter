// app/api/pricing/lists/[coPrecio]/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePricingAccess } from '@/lib/pricing/access';
import { getRatesGrid } from '@/lib/pricing/lists-service';
import { buildListCsv } from '@/lib/pricing/list-export';
import { buildListsDeps, serviceErrorResponse } from '@/lib/pricing/http';
import { captureException } from '@/lib/analytics/posthog';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ coPrecio: string }> }) {
  const auth = await requirePricingAccess(request, 'view');
  if (!auth.ok) return auth.response;
  const { coPrecio } = await params;
  if (coPrecio.length === 0 || coPrecio.length > 6) return NextResponse.json({ error: 'Código de lista inválido' }, { status: 400 });
  try {
    const grid = await getRatesGrid(await buildListsDeps(), coPrecio, null);
    const safe = coPrecio.replace(/[^A-Za-z0-9_-]/g, '_');
    return new NextResponse(buildListCsv(grid.rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="lista-${safe}.csv"`,
      },
    });
  } catch (error) {
    const mapped = serviceErrorResponse(error);
    if (mapped) return mapped;
    console.error('Pricing list export error:', error);
    captureException(error, auth.session.sub, { coPrecio });
    return NextResponse.json({ error: 'Error al exportar la lista' }, { status: 500 });
  }
}
