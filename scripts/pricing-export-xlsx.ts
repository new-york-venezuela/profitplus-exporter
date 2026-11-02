import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { getPool } from '@/lib/db/mssql';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getDb } from '@/lib/db/sqlite';
import { todayIso } from '@/lib/pricing/dates';
import { buildExportWorkbook, loadExportData } from '@/lib/pricing/xlsx/export';

const DEFAULT_OUT = 'data/pricing-lists/precios-actuales.xlsx';
const MAX_WARN = 20;

async function main() {
  const { values } = parseArgs({ options: { out: { type: 'string' } } });
  const out = values.out ?? DEFAULT_OUT;
  if (existsSync(out)) { console.error(`${out} ya existe; no se sobrescribe. Elige otra ruta con --out.`); process.exit(1); }

  const erp = await getPool();
  const dwh = await getDwhPool();
  try {
    const today = todayIso();
    const data = await loadExportData({ erp, dwh, db: getDb(), today });
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, buildExportWorkbook(data, today));
    console.log(`${data.lists.length} listas, ${data.articles.length} artículos, ${data.promotions.length} promociones, ${data.customers.length} clientes -> ${out}`);
    for (const a of data.unclassified.slice(0, MAX_WARN)) console.warn(`Sin clasificar en el DWH (fuera del archivo): ${a.coArt} ${a.artDes}`);
    if (data.unclassified.length > MAX_WARN) console.warn(`… y ${data.unclassified.length - MAX_WARN} más`);
  } finally {
    await erp.close();
    await dwh.close();
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
