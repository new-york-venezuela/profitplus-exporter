// app/api/pricing/assignments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePricingAccess } from '@/lib/pricing/access';
import { assignCustomers } from '@/lib/pricing/segments-service';
import { validateAssignmentBody } from '@/lib/pricing/validators';
import { actorFrom, buildDeps, serviceErrorResponse } from '@/lib/pricing/http';
import { captureEvent, captureException } from '@/lib/analytics/posthog';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requirePricingAccess(request, 'edit');
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => null);
  const parsed = validateAssignmentBody(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const results = await assignCustomers(await buildDeps(), parsed.value, actorFrom(auth.session));
    captureEvent(auth.session.sub, 'pricing_assignment_applied', {
      targetTipCli: parsed.value.targetTipCli,
      customerCount: results.length,
      successCount: results.filter(r => r.outcome === 'success').length,
      conflictCount: results.filter(r => r.outcome === 'conflict').length,
      errorCount: results.filter(r => r.outcome === 'error').length,
    });
    return NextResponse.json({ results });
  } catch (error) {
    const mapped = serviceErrorResponse(error);
    if (mapped) return mapped;
    console.error('Pricing assignment route error:', error);
    captureException(error, auth.session.sub, { customerCount: parsed.value.customerCodes.length });
    return NextResponse.json({ error: 'Error al aplicar las asignaciones' }, { status: 500 });
  }
}
