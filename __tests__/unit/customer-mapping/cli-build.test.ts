import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { csvToMapping, parseCsv } from '../../../lib/customer-mapping/csv';
import { writeMasterWorkbook, writeTrackingWorkbook } from './fixtures';

const ROOT = join(import.meta.dir, '..', '..', '..');
let dir: string;
let master: string;
let tracking: string;
let out: string;

function build(extra: string[] = [], files = { master: () => master, tracking: () => tracking }) {
  const p = Bun.spawnSync(
    [process.execPath, 'run', 'scripts/mapping-build.ts', '--master', files.master(), '--tracking', files.tracking(), '--out', out, ...extra],
    { cwd: ROOT, env: process.env },
  );
  return { code: p.exitCode, err: p.stderr.toString() };
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'mapping-build-'));
  master = join(dir, 'master.xlsx');
  tracking = join(dir, 'tracking.xlsx');
  out = join(dir, 'map.csv');
  writeMasterWorkbook(master,
    [
      { code: 'J-1', name: 'Uno, C.A.', grupo: 'Abasto' }, { code: 'J-2', name: 'Dos', grupo: 'Farmacia' },
      { code: 'J-3', name: 'Tres', grupo: 'Abasto' }, { code: 'J-4', name: 'Cuatro', grupo: 'Abasto' },
    ],
    [
      { numero: 'F1', fecha: '01/09/2026', code: 'J-1', seller: '7' }, { numero: 'F2', fecha: '02/09/2026', code: 'J-2', seller: '7' },
      { numero: 'F3', fecha: '03/09/2026', code: 'J-3', seller: '9' }, { numero: 'F4', fecha: '04/09/2026', code: 'J-4', seller: '9' },
    ]);
  writeTrackingWorkbook(tracking, [
    { code: 'J-1', ruta: 3, frecuencia: 'Semanal' }, { code: 'J-2', ruta: 3, frecuencia: 'Quincenal' },
    { code: 'J-3', ruta: 3, frecuencia: null }, { code: 'J-4', ruta: null, frecuencia: 'Mensual' },
    { code: '172', ruta: null, frecuencia: null },
  ]);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('mapping:build CLI (synthetic workbooks)', () => {
  test('builds mapping, conflicts and route-owner files; route owner reassigns the straggler', () => {
    const r = build();
    expect(r.err).toBe('');
    expect(r.code).toBe(0);
    const { rows, errors } = csvToMapping(readFileSync(out, 'utf8'));
    expect(errors).toEqual([]);
    expect(rows.map(x => [x.coCli, x.ruta, x.frecuencia, x.coVen])).toEqual([
      ['J-1', 3, 'SEMANAL', '7'], ['J-2', 3, 'QUINCENAL', '7'], ['J-3', 3, 'SEMANAL', '7'], ['J-4', null, 'MENSUAL', '9'],
    ]);
    expect(rows[2].sourceNote).toContain('vendedor de la ruta 3: 7');
    const conflicts = parseCsv(readFileSync(out.replace(/\.csv$/, '.conflicts.csv'), 'utf8')).slice(1);
    const kinds = conflicts.map(c => c[2]);
    expect(kinds).toEqual(expect.arrayContaining(['missing_route', 'route_code_not_in_master', 'seller_overridden_by_route_owner']));
    const routes = parseCsv(readFileSync(out.replace(/\.csv$/, '.routes.csv'), 'utf8'));
    expect(routes[1]).toEqual(['3', 'CCS003', '7', '3', '7:2 | 9:1', 'varios_vendedores']);
  });
  test('refuses to overwrite an existing output (it may hold hand edits) unless --force', () => {
    writeFileSync(out, 'hand edited');
    const refused = build();
    expect(refused.code).toBe(1);
    expect(refused.err).toMatch(/--force/);
    expect(readFileSync(out, 'utf8')).toBe('hand edited');
    const forced = build(['--force']);
    expect(forced.code).toBe(0);
    expect(readFileSync(out, 'utf8')).not.toBe('hand edited');
  });
  test('missing --tracking prints the usage and exits 1', () => {
    const target = join(dir, 'nothing.csv');
    const p = Bun.spawnSync([process.execPath, 'run', 'scripts/mapping-build.ts', '--master', master, '--out', target], { cwd: ROOT, env: process.env });
    expect(p.exitCode).toBe(1);
    expect(p.stderr.toString()).toMatch(/--tracking/);
    expect(existsSync(target)).toBe(false); // the --out the failing run was given was not created
  });
});
