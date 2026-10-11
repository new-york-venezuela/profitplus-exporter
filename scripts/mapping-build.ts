import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { buildMapping } from '@/lib/customer-mapping/build';
import { conflictsToCsv, mappingToCsv, routeOwnersToCsv } from '@/lib/customer-mapping/csv';
import { readTrackingWorkbook, readWorkbook } from '@/lib/customer-mapping/workbook';

const USAGE = 'Uso: bun run mapping:build -- --master <2026-bbdd-profit.xlsx> --tracking <10-2026-ventas-seguimiento-por-ruta.xlsx> ' +
  '[--out data/customer-mapping/2026-03.csv] [--from YYYY-MM-DD] [--force]';

async function main() {
  const { values } = parseArgs({
    options: {
      master: { type: 'string' }, tracking: { type: 'string' },
      out: { type: 'string', default: 'data/customer-mapping/2026-03.csv' },
      from: { type: 'string', default: '2026-03-01' },
      force: { type: 'boolean', default: false },
    },
  });
  if (!values.master || !values.tracking) throw new Error(USAGE);
  const out = values.out!;
  if (!out.endsWith('.csv')) throw new Error(`--out debe terminar en .csv (recibido: ${out})`);
  const conflictsPath = out.replace(/\.csv$/, '.conflicts.csv');
  const routesPath = out.replace(/\.csv$/, '.routes.csv');
  if (!values.force) {
    for (const p of [out, conflictsPath, routesPath]) {
      if (existsSync(p)) throw new Error(`${p} ya existe (puede tener ediciones a mano); use --force para sobrescribir`);
    }
  }

  const { master, lines, badDates } = readWorkbook(values.master);
  const { tracking } = readTrackingWorkbook(values.tracking);
  const { rows, conflicts, owners } = buildMapping(master, lines, tracking, { effectiveFrom: values.from! });

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, mappingToCsv(rows), 'utf8');
  await writeFile(conflictsPath, conflictsToCsv(conflicts), 'utf8');
  await writeFile(routesPath, routeOwnersToCsv(owners), 'utf8');

  const dates = lines.map(l => l.fecha).sort();
  console.log(`Maestro: ${master.length} filas; seguimiento: ${tracking.length} filas → ${rows.length} filas de mapeo`);
  console.log(`Líneas de venta: ${lines.length} (${dates[0]} … ${dates.at(-1)}), fechas ilegibles: ${badDates}`);
  const byKind = new Map<string, number>();
  for (const c of conflicts) byKind.set(c.kind, (byKind.get(c.kind) ?? 0) + 1);
  console.log('Conflictos:', Object.fromEntries(byKind));
  const ties = owners.filter(o => o.tie).length;
  const noOwner = owners.filter(o => !o.tie && o.owner == null).length;
  console.log(`Rutas: ${owners.length} (empates: ${ties}, sin vendedor: ${noOwner})`);
  console.log(`Escrito: ${out}\nEscrito: ${conflictsPath}\nEscrito: ${routesPath}`);
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
