// Read-only against the ERP (dry-run never writes). SQLite is pinned to a temp dir so the dev DB is untouched.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPool } from '../../../lib/db/mssql';
import { parseCsv } from '../../../lib/customer-mapping/csv';

const ROOT = join(import.meta.dir, '..', '..', '..');
let dir: string;
let codes: string[];
let s1: string;
let s2: string;

const run = (args: string[]) => {
  const p = Bun.spawnSync([process.execPath, 'run', 'scripts/mapping-apply.ts', ...args], {
    cwd: ROOT, env: { ...process.env, SQLITE_PATH: dir },
  });
  return { code: p.exitCode, out: p.stdout.toString(), err: p.stderr.toString() };
};
const writeMapping = (name: string, lines: string[]) => {
  const file = join(dir, name);
  writeFileSync(file, ['co_cli,nombre,co_ven,grupo,ruta,frecuencia', ...lines].join('\n') + '\n');
  return file;
};
const diffRows = (file: string) => parseCsv(readFileSync(file.replace(/\.csv$/, '.diff.csv'), 'utf8')).slice(1);

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'mapping-cli-'));
  mkdirSync(join(dir, 'data'));
  const pool = await getPool();
  try {
    const c = await pool.request().query(`SELECT TOP 4 RTRIM(co_cli) AS coCli FROM saCliente WHERE inactivo = 0 ORDER BY co_cli`);
    codes = c.recordset.map((r: { coCli: string }) => r.coCli);
    const s = await pool.request().query(`SELECT TOP 2 RTRIM(co_ven) AS coVen FROM saVendedor WHERE inactivo = 0 ORDER BY co_ven`);
    [s1, s2] = s.recordset.map((r: { coVen: string }) => r.coVen);
  } finally { await pool.close(); }
  expect(codes).toHaveLength(4);
  expect(s2).toBeDefined();
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('mapping:apply dry-run (local ERP read-only)', () => {
  test('plans zones and route changes; sellers need not be the route owner; nothing is written', () => {
    // Routes 996/997 exist in no ERP copy. Customers A and B share route 996 with different sellers on purpose.
    const file = writeMapping('ok.csv', [
      `${codes[0]},A,${s1},Grupo Prueba CLI,996,SEMANAL`,
      `${codes[1]},B,${s2},Grupo Prueba CLI,996,QUINCENAL`,
      `${codes[2]},C,${s1},Grupo Prueba CLI,996,`,
      `${codes[3]},D,,Grupo Prueba CLI,997,MENSUAL`,
    ]);
    const a = run(['--file', file]);
    expect(a.err).toBe('');
    expect(a.code).toBe(0);
    expect(a.out).toMatch(/Simulación: no se escribió nada/);
    const d = diffRows(file);
    expect(d.filter(r => r[0] === 'crear_zona').map(r => [r[1], r[3]])).toEqual([['CCS996', 'Ruta 996'], ['CCS997', 'Ruta 997']]);
    const routeChanges = d.filter(r => r[0] === 'cliente_ruta');
    expect(routeChanges.map(r => r[1]).sort()).toEqual([...codes].sort());
    expect(routeChanges.find(r => r[1] === codes[1])![3]).toBe('CCS996/QUINCENAL');
    expect(routeChanges.find(r => r[1] === codes[2])![3]).toBe('CCS996/SEMANAL'); // blank frequency defaults
    expect(d.some(r => r[0].startsWith('PROBLEMA_'))).toBe(false);
  });

  test('an unknown customer blocks apply (exit 1, PROBLEMA_ row)', () => {
    const file = writeMapping('bad.csv', [`NO-EXISTE-XYZ,X,${s1},Grupo Prueba CLI,996,SEMANAL`]);
    const a = run(['--file', file]);
    expect(a.code).toBe(1);
    expect(diffRows(file).map(r => [r[0], r[1]])).toContainEqual(['PROBLEMA_unknown_customer', 'NO-EXISTE-XYZ']);
  });
});
