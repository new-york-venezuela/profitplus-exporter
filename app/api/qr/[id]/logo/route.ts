import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { qrCodes } from '@/lib/db/schema';
import { readLogo } from '@/lib/qr/logo-storage';

export const dynamic = 'force-dynamic';

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml' };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const id = Number((await params).id);
  const notFound = NextResponse.json({ error: 'Logo no encontrado' }, { status: 404 });
  if (!Number.isInteger(id)) return notFound;

  const row = getDb().select().from(qrCodes)
    .where(and(eq(qrCodes.id, id), eq(qrCodes.userId, parseInt(session.sub, 10)))).get();
  if (!row?.logoPath) return notFound;

  const bytes = await readLogo(row.logoPath);
  if (!bytes) return notFound;

  const ext = row.logoPath.split('.').pop() ?? '';
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': 'sandbox',
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  });
}
