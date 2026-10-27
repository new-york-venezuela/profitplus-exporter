import { NextRequest, NextResponse } from 'next/server';
import { requireStatementsAccess } from '@/lib/statements/access';
import { getPool } from '@/lib/db/mssql';
import { generateStatementPdf } from '@/lib/statements/generate';
import { captureEvent, captureException } from '@/lib/analytics/posthog';

export async function GET(request: NextRequest, { params }: { params: Promise<{ co_cli: string }> }) {
  const access = await requireStatementsAccess(request);
  if (!access.ok) return access.response;
  try {
    const coCli = (await params).co_cli.trim();
    if (!coCli || coCli.length > 30) {
      return NextResponse.json({ error: 'Código de cliente inválido' }, { status: 400 });
    }
    const result = await generateStatementPdf(await getPool(), coCli);
    if (!result) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    captureEvent(access.session.sub, 'statement_downloaded', { co_cli: coCli, incomplete: result.statement.incomplete });
    return new NextResponse(new Uint8Array(result.pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${result.fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Statement PDF error:', error);
    captureException(error, access.session.sub);
    return NextResponse.json({ error: 'Error al generar el estado de cuenta' }, { status: 500 });
  }
}
