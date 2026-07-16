import { NextRequest, NextResponse } from 'next/server';
import { queryComprasData } from '@/lib/reports/queries/compras-query';
import { mapComprasData } from '@/lib/reports/mappers/compras-mapper';
import { generateComprasCsv } from '@/lib/reports/csv/compras-csv-generator';

export async function handleComprasCsvExport(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const sucursal = searchParams.get('sucursal') || '000001';

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing startDate or endDate parameters' },
        { status: 400 }
      );
    }

    const rows = await queryComprasData(startDate, endDate, sucursal);
    const exportRows = mapComprasData(rows);
    const csv = generateComprasCsv(exportRows);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename=libro-de-compras.csv',
      },
    });
  } catch (error) {
    console.error('Error generating compras CSV:', error);
    return NextResponse.json(
      { error: 'Failed to generate CSV export' },
      { status: 500 }
    );
  }
}
