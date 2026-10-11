import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { buildMapping } from '@/lib/customer-mapping/build';
import { conflictsToCsv, mappingToCsv } from '@/lib/customer-mapping/csv';
import { readWorkbook } from '@/lib/customer-mapping/workbook';

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string', default: 'data/customer-mapping/2026-03.csv' },
      from: { type: 'string', default: '2026-03-01' },
    },
  });
  const xlsx = positionals[0];
  if (!xlsx) throw new Error('Uso: bun run mapping:build -- <archivo.xlsx> [--out ruta.csv] [--from YYYY-MM-DD]');
  if (!values.out!.endsWith('.csv')) throw new Error(`--out debe terminar en .csv (recibido: ${values.out})`);

  const { master, lines, badDates } = readWorkbook(xlsx);
  const { rows, conflicts } = buildMapping(master, lines, { effectiveFrom: values.from! });

  const conflictsPath = values.out!.replace(/\.csv$/, '.conflicts.csv');
  await mkdir(dirname(values.out!), { recursive: true });
  await writeFile(values.out!, mappingToCsv(rows), 'utf8');
  await writeFile(conflictsPath, conflictsToCsv(conflicts), 'utf8');

  const dates = lines.map(l => l.fecha).sort();
  console.log(`Maestro: ${master.length} filas → ${rows.length} filas de mapeo`);
  console.log(`Líneas de venta: ${lines.length} (${dates[0]} … ${dates.at(-1)}), fechas ilegibles: ${badDates}`);
  const byKind = new Map<string, number>();
  for (const c of conflicts) byKind.set(c.kind, (byKind.get(c.kind) ?? 0) + 1);
  console.log('Conflictos:', Object.fromEntries(byKind));
  console.log(`Escrito: ${values.out}\nEscrito: ${conflictsPath}`);
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
