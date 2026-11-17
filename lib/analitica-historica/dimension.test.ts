import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { parseClienteDimension } from './dimension';
import * as sqlModule from './sql';

describe('parseClienteDimension', () => {
  test('casa matriz is the default; only "tienda" switches to per store', () => {
    expect(parseClienteDimension(null)).toBe('entidad');
    expect(parseClienteDimension('entidad')).toBe('entidad');
    expect(parseClienteDimension('tienda')).toBe('tienda');
    expect(parseClienteDimension('x')).toBe('entidad');
  });

  test('is still exported from sql.ts for the server code', () => {
    expect(sqlModule.parseClienteDimension).toBe(parseClienteDimension);
  });

  test('stays free of imports so client components can use it (sql.ts pulls in mssql)', () => {
    const src = readFileSync(new URL('./dimension.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/^\s*import\s/m);
  });
});
