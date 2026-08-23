import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { getSessionFromRequest } from '@/lib/inventory/access';

export const dynamic = 'force-dynamic';

// Explicit allowlist, not a derived glob: prevents path traversal via the
// [page] param and keeps this route from silently serving any new .md file
// dropped into content/help/ without a deliberate opt-in here.
const HELP_PAGES = [
  'articulos',
  'ajustes',
  'dashboard',
] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ page: string }> },
) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { page } = await params;
  if (!(HELP_PAGES as readonly string[]).includes(page)) {
    return NextResponse.json({ error: 'Página de ayuda no encontrada' }, { status: 404 });
  }

  try {
    const filePath = path.join(process.cwd(), 'content', 'help', `${page}.md`);
    const content = await readFile(filePath, 'utf-8');
    return new NextResponse(content, {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  } catch {
    return NextResponse.json({ error: 'No se pudo cargar la ayuda' }, { status: 500 });
  }
}
