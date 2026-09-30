import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { qrCodes } from '@/lib/db/schema';
import { captureEvent, captureException } from '@/lib/analytics/posthog';
import { parseQrFields, sniffLogo } from '@/lib/qr/validation';
import { saveLogo } from '@/lib/qr/logo-storage';
import { toQrDto } from '@/lib/qr/dto';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const rows = getDb().select().from(qrCodes)
      .where(eq(qrCodes.userId, parseInt(session.sub, 10)))
      .orderBy(desc(qrCodes.updatedAt)).all();
    return NextResponse.json({ items: rows.map(toQrDto) });
  } catch (err) {
    console.error('GET /api/qr failed', err);
    captureException(err, 'anonymous');
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const form = await request.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    const parsed = parseQrFields(form);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { name, content, logoMode, fgColor, logoFile } = parsed.value;

    let logoPath: string | null = null;
    if (logoMode === 'custom') {
      if (!logoFile) return NextResponse.json({ error: 'Falta el archivo del logo' }, { status: 400 });
      const bytes = new Uint8Array(await logoFile.arrayBuffer());
      const kind = sniffLogo(bytes);
      if (!kind) return NextResponse.json({ error: 'El logo debe ser PNG, JPG o SVG válido' }, { status: 400 });
      logoPath = await saveLogo(bytes, kind);
    }

    const now = Date.now();
    const row = getDb().insert(qrCodes).values({
      userId: parseInt(session.sub, 10), name, content, logoMode, logoPath, fgColor,
      createdAt: now, updatedAt: now,
    }).returning().get()!;

    captureEvent(session.sub, 'qr_created', { logoMode });
    return NextResponse.json({ item: toQrDto(row) }, { status: 201 });
  } catch (err) {
    console.error('POST /api/qr failed', err);
    captureException(err, 'anonymous');
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
