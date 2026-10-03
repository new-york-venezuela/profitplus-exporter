import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/sqlite';
import { validateAlertSettingsBody } from '@/lib/pricing/alert-validators';
import { getAlertSettings, saveAlertSettings } from '@/lib/pricing/health-repo';
import { requirePricingAdmin } from '@/lib/pricing/http';
import { captureEvent, captureException } from '@/lib/analytics/posthog';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requirePricingAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ settings: getAlertSettings(getDb()) });
  } catch (error) {
    console.error('Pricing alert settings read error:', error);
    captureException(error, auth.session.sub, {});
    return NextResponse.json({ error: 'Error al cargar la configuración de alertas' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requirePricingAdmin(request);
  if (!auth.ok) return auth.response;
  const parsed = validateAlertSettingsBody(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const db = getDb();
    saveAlertSettings(db, parsed.value);
    captureEvent(auth.session.sub, 'pricing_alert_settings_updated', {
      enabled: parsed.value.enabled, daysAhead: parsed.value.daysAhead,
      customRecipients: parsed.value.recipients !== null, recipientCount: parsed.value.recipients?.length ?? 0,
    });
    return NextResponse.json({ settings: getAlertSettings(db) });
  } catch (error) {
    console.error('Pricing alert settings save error:', error);
    captureException(error, auth.session.sub, {});
    return NextResponse.json({ error: 'Error al guardar la configuración de alertas' }, { status: 500 });
  }
}
