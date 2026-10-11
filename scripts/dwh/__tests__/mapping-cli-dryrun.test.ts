// Read-only against the ERP (dry-run never writes). SQLite is pinned to a temp dir so the dev DB is untouched.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPool } from '../../../lib/db/mssql';
import { csvToMapping, mappingToCsv, parseCsv } from '../../../lib/customer-mapping/csv';
import { writeMasterWorkbook, writeTrackingWorkbook } from '../../../__tests__/unit/customer-mapping/fixtures';

const ROOT = join(import.meta.dir, '..', '..', '..');
let dir: string;
let csv: string;
let codes: string[];
let s1: string;
let s2: string;

const run = (script: string, args: string[]) => {
  const p = Bun.spawnSync([process.execPath, 'run', script, ...args], {
    cwd: ROOT, env: { ...process.env, SQLITE_PATH: dir },
  });
  return { code: p.exitCode, out: p.stdout.toString(), err: p.stderr.toString() };
};
const diffRows = (file: string) => parseCsv(readFileSync(file.replace(/\.csv$/, '.diff.csv'), 'utf8')).slice(1);

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'mapping-cli-'));
  mkdirSync(join(dir, 'data'));
  csv = join(dir, 'm.csv');
  const pool = await getPool();
  try {
    const c = await pool.request().query(`SELECT TOP 4 RTRIM(co_cli) AS coCli FROM saCliente WHERE inactivo = 0 ORDER BY co_cli`);
    codes = c.recordset.map((r: { coCli: string }) => r.coCli);
    const s = await pool.request().query(`SELECT TOP 2 RTRIM(co_ven) AS coVen FROM saVendedor WHERE inactivo = 0 ORDER BY co_ven`);
    [s1, s2] = s.recordset.map((r: { coVen: string }) => r.coVen);
  } finally { await pool.close(); }
  expect(codes).toHaveLength(4);
  expect(s2).toBeDefined();

  // Routes 996/997 do not exist in any ERP copy; customers A,B,C share route 996 (sellers s1,s1,s2), D is alone on 997.
  writeMasterWorkbook(join(dir, 'master.xlsx'),
    codes.map((code, i) => ({ code, name: `Cliente ${i}`, grupo: 'Grupo Prueba CLI' })),
    [
      { numero: 'F1', fecha: '01/09/2026', code: codes[0], seller: s1 }, { numero: 'F2', fecha: '02/09/2026', code: codes[1], seller: s1 },
      { numero: 'F3', fecha: '03/09/2026', code: codes[2], seller: s2 }, { numero: 'F4', fecha: '04/09/2026', code: codes[3], seller: s2 },
    ]);
  writeTrackingWorkbook(join(dir, 'tracking.xlsx'), [
    { code: codes[0], ruta: 996, frecuencia: 'Semanal' }, { code: codes[1], ruta: 996, frecuencia: 'Quincenal' },
    { code: codes[2], ruta: 996, frecuencia: null }, { code: codes[3], ruta: 997, frecuencia: 'Mensual' },
  ]);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('mapping:build -> mapping:apply dry-run (synthetic workbooks, local ERP read-only)', () => {
  test('build output is accepted by apply: zones to create, route changes, route owner reassigns the straggler', () => {
    const b = run('scripts/mapping-build.ts', ['--master', join(dir, 'master.xlsx'), '--tracking', join(dir, 'tracking.xlsx'), '--out', csv]);
    expect(b.err).toBe('');
    expect(b.code).toBe(0);
    const { rows, errors } = csvToMapping(readFileSync(csv, 'utf8'));
    expect(errors).toEqual([]);
    expect(rows.map(r => r.coVen)).toEqual([s1, s1, s1, s2]); // C was s2, route 996 owner is s1
    const routes = parseCsv(readFileSync(csv.replace(/\.csv$/, '.routes.csv'), 'utf8'));
    expect(routes.find(r => r[0] === '996')!.slice(0, 4)).toEqual(['996', 'CCS996', s1, '3']);

    const a = run('scripts/mapping-apply.ts', ['--file', csv]);
    expect(a.err).toBe('');
    expect(a.code).toBe(0);
    expect(a.out).toMatch(/Simulación: no se escribió nada/);
    const d = diffRows(csv);
    expect(d.filter(r => r[0] === 'crear_zona').map(r => [r[1], r[3]])).toEqual([['CCS996', 'Ruta 996'], ['CCS997', 'Ruta 997']]);
    const routeChanges = d.filter(r => r[0] === 'cliente_ruta');
    expect(routeChanges.map(r => r[1]).sort()).toEqual([...codes].sort());
    expect(routeChanges.find(r => r[1] === codes[1])![3]).toBe('CCS996/QUINCENAL');
    expect(routeChanges.find(r => r[1] === codes[2])![3]).toBe('CCS996/SEMANAL'); // blank frequency defaults
    expect(d.some(r => r[0].startsWith('PROBLEMA_'))).toBe(false);
  });

  test('a customer whose seller is not the route owner blocks apply (exit 1, PROBLEMA_ row)', () => {
    const { rows } = csvToMapping(readFileSync(csv, 'utf8'));
    const edited = rows.map(r => (r.coCli === codes[2] ? { ...r, coVen: s2 } : r));
    const bad = join(dir, 'edited.csv');
    writeFileSync(bad, mappingToCsv(edited));
    const a = run('scripts/mapping-apply.ts', ['--file', bad]);
    expect(a.code).toBe(1);
    const problems = diffRows(bad).filter(r => r[0].startsWith('PROBLEMA_'));
    expect(problems.map(r => [r[0], r[1]])).toEqual([['PROBLEMA_seller_not_route_owner', codes[2]]]);
  });

  test('a customer without route blocks apply', () => {
    const { rows } = csvToMapping(readFileSync(csv, 'utf8'));
    const bad = join(dir, 'noroute.csv');
    writeFileSync(bad, mappingToCsv(rows.map(r => (r.coCli === codes[3] ? { ...r, ruta: null } : r))));
    const a = run('scripts/mapping-apply.ts', ['--file', bad]);
    expect(a.code).toBe(1);
    expect(diffRows(bad).map(r => r[0])).toContain('PROBLEMA_missing_route');
  });
});
