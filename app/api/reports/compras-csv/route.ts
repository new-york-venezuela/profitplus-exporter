import { handleComprasCsvExport } from '@/lib/routes/api/reports/compras-csv';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  return handleComprasCsvExport(request);
}
