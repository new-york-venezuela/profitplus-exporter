import { NextRequest, NextResponse } from 'next/server';
import { requireStatementsAccess } from '@/lib/statements/access';
import { getPool } from '@/lib/db/mssql';
import { listCustomersForPicker } from '@/lib/statements/repo';
import { captureException } from '@/lib/analytics/posthog';

// Response depends on the session; never prerender it statically at build time.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const access = await requireStatementsAccess(request);
  if (!access.ok) return access.response;
  try {
    const customers = await listCustomersForPicker(await getPool());
    return NextResponse.json({ customers });
  } catch (error) {
    console.error('Statements customers error:', error);
    captureException(error, access.session.sub);
    return NextResponse.json({ error: 'Error al cargar clientes' }, { status: 500 });
  }
}
