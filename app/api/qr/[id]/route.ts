import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { qrCodes } from '@/lib/db/schema';
import { captureEvent, captureException } from '@/lib/analytics/posthog';
import { parseQrFields, sniffLogo } from '@/lib/qr/validation';
import { saveLogo, deleteLogo } from '@/lib/qr/logo-storage';
import { toQrDto } from '@/lib/qr/dto';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

async function findOwned(request: NextRequest, ctx: Ctx) {
  const session = await getSessionFromRequest(request);
  if (!session) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  const id = Number((await ctx.params).id);
  const notFound = NextResponse.json({ error: 'Código QR no encontrado' }, { status: 404 });
  if (!Number.isInteger(id)) return { error: notFound };
  const row = getDb().select().from(qrCodes)
    .where(and(eq(qrCodes.id, id), eq(qrCodes.userId, parseInt(session.sub, 10)))).get();
  if (!row) return { error: notFound };
  return { session, row };
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const found = await findOwned(request, ctx);
    if ('error' in found) return found.error;
    const { session, row } = found;

    const form = await request.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    const parsed = parseQrFields(form);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { name, content, logoMode, fgColor, logoFile } = parsed.value;

    let logoPath: string | null = row.logoPath;
    let staleLogo: string | null = null;

    if (logoMode !== 'custom') {
      staleLogo = row.logoPath;
      logoPath = null;
    } else if (logoFile) {
      const bytes = new Uint8Array(await logoFile.arrayBuffer());
      const kind = sniffLogo(bytes);
      if (!kind) return NextResponse.json({ error: 'El logo debe ser PNG, JPG o SVG válido' }, { status: 400 });
      staleLogo = row.logoPath;
      logoPath = await saveLogo(bytes, kind);
    } else if (!row.logoPath) {
      return NextResponse.json({ error: 'Falta el archivo del logo' }, { status: 400 });
    }

    const updated = getDb().update(qrCodes)
      .set({ name, content, logoMode, fgColor, logoPath, updatedAt: Date.now() })
      .where(eq(qrCodes.id, row.id)).returning().get()!;
    await deleteLogo(staleLogo);

    captureEvent(session.sub, 'qr_updated', { logoMode });
    return NextResponse.json({ item: toQrDto(updated) });
  } catch (err) {
    console.error('PATCH /api/qr/[id] failed', err);
    captureException(err, 'anonymous');
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  try {
    const found = await findOwned(request, ctx);
    if ('error' in found) return found.error;
    const { session, row } = found;

    getDb().delete(qrCodes).where(eq(qrCodes.id, row.id)).run();
    await deleteLogo(row.logoPath);

    captureEvent(session.sub, 'qr_deleted', {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/qr/[id] failed', err);
    captureException(err, 'anonymous');
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
