# Customer Seller / Group Mapping Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a CSV-reviewable customer mapping (seller, group, type, parent) from `2026-bbdd-profit.xlsx`, a command that applies it to the ERP (customers + invoices/returns from 2026-03-01) with dry-run/rollback, and restate the DWH.

**Architecture:** Pure TypeScript modules in `lib/customer-mapping/` (parse, build, plan) sit behind two injected interfaces (`ErpGateway`, `RunStore`) so the orchestrator is unit-testable. ERP writes go only through new `pApi*` procs (`migrations/mssql/0016`). The DWH gets a mapping table + view (`migrations/dwh/0039`); seller/segment changes flow into facts through the existing incremental loads because every ERP write bumps the row's `validador`.

**Tech Stack:** Bun, TypeScript, `mssql`, Drizzle + `bun:sqlite`, SheetJS (`xlsx`, already a dependency), Bun test.

**Spec:** `docs/superpowers/specs/2026-10-11-customer-seller-segment-mapping-design.md`

## Global Constraints

- Mapping CSV: `data/customer-mapping/2026-03.csv`, columns exactly `co_cli,nombre,co_ven,grupo,tipo_cliente,cliente_principal,effective_from,source_note`; `effective_from` = `2026-03-01`.
- Seller source = seller on each customer's **latest** `Factura` line in the workbook (spec decision).
- `apply` is **dry-run by default**; writing requires `--apply` **and** `--confirm-db <DB_NAME>` equal to `process.env.DB_NAME`.
- ERP writes only through `pApi*` procs — no raw `INSERT/UPDATE` from TypeScript. `saCliente.tip_cli` is never touched (pricing depends on it).
- Annulled documents (`anulado = 1`) are never modified.
- Every document with `fec_emis >= 2026-03-01` gets the customer's mapped seller, regardless of its previous seller.
- ERP `mssql` queries use `.input()` for all values; DWH migrations are re-runnable (`IF NOT EXISTS` / `CREATE OR ALTER`).
- CSV output is produced with `buildCsv()` from `lib/csv.ts` (UTF-8 BOM).
- Drizzle queries are synchronous (no `await`).
- Commit trailer on every commit: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Deviations from the spec (found while reading the code)

1. **No watermark reset.** `Load_Fact_Sales` selects `f.validador > @HeaderWatermark`; any `UPDATE saFacturaVenta` bumps the rowversion, so the next incremental load restates those facts by itself. Same pattern for returns.
2. **No hand-edited SCD2 dates.** `Load_Dim_Customer` already versions `DefaultSalesRepCode` and re-syncs `SegmentCode` from `co_seg → saSegmento.seg_des` on every run. We just run it after the ERP fix.
3. **Mapping exposed by a view, not by altering `Dim_Customer`:** `dim.Dim_CustomerMapping` + `dim.vw_Customer_Classified`. Avoids touching the SCD2 MERGE.
4. **Extra ERP rows:** for a `FACT` the document proc also mirrors `co_ven` into the invoice's own `saDocumentoVenta` ledger row, guarded by the invoice's customer (`co_cli`), so Profit's AR ledger and commission reports agree with the invoice header. Returns (`saDevolucionCliente`) are rewritten on the header only ("if the ERP stores a seller"); their credit-note ledger rows (`N/CR`,`NCR`) are deliberately NOT touched: a credit note has its own number (linked via `doc_orig`/`nro_orig`), so matching by the return's `doc_num` could modify another customer's credit note. Final-review fix (migration `0017`, which supersedes the 0016 version of the document proc): the proc `pApiRestaurarVendedorCliente` (rollback only, accepts a seller deactivated since) and `mapping_apply_runs.target` (rollback refuses a run applied to another database) were added.
5. **Workbook dates span Jul–Oct 2026** (not Sep–Oct), mixed Excel datetimes and `dd/mm/yyyy` text. Parser handles both.

## Review Focus

- Re-running `apply` after a successful run must be a no-op (idempotent) — pinned in Task 5.
- Customer codes in the CSV that differ from the ERP only by dashes/whitespace/case must surface as `unknown_customer` problems with a suggestion, never be silently skipped — Task 4/5.
- Workbook seller `15` vs ERP `char(6)` `'15'`/`'000015'` must resolve; unknown sellers block the apply — Task 1/5.
- CSV edited in Excel (BOM, CRLF, quoted commas such as `"COCHINA ENVIDIA, C.A"`, blank `co_ven`) must round-trip — Task 1.
- A crash/failure mid-apply must leave a snapshot so `--rollback` can restore; a customer with blank `co_ven` gets its group updated but its seller and documents untouched — Task 5.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/customer-mapping/types.ts` | Shared types + `MAPPING_COLUMNS` |
| `lib/customer-mapping/codes.ts` | Code normalisation / matching helpers (pure) |
| `lib/customer-mapping/csv.ts` | Parse/serialise the mapping CSV (pure) |
| `lib/customer-mapping/build.ts` | Workbook rows → `MappingRow[]` + conflicts; `parseSaleDate` (pure) |
| `lib/customer-mapping/workbook.ts` | Reads the `.xlsx` with SheetJS into plain row objects |
| `lib/customer-mapping/plan.ts` | `buildPlan()` — diff mapping vs ERP state (pure) |
| `lib/customer-mapping/erp.ts` | `ErpGateway` interface + mssql implementation |
| `lib/customer-mapping/apply.ts` | `applyPlan()`, `rollbackRun()` over `ErpGateway` + `RunStore` |
| `lib/customer-mapping/runs-repo.ts` | `RunStore` over Drizzle/SQLite (`mapping_apply_runs`) |
| `lib/customer-mapping/dwh.ts` | Upsert `dim.Dim_CustomerMapping`, run DWH loads, verify |
| `scripts/mapping-build.ts` | CLI: workbook → CSV + conflicts CSV |
| `scripts/mapping-apply.ts` | CLI: dry-run / apply / rollback / verify |
| `migrations/mssql/0016_pApi_customer_mapping.sql` | ERP procs |
| `migrations/dwh/0039_dim_customer_mapping.sql` | DWH table + view |
| `__tests__/unit/customer-mapping/*.test.ts` | Unit tests |
| `scripts/dwh/__tests__/customer-mapping-erp.test.ts` | ERP proc test (non-prod only) |
| `scripts/dwh/__tests__/dim-customer-mapping.test.ts` | DWH table/view test (disposable DB) |

---

### Task 1: Types, code helpers and CSV I/O

**Files:**
- Create: `lib/customer-mapping/types.ts`, `lib/customer-mapping/codes.ts`, `lib/customer-mapping/csv.ts`
- Test: `__tests__/unit/customer-mapping/codes.test.ts`, `__tests__/unit/customer-mapping/csv.test.ts`

**Interfaces:**
- Produces:
  - `type CustomerType = 'Cadena' | 'Independiente'`
  - `interface MappingRow { coCli: string; nombre: string; coVen: string; grupo: string; tipoCliente: CustomerType; clientePrincipal: string; effectiveFrom: string; sourceNote: string }` (`coVen === ''` means "no seller known")
  - `type ConflictKind = 'multi_seller' | 'duplicate_code' | 'missing_code' | 'no_invoices' | 'invalid_type'`
  - `interface Conflict { coCli: string; nombre: string; kind: ConflictKind; detail: string }`
  - `const MAPPING_COLUMNS = ['co_cli','nombre','co_ven','grupo','tipo_cliente','cliente_principal','effective_from','source_note'] as const`
  - `trimCode(raw: unknown): string`, `sellerKey(code: string): string`, `resolveSeller(raw: string, erpSellers: Iterable<string>): string | null`, `looseCustomerKey(code: string): string`
  - `parseCsv(text: string): string[][]`, `mappingToCsv(rows: MappingRow[]): string`, `csvToMapping(text: string): { rows: MappingRow[]; errors: string[] }`

- [ ] **Step 1: Write the failing tests**

`__tests__/unit/customer-mapping/codes.test.ts`:
```ts
import { describe, test, expect } from 'bun:test';
import { trimCode, sellerKey, resolveSeller, looseCustomerKey } from '../../../lib/customer-mapping/codes';

describe('codes', () => {
  test('trimCode trims strings and stringifies numbers', () => {
    expect(trimCode('  J-1  ')).toBe('J-1');
    expect(trimCode(15)).toBe('15');
    expect(trimCode(null)).toBe('');
  });
  test('sellerKey ignores leading zeros on numeric codes only', () => {
    expect(sellerKey('000015')).toBe('15');
    expect(sellerKey('15')).toBe('15');
    expect(sellerKey(' a01 ')).toBe('A01');
  });
  test('resolveSeller maps workbook 15 to the ERP code', () => {
    expect(resolveSeller('15', ['000015 '.trim(), '7'])).toBe('000015');
    expect(resolveSeller('99', ['000015', '7'])).toBeNull();
    expect(resolveSeller('', ['7'])).toBeNull();
  });
  test('looseCustomerKey collapses dashes, spaces and case', () => {
    expect(looseCustomerKey('J-301420608-20')).toBe(looseCustomerKey('j30142060820'));
    expect(looseCustomerKey(' J 3014 ')).toBe('J3014');
  });
});
```

`__tests__/unit/customer-mapping/csv.test.ts`:
```ts
import { describe, test, expect } from 'bun:test';
import { parseCsv, mappingToCsv, csvToMapping } from '../../../lib/customer-mapping/csv';
import type { MappingRow } from '../../../lib/customer-mapping/types';

const row = (o: Partial<MappingRow> = {}): MappingRow => ({
  coCli: 'J507294439', nombre: 'COCHINA ENVIDIA, C.A', coVen: '15', grupo: 'Restaurante',
  tipoCliente: 'Independiente', clientePrincipal: 'COCHINA ENVIDIA, C.A',
  effectiveFrom: '2026-03-01', sourceNote: 'latest invoice F009606 2026-09-24', ...o,
});

describe('mapping csv', () => {
  test('parseCsv handles BOM, CRLF, quoted commas and escaped quotes', () => {
    const text = '﻿a,b\r\n"x, y","he said ""hi"""\r\n';
    expect(parseCsv(text)).toEqual([['a', 'b'], ['x, y', 'he said "hi"']]);
  });
  test('round-trips rows including commas in names and blank co_ven', () => {
    const rows = [row(), row({ coCli: 'J1', nombre: 'Plain', coVen: '' })];
    const back = csvToMapping(mappingToCsv(rows));
    expect(back.errors).toEqual([]);
    expect(back.rows).toEqual(rows);
  });
  test('reports bad type, missing group, bad date and duplicate code', () => {
    const csv = mappingToCsv([row(), row()])
      .replace('Independiente', 'Otro').replace(/Restaurante/, '').replace('2026-03-01', '03/01/2026');
    const { errors } = csvToMapping(csv);
    expect(errors.join('\n')).toMatch(/tipo_cliente/);
    expect(errors.join('\n')).toMatch(/grupo/);
    expect(errors.join('\n')).toMatch(/effective_from/);
    expect(errors.join('\n')).toMatch(/duplicad/i);
  });
  test('rejects a file whose header does not match', () => {
    expect(csvToMapping('a,b\n1,2\n').errors[0]).toMatch(/encabezado/i);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test __tests__/unit/customer-mapping`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`lib/customer-mapping/types.ts`:
```ts
export type CustomerType = 'Cadena' | 'Independiente';

export interface MappingRow {
  coCli: string;
  nombre: string;
  coVen: string;            // '' = no seller known; seller and documents are left untouched
  grupo: string;
  tipoCliente: CustomerType;
  clientePrincipal: string;
  effectiveFrom: string;    // YYYY-MM-DD
  sourceNote: string;
}

export type ConflictKind = 'multi_seller' | 'duplicate_code' | 'missing_code' | 'no_invoices' | 'invalid_type';

export interface Conflict {
  coCli: string;
  nombre: string;
  kind: ConflictKind;
  detail: string;
}

export const MAPPING_COLUMNS = [
  'co_cli', 'nombre', 'co_ven', 'grupo', 'tipo_cliente', 'cliente_principal', 'effective_from', 'source_note',
] as const;
```

`lib/customer-mapping/codes.ts`:
```ts
export function trimCode(raw: unknown): string {
  return raw == null ? '' : String(raw).trim();
}

// Numeric seller codes compare without leading zeros ('000015' == '15'); others compare upper-cased.
export function sellerKey(code: string): string {
  const t = code.trim();
  return /^\d+$/.test(t) ? t.replace(/^0+(?=\d)/, '') : t.toUpperCase();
}

// Returns the ERP's own (trimmed) seller code matching a workbook/CSV code, or null.
export function resolveSeller(raw: string, erpSellers: Iterable<string>): string | null {
  const key = sellerKey(raw);
  if (!key) return null;
  for (const s of erpSellers) {
    if (sellerKey(s) === key) return s.trim();
  }
  return null;
}

// Only used to SUGGEST a likely ERP customer for an unmatched code; never to match silently.
export function looseCustomerKey(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
```

`lib/customer-mapping/csv.ts`:
```ts
import { buildCsv } from '@/lib/csv';
import type { ColumnDef } from '@/lib/reports/registry';
import { MAPPING_COLUMNS, type MappingRow, type CustomerType } from './types';

export function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = ''; rows.push(row); row = [];
    } else field += ch;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter(r => !(r.length === 1 && r[0] === ''));
}

export const MAPPING_COLUMN_DEFS: ColumnDef[] = MAPPING_COLUMNS.map((k, i) => ({
  key: k, label: k, defaultVisible: true, defaultOrder: i,
}));

export function mappingToCsv(rows: MappingRow[]): string {
  return buildCsv(MAPPING_COLUMN_DEFS, rows.map(r => ({
    co_cli: r.coCli, nombre: r.nombre, co_ven: r.coVen, grupo: r.grupo, tipo_cliente: r.tipoCliente,
    cliente_principal: r.clientePrincipal, effective_from: r.effectiveFrom, source_note: r.sourceNote,
  })));
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function csvToMapping(text: string): { rows: MappingRow[]; errors: string[] } {
  const table = parseCsv(text);
  const errors: string[] = [];
  const header = (table[0] ?? []).map(h => h.trim());
  if (header.join(',') !== MAPPING_COLUMNS.join(',')) {
    return { rows: [], errors: [`Encabezado inválido; se esperaba: ${MAPPING_COLUMNS.join(',')}`] };
  }
  const rows: MappingRow[] = [];
  const seen = new Set<string>();
  table.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const [coCli, nombre, coVen, grupo, tipo, principal, eff, note] = MAPPING_COLUMNS.map((_, c) => (cells[c] ?? '').trim());
    if (!coCli) { errors.push(`línea ${line}: co_cli vacío`); return; }
    if (seen.has(coCli)) errors.push(`línea ${line}: co_cli duplicado ${coCli}`);
    seen.add(coCli);
    if (!grupo) errors.push(`línea ${line}: grupo vacío (${coCli})`);
    if (tipo !== 'Cadena' && tipo !== 'Independiente') errors.push(`línea ${line}: tipo_cliente inválido '${tipo}' (${coCli})`);
    if (!ISO.test(eff)) errors.push(`línea ${line}: effective_from debe ser YYYY-MM-DD (${coCli})`);
    rows.push({
      coCli, nombre, coVen, grupo, tipoCliente: tipo as CustomerType,
      clientePrincipal: principal, effectiveFrom: eff, sourceNote: note,
    });
  });
  return { rows, errors };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun test __tests__/unit/customer-mapping`
Expected: PASS (all codes + csv tests).

- [ ] **Step 5: Commit**

```bash
git add lib/customer-mapping __tests__/unit/customer-mapping
git commit -m "feat(mapping): types, code helpers and mapping CSV I/O" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Workbook reader, mapping builder and `mapping:build` CLI

**Files:**
- Create: `lib/customer-mapping/build.ts`, `lib/customer-mapping/workbook.ts`, `scripts/mapping-build.ts`
- Modify: `package.json` (script `mapping:build`)
- Test: `__tests__/unit/customer-mapping/build.test.ts`

**Interfaces:**
- Consumes: `MappingRow`, `Conflict`, `CustomerType`, `trimCode`, `mappingToCsv` from Task 1.
- Produces:
  - `interface MasterRow { codigo: string; cliente: string; grupo: string; tipo: string; principal: string }`
  - `interface InvoiceLine { numero: string; renglon: number; fecha: string /* YYYY-MM-DD */; coCli: string; coVen: string; tipoDocumento: string }`
  - `parseSaleDate(v: unknown): string | null`
  - `buildMapping(master: MasterRow[], lines: InvoiceLine[], opts: { effectiveFrom: string }): { rows: MappingRow[]; conflicts: Conflict[] }`
  - `readWorkbook(path: string): { master: MasterRow[]; lines: InvoiceLine[]; badDates: number }`

- [ ] **Step 1: Write the failing tests**

`__tests__/unit/customer-mapping/build.test.ts`:
```ts
import { describe, test, expect } from 'bun:test';
import { buildMapping, parseSaleDate, type MasterRow, type InvoiceLine } from '../../../lib/customer-mapping/build';

const m = (o: Partial<MasterRow>): MasterRow => ({ codigo: 'J1', cliente: 'Uno', grupo: 'Abasto', tipo: 'Independiente', principal: 'Uno', ...o });
const l = (o: Partial<InvoiceLine>): InvoiceLine => ({ numero: 'F000001', renglon: 1, fecha: '2026-09-01', coCli: 'J1', coVen: '7', tipoDocumento: 'Factura', ...o });
const opts = { effectiveFrom: '2026-03-01' };

describe('parseSaleDate', () => {
  test('accepts Date objects and dd/mm/yyyy text (with leading space)', () => {
    expect(parseSaleDate(new Date(2026, 6, 31, 14, 4))).toBe('2026-07-31');
    expect(parseSaleDate(' 18/09/2026')).toBe('2026-09-18');
    expect(parseSaleDate('01/09/2026')).toBe('2026-09-01');
  });
  test('rejects garbage and impossible dates', () => {
    expect(parseSaleDate('31/02/2026')).toBeNull();
    expect(parseSaleDate('hello')).toBeNull();
    expect(parseSaleDate(null)).toBeNull();
  });
});

describe('buildMapping', () => {
  test('picks the seller of the latest Factura line', () => {
    const { rows, conflicts } = buildMapping([m({})], [
      l({ numero: 'F1', fecha: '2026-09-01', coVen: '7' }),
      l({ numero: 'F2', fecha: '2026-09-24', coVen: '39' }),
      l({ numero: 'F0', fecha: '2026-08-01', coVen: '6' }),
    ], opts);
    expect(rows[0].coVen).toBe('39');
    expect(rows[0].sourceNote).toContain('F2');
    expect(conflicts.filter(c => c.kind === 'multi_seller')).toHaveLength(1);
    expect(conflicts[0].detail).toMatch(/39/);
  });
  test('ignores Devolucion lines when choosing the seller', () => {
    const { rows } = buildMapping([m({})], [
      l({ fecha: '2026-09-01', coVen: '7' }),
      l({ numero: 'D1', fecha: '2026-10-01', coVen: '5', tipoDocumento: 'Devolucion' }),
    ], opts);
    expect(rows[0].coVen).toBe('7');
  });
  test('customer without invoices gets blank seller and a no_invoices conflict', () => {
    const { rows, conflicts } = buildMapping([m({})], [], opts);
    expect(rows[0].coVen).toBe('');
    expect(conflicts[0].kind).toBe('no_invoices');
  });
  test('missing code is skipped, duplicate code keeps first row', () => {
    const { rows, conflicts } = buildMapping([
      m({ codigo: '', cliente: 'Sin codigo' }),
      m({ codigo: 'J9', cliente: 'Primero' }),
      m({ codigo: 'J9', cliente: 'Segundo' }),
    ], [], opts);
    expect(rows.map(r => r.nombre)).toEqual(['Primero']);
    expect(conflicts.map(c => c.kind)).toContain('missing_code');
    expect(conflicts.map(c => c.kind)).toContain('duplicate_code');
  });
  test('unknown tipo is a conflict and the row is skipped', () => {
    const { rows, conflicts } = buildMapping([m({ tipo: 'Raro' })], [], opts);
    expect(rows).toHaveLength(0);
    expect(conflicts[0].kind).toBe('invalid_type');
  });
  test('output is sorted by code and carries effective_from', () => {
    const { rows } = buildMapping([m({ codigo: 'J2' }), m({ codigo: 'J1' })], [], opts);
    expect(rows.map(r => r.coCli)).toEqual(['J1', 'J2']);
    expect(rows[0].effectiveFrom).toBe('2026-03-01');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test __tests__/unit/customer-mapping/build.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `build.ts`**

```ts
import type { Conflict, CustomerType, MappingRow } from './types';
import { trimCode } from './codes';

export interface MasterRow { codigo: string; cliente: string; grupo: string; tipo: string; principal: string }
export interface InvoiceLine {
  numero: string; renglon: number; fecha: string; coCli: string; coVen: string; tipoDocumento: string;
}

const iso = (y: number, m: number, d: number) =>
  `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Workbook dates are a mix of Excel datetimes and dd/mm/yyyy text.
export function parseSaleDate(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
  if (typeof v === 'string') {
    const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(v);
    if (!m) return null;
    const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const probe = new Date(y, mo - 1, d);
    if (probe.getFullYear() !== y || probe.getMonth() !== mo - 1 || probe.getDate() !== d) return null;
    return iso(y, mo, d);
  }
  return null;
}

// Latest = greatest (fecha, numero, renglon). Deterministic on same-day ties.
function isLater(a: InvoiceLine, b: InvoiceLine): boolean {
  if (a.fecha !== b.fecha) return a.fecha > b.fecha;
  if (a.numero !== b.numero) return a.numero > b.numero;
  return a.renglon > b.renglon;
}

export function buildMapping(
  master: MasterRow[],
  lines: InvoiceLine[],
  opts: { effectiveFrom: string },
): { rows: MappingRow[]; conflicts: Conflict[] } {
  const latest = new Map<string, InvoiceLine>();
  const sellers = new Map<string, Set<string>>();
  for (const line of lines) {
    if (line.tipoDocumento !== 'Factura') continue;
    const best = latest.get(line.coCli);
    if (!best || isLater(line, best)) latest.set(line.coCli, line);
    if (!sellers.has(line.coCli)) sellers.set(line.coCli, new Set());
    sellers.get(line.coCli)!.add(line.coVen);
  }

  const rows: MappingRow[] = [];
  const conflicts: Conflict[] = [];
  const seen = new Map<string, string>();

  for (const r of master) {
    const coCli = trimCode(r.codigo);
    const nombre = trimCode(r.cliente);
    if (!coCli) { conflicts.push({ coCli: '', nombre, kind: 'missing_code', detail: 'fila sin código en Maestro Clientes' }); continue; }
    if (seen.has(coCli)) {
      conflicts.push({ coCli, nombre, kind: 'duplicate_code', detail: `ya existe como '${seen.get(coCli)}'; se conserva la primera fila` });
      continue;
    }
    seen.set(coCli, nombre);
    const tipo = trimCode(r.tipo);
    if (tipo !== 'Cadena' && tipo !== 'Independiente') {
      conflicts.push({ coCli, nombre, kind: 'invalid_type', detail: `Tipo cliente '${tipo}' no es Cadena/Independiente` });
      continue;
    }
    const last = latest.get(coCli);
    let coVen = '';
    let sourceNote = 'sin facturas en el libro';
    if (last) {
      coVen = last.coVen;
      sourceNote = `última factura ${last.numero} ${last.fecha}`;
      const all = sellers.get(coCli)!;
      if (all.size > 1) {
        conflicts.push({ coCli, nombre, kind: 'multi_seller', detail: `vendedores ${[...all].sort().join(',')} → se usa ${coVen} (${last.numero} ${last.fecha})` });
      }
    } else {
      conflicts.push({ coCli, nombre, kind: 'no_invoices', detail: 'sin facturas; vendedor en blanco (solo se actualiza el grupo)' });
    }
    rows.push({
      coCli, nombre, coVen, grupo: trimCode(r.grupo), tipoCliente: tipo as CustomerType,
      clientePrincipal: trimCode(r.principal), effectiveFrom: opts.effectiveFrom, sourceNote,
    });
  }
  rows.sort((a, b) => a.coCli.localeCompare(b.coCli));
  return { rows, conflicts };
}
```

- [ ] **Step 4: Implement `workbook.ts` and the CLI**

`lib/customer-mapping/workbook.ts`:
```ts
import * as XLSX from 'xlsx';
import { trimCode } from './codes';
import { parseSaleDate, type InvoiceLine, type MasterRow } from './build';

function sheetRows(wb: XLSX.WorkBook, name: string): { header: string[]; data: unknown[][] } {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Hoja '${name}' no encontrada`);
  const all = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });
  return { header: (all[0] ?? []).map(h => trimCode(h)), data: all.slice(1) };
}

function col(header: string[], startsWith: string): number {
  const i = header.findIndex(h => h.toLowerCase().startsWith(startsWith.toLowerCase()));
  if (i < 0) throw new Error(`Columna '${startsWith}' no encontrada (${header.join(' | ')})`);
  return i;
}

export function readWorkbook(path: string): { master: MasterRow[]; lines: InvoiceLine[]; badDates: number } {
  const wb = XLSX.readFile(path, { cellDates: true });

  const mst = sheetRows(wb, 'Maestro Clientes');
  const [cCod, cCli, cGrp, cTipo, cPrin] = [
    col(mst.header, 'Código'), col(mst.header, 'Cliente'), col(mst.header, 'Grupo de Cliente'),
    col(mst.header, 'Tipo cliente'), col(mst.header, 'Nombre Cliente Principal'),
  ];
  const master: MasterRow[] = mst.data
    .filter(r => r.some(v => v != null))
    .map(r => ({
      codigo: trimCode(r[cCod]), cliente: trimCode(r[cCli]), grupo: trimCode(r[cGrp]),
      tipo: trimCode(r[cTipo]), principal: trimCode(r[cPrin]),
    }));

  const ven = sheetRows(wb, 'Ventas Diarias (Profit)');
  const [vNum, vReng, vFec, vCli, vVen, vTipo] = [
    col(ven.header, 'Número'), col(ven.header, 'Reng'), col(ven.header, 'Fecha'),
    col(ven.header, 'Codigo Cliente'), col(ven.header, 'Codigo Vendedor'), col(ven.header, 'Tipo Documento'),
  ];
  let badDates = 0;
  const lines: InvoiceLine[] = [];
  for (const r of ven.data) {
    if (!trimCode(r[vNum])) continue;
    const fecha = parseSaleDate(r[vFec]);
    if (!fecha) { badDates++; continue; }
    lines.push({
      numero: trimCode(r[vNum]), renglon: Number(r[vReng]) || 0, fecha,
      coCli: trimCode(r[vCli]), coVen: trimCode(r[vVen]), tipoDocumento: trimCode(r[vTipo]),
    });
  }
  return { master, lines, badDates };
}
```

`scripts/mapping-build.ts`:
```ts
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { buildCsv } from '@/lib/csv';
import { buildMapping } from '@/lib/customer-mapping/build';
import { mappingToCsv } from '@/lib/customer-mapping/csv';
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

  const { master, lines, badDates } = readWorkbook(xlsx);
  const { rows, conflicts } = buildMapping(master, lines, { effectiveFrom: values.from! });

  const conflictsPath = values.out!.replace(/\.csv$/, '.conflicts.csv');
  await mkdir(dirname(values.out!), { recursive: true });
  await writeFile(values.out!, mappingToCsv(rows), 'utf8');
  await writeFile(conflictsPath, buildCsv(
    ['co_cli', 'nombre', 'kind', 'detail'].map((k, i) => ({ key: k, label: k, defaultVisible: true, defaultOrder: i })),
    conflicts as unknown as Record<string, unknown>[],
  ), 'utf8');

  const dates = lines.map(l => l.fecha).sort();
  console.log(`Maestro: ${master.length} filas → ${rows.length} filas de mapeo`);
  console.log(`Líneas de venta: ${lines.length} (${dates[0]} … ${dates.at(-1)}), fechas ilegibles: ${badDates}`);
  const byKind = new Map<string, number>();
  for (const c of conflicts) byKind.set(c.kind, (byKind.get(c.kind) ?? 0) + 1);
  console.log('Conflictos:', Object.fromEntries(byKind));
  console.log(`Escrito: ${values.out}\nEscrito: ${conflictsPath}`);
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
```

`package.json` scripts: add `"mapping:build": "bun --bun run scripts/mapping-build.ts"`.

- [ ] **Step 5: Run unit tests**

Run: `bun test __tests__/unit/customer-mapping`
Expected: PASS.

- [ ] **Step 6: Sanity-run against the real workbook**

Run: `bun run mapping:build -- /Users/eugenio/Desktop/2026-bbdd-profit.xlsx`
Expected (approximately): 174 master rows → ~171 mapping rows; sales lines ≈ 4,841 spanning roughly 2026-07-01 … 2026-10-08 with 0 unreadable dates; conflicts include `missing_code: 2`, `duplicate_code: 1`, `multi_seller` ≈ 11 (can be fewer because only `Factura` lines count). If `badDates` > 0 or the date range looks wrong, STOP and fix `parseSaleDate` before continuing.

- [ ] **Step 7: Commit (include the generated files for the user to review)**

```bash
git add lib/customer-mapping scripts/mapping-build.ts package.json __tests__/unit/customer-mapping data/customer-mapping
git commit -m "feat(mapping): workbook reader, mapping builder and mapping:build CLI" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: ERP stored procedures (`migrations/mssql/0016`)

**Files:**
- Create: `migrations/mssql/0016_pApi_customer_mapping.sql`, `scripts/dwh/__tests__/customer-mapping-erp.test.ts`
- Modify: `package.json` (ignore the ERP test in `test`/`test:unit`; add `test:mapping-erp`)

**Interfaces:**
- Produces ERP procs:
  - `pApiInsertarSegmento(@sCoSeg CHAR(6), @sSegDes VARCHAR(60), @sCoUsIn CHAR(6))`
  - `pApiActualizarSegmentoCliente(@sCoCli CHAR(16), @sCoSeg CHAR(6), @sCoUsMo CHAR(6))`
  - `pApiCorregirVendedorDocumento(@sTipo VARCHAR(4) /* 'FACT'|'DEV' */, @sNroDoc CHAR(20), @sCoVen CHAR(6), @sCoUsMo CHAR(6))`
  - Error messages (matched by Task 4): `Cliente %s no encontrado`, `Segmento %s no encontrado`, `Vendedor %s no encontrado`, `Documento %s no encontrado`, `Documento %s anulado`.

- [ ] **Step 1: Write the failing (non-production only) integration test**

`scripts/dwh/__tests__/customer-mapping-erp.test.ts`:
```ts
// WRITES to the live ERP then restores. Run only against a NON-PRODUCTION Profit Plus instance.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { getPool } from '../../../lib/db/mssql';

describe('customer-mapping pApi procs', () => {
  let pool: Awaited<ReturnType<typeof getPool>>;
  let invoice: { docNum: string; coVen: string; coCli: string };
  let otherSeller: string;
  let customer: { coCli: string; coSeg: string };
  let otherSeg: string;

  beforeAll(async () => {
    pool = await getPool();
    const inv = await pool.request().query(`
      SELECT TOP 1 RTRIM(doc_num) AS docNum, RTRIM(co_ven) AS coVen, RTRIM(co_cli) AS coCli
      FROM saFacturaVenta WHERE anulado = 0 ORDER BY fec_emis DESC`);
    invoice = inv.recordset[0];
    const sel = await pool.request().input('v', sql.VarChar(6), invoice.coVen).query(
      `SELECT TOP 1 RTRIM(co_ven) AS coVen FROM saVendedor WHERE inactivo = 0 AND RTRIM(co_ven) <> @v`);
    otherSeller = sel.recordset[0].coVen;
    const cus = await pool.request().query(
      `SELECT TOP 1 RTRIM(co_cli) AS coCli, RTRIM(co_seg) AS coSeg FROM saCliente WHERE inactivo = 0 AND co_seg IS NOT NULL`);
    customer = cus.recordset[0];
    const seg = await pool.request().input('s', sql.VarChar(6), customer.coSeg).query(
      `SELECT TOP 1 RTRIM(co_seg) AS coSeg FROM saSegmento WHERE RTRIM(co_seg) <> @s`);
    otherSeg = seg.recordset[0].coSeg;
  });

  afterAll(async () => {
    await pool.request()
      .input('t', sql.VarChar(4), 'FACT').input('d', sql.Char(20), invoice.docNum)
      .input('v', sql.Char(6), invoice.coVen).input('u', sql.Char(6), 'TESTRUN')
      .execute('pApiCorregirVendedorDocumento');
    await pool.request()
      .input('c', sql.Char(16), customer.coCli).input('s', sql.Char(6), customer.coSeg).input('u', sql.Char(6), 'TESTRUN')
      .execute('pApiActualizarSegmentoCliente');
    await pool.request().query(`DELETE FROM saSegmento WHERE RTRIM(co_seg) = 'ZZTST1'`);
  });

  test('pApiCorregirVendedorDocumento updates the invoice header and its ledger row', async () => {
    await pool.request()
      .input('t', sql.VarChar(4), 'FACT').input('d', sql.Char(20), invoice.docNum)
      .input('v', sql.Char(6), otherSeller).input('u', sql.Char(6), 'TESTRUN')
      .execute('pApiCorregirVendedorDocumento');
    const hdr = await pool.request().input('d', sql.Char(20), invoice.docNum)
      .query(`SELECT RTRIM(co_ven) AS coVen FROM saFacturaVenta WHERE doc_num = @d`);
    expect(hdr.recordset[0].coVen).toBe(otherSeller);
    const led = await pool.request().input('d', sql.Char(20), invoice.docNum)
      .query(`SELECT RTRIM(co_ven) AS coVen FROM saDocumentoVenta WHERE co_tipo_doc = 'FACT' AND nro_doc = @d`);
    if (led.recordset.length) expect(led.recordset[0].coVen).toBe(otherSeller);
  });

  test('unknown seller and unknown document are rejected', async () => {
    const call = (d: string, v: string) => pool.request()
      .input('t', sql.VarChar(4), 'FACT').input('d', sql.Char(20), d)
      .input('v', sql.Char(6), v).input('u', sql.Char(6), 'TESTRUN')
      .execute('pApiCorregirVendedorDocumento');
    await expect(call(invoice.docNum, 'NOPE99')).rejects.toThrow(/Vendedor .* no encontrado/);
    await expect(call('NO-SUCH-DOC', otherSeller)).rejects.toThrow(/Documento .* no encontrado/);
  });

  test('pApiActualizarSegmentoCliente moves a customer; unknown segment is rejected', async () => {
    await pool.request()
      .input('c', sql.Char(16), customer.coCli).input('s', sql.Char(6), otherSeg).input('u', sql.Char(6), 'TESTRUN')
      .execute('pApiActualizarSegmentoCliente');
    const r = await pool.request().input('c', sql.Char(16), customer.coCli)
      .query(`SELECT RTRIM(co_seg) AS coSeg FROM saCliente WHERE co_cli = @c`);
    expect(r.recordset[0].coSeg).toBe(otherSeg);
    await expect(pool.request()
      .input('c', sql.Char(16), customer.coCli).input('s', sql.Char(6), 'NOSEG9').input('u', sql.Char(6), 'TESTRUN')
      .execute('pApiActualizarSegmentoCliente')).rejects.toThrow(/Segmento .* no encontrado/);
  });

  test('pApiInsertarSegmento creates a segment once and rejects a duplicate', async () => {
    const ins = () => pool.request()
      .input('c', sql.Char(6), 'ZZTST1').input('d', sql.VarChar(60), 'Grupo de prueba').input('u', sql.Char(6), 'TESTRUN')
      .execute('pApiInsertarSegmento');
    await ins();
    await expect(ins()).rejects.toThrow(/ya existe/);
  });
});
```

- [ ] **Step 2: Wire the test scripts**

In `package.json`: append `--path-ignore-patterns='**/customer-mapping-erp.test.ts'` to both `test` and `test:unit`, and add
`"test:mapping-erp": "bun test --isolate --env-file=.env.local scripts/dwh/__tests__/customer-mapping-erp.test.ts"`.

- [ ] **Step 3: Write the migration**

`migrations/mssql/0016_pApi_customer_mapping.sql`:
```sql
-- migrations/mssql/0016_pApi_customer_mapping.sql
-- Procs used by `bun run mapping:apply` (customer seller / group data-quality fix).
-- Changes ONLY: saSegmento (insert), saCliente.co_seg, and the seller (co_ven) of a
-- sales invoice / customer return plus its saDocumentoVenta ledger row.
-- Header rows are stamped with co_us_mo / fe_us_mo (which also bumps `validador`,
-- so the DWH incremental loads pick the change up). Annulled documents are refused.

CREATE OR ALTER PROCEDURE [pApiInsertarSegmento]
    ( @sCoSeg CHAR(6), @sSegDes VARCHAR(60), @sCoUsIn CHAR(6) )
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        DECLARE @sTrim VARCHAR(6) = RTRIM(@sCoSeg);
        IF EXISTS (SELECT 1 FROM saSegmento WHERE co_seg = @sCoSeg)
            RAISERROR('El segmento %s ya existe', 16, 1, @sTrim);
        INSERT INTO saSegmento (co_seg, seg_des, co_us_in, fe_us_in, co_us_mo, fe_us_mo, rowguid)
        VALUES (@sCoSeg, @sSegDes, @sCoUsIn, GETDATE(), @sCoUsIn, GETDATE(), NEWID());
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorNumber INT = ERROR_NUMBER();
        RAISERROR(@ErrorMessage, 16, @ErrorNumber);
    END CATCH
END
GO

CREATE OR ALTER PROCEDURE [pApiActualizarSegmentoCliente]
    ( @sCoCli CHAR(16), @sCoSeg CHAR(6), @sCoUsMo CHAR(6) )
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRAN;
        DECLARE @sCoCliTrim VARCHAR(16) = RTRIM(@sCoCli);
        DECLARE @sCoSegTrim VARCHAR(6)  = RTRIM(@sCoSeg);

        IF NOT EXISTS (SELECT 1 FROM saCliente WHERE co_cli = @sCoCli)
            RAISERROR('Cliente %s no encontrado', 16, 1, @sCoCliTrim);
        IF NOT EXISTS (SELECT 1 FROM saSegmento WHERE co_seg = @sCoSeg)
            RAISERROR('Segmento %s no encontrado', 16, 1, @sCoSegTrim);

        UPDATE saCliente
        SET co_seg = @sCoSeg, co_us_mo = @sCoUsMo, fe_us_mo = GETDATE()
        WHERE co_cli = @sCoCli;

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorNumber INT = ERROR_NUMBER();
        RAISERROR(@ErrorMessage, 16, @ErrorNumber);
    END CATCH
END
GO

CREATE OR ALTER PROCEDURE [pApiCorregirVendedorDocumento]
    ( @sTipo VARCHAR(4), @sNroDoc CHAR(20), @sCoVen CHAR(6), @sCoUsMo CHAR(6) )
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRAN;
        DECLARE @sDocTrim VARCHAR(20) = RTRIM(@sNroDoc);
        DECLARE @sVenTrim VARCHAR(6)  = RTRIM(@sCoVen);

        -- Inactive sellers are allowed: rollback may need to restore a seller deactivated since.
        IF NOT EXISTS (SELECT 1 FROM saVendedor WHERE co_ven = @sCoVen)
            RAISERROR('Vendedor %s no encontrado', 16, 1, @sVenTrim);

        IF @sTipo = 'FACT'
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM saFacturaVenta WHERE doc_num = @sNroDoc)
                RAISERROR('Documento %s no encontrado', 16, 1, @sDocTrim);
            IF EXISTS (SELECT 1 FROM saFacturaVenta WHERE doc_num = @sNroDoc AND anulado = 1)
                RAISERROR('Documento %s anulado', 16, 1, @sDocTrim);

            UPDATE saFacturaVenta
            SET co_ven = @sCoVen, co_us_mo = @sCoUsMo, fe_us_mo = GETDATE()
            WHERE doc_num = @sNroDoc;

            UPDATE saDocumentoVenta SET co_ven = @sCoVen
            WHERE co_tipo_doc = 'FACT' AND nro_doc = @sNroDoc;
        END
        ELSE IF @sTipo = 'DEV'
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM saDevolucionCliente WHERE doc_num = @sNroDoc)
                RAISERROR('Documento %s no encontrado', 16, 1, @sDocTrim);
            IF EXISTS (SELECT 1 FROM saDevolucionCliente WHERE doc_num = @sNroDoc AND anulado = 1)
                RAISERROR('Documento %s anulado', 16, 1, @sDocTrim);

            UPDATE saDevolucionCliente
            SET co_ven = @sCoVen, co_us_mo = @sCoUsMo, fe_us_mo = GETDATE()
            WHERE doc_num = @sNroDoc;

            UPDATE saDocumentoVenta SET co_ven = @sCoVen
            WHERE co_tipo_doc IN ('N/CR', 'NCR') AND nro_doc = @sNroDoc;
        END
        ELSE
            RAISERROR('Tipo de documento invalido', 16, 1);

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorNumber INT = ERROR_NUMBER();
        RAISERROR(@ErrorMessage, 16, @ErrorNumber);
    END CATCH
END
GO
```

- [ ] **Step 4: Apply the migration to the NON-PRODUCTION ERP and run the test**

Run: `bun run migrate:mssql && bun run test:mapping-erp`
Expected: PASS (4 tests). If `pApiInsertarSegmento` fails on a NOT NULL column or a trigger on `saFacturaVenta`/`saDocumentoVenta` blocks the update, fix the proc here (do not work around it in TypeScript) and re-run. Confirm afterwards that the invoice and customer were restored (the `afterAll` does this) by re-querying them.

- [ ] **Step 5: Commit**

```bash
git add migrations/mssql/0016_pApi_customer_mapping.sql scripts/dwh/__tests__/customer-mapping-erp.test.ts package.json
git commit -m "feat(mapping): ERP procs for segment and document seller fixes" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: ERP gateway, run-log table and `RunStore`

**Files:**
- Create: `lib/customer-mapping/erp.ts`, `lib/customer-mapping/runs-repo.ts`
- Modify: `lib/db/schema.ts` (new table), `migrations/sqlite/*` (generated)
- Test: none new here (gateway is exercised by Task 3's procs and Task 7's end-to-end run; the pure layers are tested via fakes in Task 5). Run `bunx tsc --noEmit` as the check.

**Interfaces:**
- Consumes: `updateCustomerSeller` (`lib/geo/erp-seller.ts`), `ERP_USER_CODE`, `CustomerNotFoundError`.
- Produces:
  - `type DocKind = 'FACT' | 'DEV'`
  - `interface ErpCustomerState { coCli: string; coVen: string; coSeg: string | null }`
  - `interface SellerDoc { kind: DocKind; docNum: string; coCli: string; coVen: string; fecEmis: string }`
  - `interface ErpGateway { listCustomers(): Promise<Map<string, ErpCustomerState>>; listActiveSellers(): Promise<string[]>; listSegments(): Promise<{ byDesc: Map<string, string>; codes: Set<string> }> /* byDesc keyed lower-cased trimmed seg_des */; listSellerDocs(sinceIso: string): Promise<SellerDoc[]>; createSegment(coSeg: string, segDes: string): Promise<void>; setCustomerSeller(coCli: string, coVen: string): Promise<void>; setCustomerSegment(coCli: string, coSeg: string): Promise<void>; setDocSeller(kind: DocKind, docNum: string, coVen: string): Promise<void> }`
  - `mssqlGateway(pool: sql.ConnectionPool): ErpGateway`
  - `type RunStatus = 'pending' | 'applied' | 'failed' | 'rolled_back'`
  - `interface RunSnapshot { customers: { coCli: string; coVen?: string; coSeg?: string }[]; docs: { kind: DocKind; docNum: string; coVen: string }[] }`
  - `interface RunRecord { id: string; createdAt: number; mappingFile: string; status: RunStatus; snapshot: RunSnapshot }`
  - `interface RunStore { create(r: RunRecord): void; get(id: string): RunRecord | undefined; setStatus(id: string, s: RunStatus): void }`
  - `sqliteRunStore(db: BunSQLiteDatabase<typeof schema>): RunStore`

- [ ] **Step 1: Add the SQLite table**

Append to `lib/db/schema.ts`:
```ts
// ── Customer mapping fix ────────────────────────────────────────────

export const mappingApplyRuns = sqliteTable('mapping_apply_runs', {
  id:          text('id').primaryKey(),
  createdAt:   integer('created_at').notNull(),            // unix ms
  mappingFile: text('mapping_file').notNull(),
  status:      text('status', { enum: ['pending', 'applied', 'failed', 'rolled_back'] }).notNull(),
  snapshot:    text('snapshot').notNull(),                 // JSON RunSnapshot: values BEFORE the run
});
```
Run: `bun run db:generate && bun run migrate` (pin `SQLITE_PATH` away from a real dev DB if you care about its contents — see the dev-DB-wipe memory; `migrate` only adds a table, it does not wipe).
Expected: a new file in `migrations/sqlite/`.

- [ ] **Step 2: Implement `runs-repo.ts`**

```ts
import { eq } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import * as schema from '@/lib/db/schema';
import type { DocKind } from './erp';

export type RunStatus = 'pending' | 'applied' | 'failed' | 'rolled_back';

export interface RunSnapshot {
  customers: { coCli: string; coVen?: string; coSeg?: string }[];
  docs: { kind: DocKind; docNum: string; coVen: string }[];
}

export interface RunRecord {
  id: string;
  createdAt: number;
  mappingFile: string;
  status: RunStatus;
  snapshot: RunSnapshot;
}

export interface RunStore {
  create(r: RunRecord): void;
  get(id: string): RunRecord | undefined;
  setStatus(id: string, s: RunStatus): void;
}

export function sqliteRunStore(db: BunSQLiteDatabase<typeof schema>): RunStore {
  return {
    create(r) {
      db.insert(schema.mappingApplyRuns).values({
        id: r.id, createdAt: r.createdAt, mappingFile: r.mappingFile, status: r.status,
        snapshot: JSON.stringify(r.snapshot),
      }).run();
    },
    get(id) {
      const row = db.select().from(schema.mappingApplyRuns).where(eq(schema.mappingApplyRuns.id, id)).get();
      return row ? { ...row, snapshot: JSON.parse(row.snapshot) as RunSnapshot } : undefined;
    },
    setStatus(id, status) {
      db.update(schema.mappingApplyRuns).set({ status }).where(eq(schema.mappingApplyRuns.id, id)).run();
    },
  };
}
```
(`RunStatus`, `RunSnapshot`, `RunRecord`, `RunStore` live here; `erp.ts` exports `DocKind`. Import them from these files in later tasks.)

- [ ] **Step 3: Implement `erp.ts`**

```ts
import sql from 'mssql';
import { ERP_USER_CODE } from '@/lib/geo/erp-location';
import { updateCustomerSeller } from '@/lib/geo/erp-seller';

export type DocKind = 'FACT' | 'DEV';

export interface ErpCustomerState { coCli: string; coVen: string; coSeg: string | null }
export interface SellerDoc { kind: DocKind; docNum: string; coCli: string; coVen: string; fecEmis: string }

export interface ErpGateway {
  listCustomers(): Promise<Map<string, ErpCustomerState>>;
  listActiveSellers(): Promise<string[]>;
  listSegments(): Promise<{ byDesc: Map<string, string>; codes: Set<string> }>;
  listSellerDocs(sinceIso: string): Promise<SellerDoc[]>;
  createSegment(coSeg: string, segDes: string): Promise<void>;
  setCustomerSeller(coCli: string, coVen: string): Promise<void>;
  setCustomerSegment(coCli: string, coSeg: string): Promise<void>;
  setDocSeller(kind: DocKind, docNum: string, coVen: string): Promise<void>;
}

export function mssqlGateway(pool: sql.ConnectionPool): ErpGateway {
  return {
    async listCustomers() {
      const r = await pool.request().query(
        `SELECT RTRIM(co_cli) AS coCli, RTRIM(co_ven) AS coVen, RTRIM(co_seg) AS coSeg FROM saCliente`);
      return new Map(r.recordset.map((x: { coCli: string; coVen: string; coSeg: string | null }) =>
        [x.coCli, { coCli: x.coCli, coVen: x.coVen, coSeg: x.coSeg }]));
    },
    async listActiveSellers() {
      const r = await pool.request().query(`SELECT RTRIM(co_ven) AS coVen FROM saVendedor WHERE inactivo = 0`);
      return r.recordset.map((x: { coVen: string }) => x.coVen);
    },
    async listSegments() {
      const r = await pool.request().query(`SELECT RTRIM(co_seg) AS coSeg, RTRIM(seg_des) AS segDes FROM saSegmento`);
      const byDesc = new Map<string, string>();
      const codes = new Set<string>();
      for (const x of r.recordset as { coSeg: string; segDes: string }[]) {
        codes.add(x.coSeg);
        byDesc.set(x.segDes.trim().toLowerCase(), x.coSeg);
      }
      return { byDesc, codes };
    },
    async listSellerDocs(sinceIso) {
      const r = await pool.request().input('since', sql.VarChar(10), sinceIso).query(`
        SELECT 'FACT' AS kind, RTRIM(doc_num) AS docNum, RTRIM(co_cli) AS coCli, RTRIM(co_ven) AS coVen,
               CONVERT(char(10), fec_emis, 23) AS fecEmis
        FROM saFacturaVenta WHERE anulado = 0 AND fec_emis >= CONVERT(date, @since, 23)
        UNION ALL
        SELECT 'DEV', RTRIM(doc_num), RTRIM(co_cli), RTRIM(co_ven), CONVERT(char(10), fec_emis, 23)
        FROM saDevolucionCliente WHERE anulado = 0 AND fec_emis >= CONVERT(date, @since, 23)`);
      return r.recordset as SellerDoc[];
    },
    async createSegment(coSeg, segDes) {
      await pool.request()
        .input('sCoSeg', sql.Char(6), coSeg).input('sSegDes', sql.VarChar(60), segDes)
        .input('sCoUsIn', sql.Char(6), ERP_USER_CODE)
        .execute('pApiInsertarSegmento');
    },
    async setCustomerSeller(coCli, coVen) {
      await updateCustomerSeller(pool, coCli, coVen);
    },
    async setCustomerSegment(coCli, coSeg) {
      await pool.request()
        .input('sCoCli', sql.Char(16), coCli).input('sCoSeg', sql.Char(6), coSeg)
        .input('sCoUsMo', sql.Char(6), ERP_USER_CODE)
        .execute('pApiActualizarSegmentoCliente');
    },
    async setDocSeller(kind, docNum, coVen) {
      await pool.request()
        .input('sTipo', sql.VarChar(4), kind).input('sNroDoc', sql.Char(20), docNum)
        .input('sCoVen', sql.Char(6), coVen).input('sCoUsMo', sql.Char(6), ERP_USER_CODE)
        .execute('pApiCorregirVendedorDocumento');
    },
  };
}
```

- [ ] **Step 4: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors in the new files.

- [ ] **Step 5: Commit**

```bash
git add lib/customer-mapping lib/db/schema.ts migrations/sqlite
git commit -m "feat(mapping): ERP gateway and apply-run snapshot store" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Plan (diff), apply and rollback orchestration

**Files:**
- Create: `lib/customer-mapping/plan.ts`, `lib/customer-mapping/apply.ts`
- Test: `__tests__/unit/customer-mapping/plan.test.ts`, `__tests__/unit/customer-mapping/apply.test.ts`

**Interfaces:**
- Consumes: `MappingRow`; `resolveSeller`, `looseCustomerKey`; `ErpGateway`, `ErpCustomerState`, `SellerDoc`, `DocKind`; `RunStore`, `RunSnapshot`.
- Produces:
  - `interface PlanInput { rows: MappingRow[]; customers: Map<string, ErpCustomerState>; activeSellers: string[]; segments: { byDesc: Map<string, string>; codes: Set<string> }; docs: SellerDoc[]; since: string }`
  - `type PlanProblem = { kind: 'unknown_customer' | 'unknown_seller'; coCli: string; detail: string }`
  - `interface Plan { customerSeller: { coCli: string; from: string; to: string }[]; customerSegment: { coCli: string; from: string | null; to: string; grupo: string }[]; docSeller: { kind: DocKind; docNum: string; coCli: string; from: string; to: string }[]; segmentsToCreate: { coSeg: string; segDes: string }[]; problems: PlanProblem[] }`
  - `buildPlan(input: PlanInput): Plan`; `assignSegmentCodes(groups: string[], existing: Set<string>): Map<string, string>` (`GRP01`, `GRP02`… skipping used codes, groups sorted alphabetically)
  - `interface ApplyDeps { erp: ErpGateway; runs: RunStore; now?: () => number; newId?: () => string; log?: (m: string) => void }`
  - `applyPlan(deps: ApplyDeps, plan: Plan, meta: { mappingFile: string }): Promise<{ runId: string; failures: string[] }>` — throws if `plan.problems.length > 0`
  - `rollbackRun(deps: ApplyDeps, runId: string): Promise<{ failures: string[] }>`

- [ ] **Step 1: Write the failing plan tests**

`__tests__/unit/customer-mapping/plan.test.ts`:
```ts
import { describe, test, expect } from 'bun:test';
import { buildPlan, assignSegmentCodes, type PlanInput } from '../../../lib/customer-mapping/plan';
import type { MappingRow } from '../../../lib/customer-mapping/types';

const row = (o: Partial<MappingRow> = {}): MappingRow => ({
  coCli: 'J1', nombre: 'Uno', coVen: '15', grupo: 'Abasto', tipoCliente: 'Independiente',
  clientePrincipal: 'Uno', effectiveFrom: '2026-03-01', sourceNote: '', ...o,
});

const input = (o: Partial<PlanInput> = {}): PlanInput => ({
  rows: [row()],
  customers: new Map([['J1', { coCli: 'J1', coVen: '7', coSeg: '0001' }]]),
  activeSellers: ['000015', '7'],
  segments: { byDesc: new Map([['abasto', '0023']]), codes: new Set(['0001', '0023']) },
  docs: [
    { kind: 'FACT', docNum: 'F1', coCli: 'J1', coVen: '7', fecEmis: '2026-03-05' },
    { kind: 'FACT', docNum: 'F2', coCli: 'J1', coVen: '000015', fecEmis: '2026-04-01' },
    { kind: 'DEV', docNum: 'D1', coCli: 'J1', coVen: '7', fecEmis: '2026-05-01' },
  ],
  since: '2026-03-01',
  ...o,
});

describe('buildPlan', () => {
  test('resolves workbook seller 15 to ERP 000015 and only changes what differs', () => {
    const p = buildPlan(input());
    expect(p.problems).toEqual([]);
    expect(p.customerSeller).toEqual([{ coCli: 'J1', from: '7', to: '000015' }]);
    expect(p.docSeller.map(d => d.docNum)).toEqual(['F1', 'D1']); // F2 already correct
    expect(p.customerSegment).toEqual([{ coCli: 'J1', from: '0001', to: '0023', grupo: 'Abasto' }]);
    expect(p.segmentsToCreate).toEqual([]);
  });
  test('is empty when the ERP already matches (idempotent input)', () => {
    const p = buildPlan(input({
      customers: new Map([['J1', { coCli: 'J1', coVen: '000015', coSeg: '0023' }]]),
      docs: [{ kind: 'FACT', docNum: 'F2', coCli: 'J1', coVen: '000015', fecEmis: '2026-04-01' }],
    }));
    expect(p.customerSeller).toEqual([]);
    expect(p.customerSegment).toEqual([]);
    expect(p.docSeller).toEqual([]);
  });
  test('unknown customer is a problem with a suggestion for a dash/case variant', () => {
    const p = buildPlan(input({
      rows: [row({ coCli: 'j-1' })],
      customers: new Map([['J1', { coCli: 'J1', coVen: '7', coSeg: null }]]),
    }));
    expect(p.problems[0].kind).toBe('unknown_customer');
    expect(p.problems[0].detail).toContain('J1');
  });
  test('unknown seller is a problem', () => {
    const p = buildPlan(input({ rows: [row({ coVen: '99' })] }));
    expect(p.problems.map(x => x.kind)).toContain('unknown_seller');
  });
  test('blank seller updates the group but leaves seller and documents alone', () => {
    const p = buildPlan(input({ rows: [row({ coVen: '' })] }));
    expect(p.customerSeller).toEqual([]);
    expect(p.docSeller).toEqual([]);
    expect(p.customerSegment).toHaveLength(1);
  });
  test('missing group is created with a generated code and used for the customer', () => {
    const p = buildPlan(input({ rows: [row({ grupo: 'Tienda Online' })] }));
    expect(p.segmentsToCreate).toEqual([{ coSeg: 'GRP01', segDes: 'Tienda Online' }]);
    expect(p.customerSegment[0].to).toBe('GRP01');
  });
  test('documents before the effective date are left alone', () => {
    const p = buildPlan(input({
      docs: [{ kind: 'FACT', docNum: 'OLD', coCli: 'J1', coVen: '7', fecEmis: '2026-02-28' }],
    }));
    expect(p.docSeller).toEqual([]);
  });
});

describe('assignSegmentCodes', () => {
  test('skips codes already in use and is alphabetical', () => {
    const m = assignSegmentCodes(['Zeta', 'Alfa'], new Set(['GRP01']));
    expect(m.get('Alfa')).toBe('GRP02');
    expect(m.get('Zeta')).toBe('GRP03');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test __tests__/unit/customer-mapping/plan.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `plan.ts`**

```ts
import { looseCustomerKey, resolveSeller } from './codes';
import type { DocKind, ErpCustomerState, SellerDoc } from './erp';
import type { MappingRow } from './types';

export interface PlanInput {
  rows: MappingRow[];
  customers: Map<string, ErpCustomerState>;
  activeSellers: string[];
  segments: { byDesc: Map<string, string>; codes: Set<string> };
  docs: SellerDoc[];
  since: string;
}

export interface PlanProblem { kind: 'unknown_customer' | 'unknown_seller'; coCli: string; detail: string }

export interface Plan {
  customerSeller: { coCli: string; from: string; to: string }[];
  customerSegment: { coCli: string; from: string | null; to: string; grupo: string }[];
  docSeller: { kind: DocKind; docNum: string; coCli: string; from: string; to: string }[];
  segmentsToCreate: { coSeg: string; segDes: string }[];
  problems: PlanProblem[];
}

export function assignSegmentCodes(groups: string[], existing: Set<string>): Map<string, string> {
  const used = new Set(existing);
  const out = new Map<string, string>();
  let n = 1;
  for (const g of [...groups].sort((a, b) => a.localeCompare(b))) {
    let code: string;
    do { code = `GRP${String(n++).padStart(2, '0')}`; } while (used.has(code));
    used.add(code);
    out.set(g, code);
  }
  return out;
}

export function buildPlan(input: PlanInput): Plan {
  const plan: Plan = { customerSeller: [], customerSegment: [], docSeller: [], segmentsToCreate: [], problems: [] };

  const docsByCustomer = new Map<string, SellerDoc[]>();
  for (const d of input.docs) {
    if (d.fecEmis < input.since) continue;
    const list = docsByCustomer.get(d.coCli) ?? [];
    list.push(d);
    docsByCustomer.set(d.coCli, list);
  }

  const looseIndex = new Map<string, string[]>();
  for (const code of input.customers.keys()) {
    const k = looseCustomerKey(code);
    looseIndex.set(k, [...(looseIndex.get(k) ?? []), code]);
  }

  // Groups with no saSegmento row yet get a generated code (shown in the dry-run).
  const missingGroups = [...new Set(
    input.rows.map(r => r.grupo.trim()).filter(g => !input.segments.byDesc.has(g.toLowerCase())),
  )];
  const newCodes = assignSegmentCodes(missingGroups, input.segments.codes);
  for (const g of missingGroups) plan.segmentsToCreate.push({ coSeg: newCodes.get(g)!, segDes: g });

  for (const r of input.rows) {
    const erp = input.customers.get(r.coCli);
    if (!erp) {
      const sugg = looseIndex.get(looseCustomerKey(r.coCli)) ?? [];
      plan.problems.push({
        kind: 'unknown_customer', coCli: r.coCli,
        detail: sugg.length ? `no existe en el ERP; ¿quizás ${sugg.join(' / ')}?` : 'no existe en el ERP',
      });
      continue;
    }

    const grupo = r.grupo.trim();
    const toSeg = input.segments.byDesc.get(grupo.toLowerCase()) ?? newCodes.get(grupo)!;
    if ((erp.coSeg ?? '') !== toSeg) {
      plan.customerSegment.push({ coCli: r.coCli, from: erp.coSeg, to: toSeg, grupo });
    }

    if (!r.coVen.trim()) continue;
    const seller = resolveSeller(r.coVen, input.activeSellers);
    if (!seller) {
      plan.problems.push({ kind: 'unknown_seller', coCli: r.coCli, detail: `vendedor '${r.coVen}' no existe o está inactivo en el ERP` });
      continue;
    }
    if (erp.coVen !== seller) plan.customerSeller.push({ coCli: r.coCli, from: erp.coVen, to: seller });
    for (const d of docsByCustomer.get(r.coCli) ?? []) {
      if (d.coVen !== seller) {
        plan.docSeller.push({ kind: d.kind, docNum: d.docNum, coCli: r.coCli, from: d.coVen, to: seller });
      }
    }
  }
  return plan;
}
```

- [ ] **Step 4: Run plan tests**

Run: `bun test __tests__/unit/customer-mapping/plan.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing apply/rollback tests**

`__tests__/unit/customer-mapping/apply.test.ts`:
```ts
import { describe, test, expect } from 'bun:test';
import { applyPlan, rollbackRun } from '../../../lib/customer-mapping/apply';
import { buildPlan } from '../../../lib/customer-mapping/plan';
import type { ErpGateway, ErpCustomerState, SellerDoc } from '../../../lib/customer-mapping/erp';
import type { RunRecord, RunStore, RunStatus } from '../../../lib/customer-mapping/runs-repo';
import type { MappingRow } from '../../../lib/customer-mapping/types';

function fakeErp(opts: { failDoc?: string } = {}) {
  const customers = new Map<string, ErpCustomerState>([['J1', { coCli: 'J1', coVen: '7', coSeg: '0001' }]]);
  const docs: SellerDoc[] = [
    { kind: 'FACT', docNum: 'F1', coCli: 'J1', coVen: '7', fecEmis: '2026-03-05' },
    { kind: 'FACT', docNum: 'F2', coCli: 'J1', coVen: '6', fecEmis: '2026-04-05' },
  ];
  const segs = new Map<string, string>([['abasto', '0023']]);
  const erp: ErpGateway = {
    listCustomers: async () => new Map([...customers].map(([k, v]) => [k, { ...v }])),
    listActiveSellers: async () => ['000015', '7', '6'],
    listSegments: async () => ({ byDesc: new Map(segs), codes: new Set(['0001', '0023']) }),
    listSellerDocs: async () => docs.map(d => ({ ...d })),
    createSegment: async (c, d) => { segs.set(d.toLowerCase(), c); },
    setCustomerSeller: async (c, v) => { customers.get(c)!.coVen = v; },
    setCustomerSegment: async (c, s) => { customers.get(c)!.coSeg = s; },
    setDocSeller: async (_k, n, v) => {
      if (n === opts.failDoc) throw new Error('boom');
      docs.find(d => d.docNum === n)!.coVen = v;
    },
  };
  return { erp, customers, docs };
}

function fakeStore(): RunStore & { all: Map<string, RunRecord> } {
  const all = new Map<string, RunRecord>();
  return {
    all,
    create: r => { all.set(r.id, r); },
    get: id => all.get(id),
    setStatus: (id, s: RunStatus) => { all.get(id)!.status = s; },
  };
}

const rows: MappingRow[] = [{
  coCli: 'J1', nombre: 'Uno', coVen: '15', grupo: 'Abasto', tipoCliente: 'Independiente',
  clientePrincipal: 'Uno', effectiveFrom: '2026-03-01', sourceNote: '',
}];

async function planFrom(erp: ErpGateway) {
  return buildPlan({
    rows, customers: await erp.listCustomers(), activeSellers: await erp.listActiveSellers(),
    segments: await erp.listSegments(), docs: await erp.listSellerDocs('2026-03-01'), since: '2026-03-01',
  });
}

describe('applyPlan / rollbackRun', () => {
  test('applies, then a second plan is empty (idempotent)', async () => {
    const { erp, customers, docs } = fakeErp();
    const runs = fakeStore();
    const res = await applyPlan({ erp, runs, newId: () => 'run1' }, await planFrom(erp), { mappingFile: 'm.csv' });
    expect(res.failures).toEqual([]);
    expect(customers.get('J1')).toMatchObject({ coVen: '000015', coSeg: '0023' });
    expect(docs.map(d => d.coVen)).toEqual(['000015', '000015']);
    expect(runs.all.get('run1')!.status).toBe('applied');
    const again = await planFrom(erp);
    expect(again.customerSeller.length + again.customerSegment.length + again.docSeller.length).toBe(0);
  });

  test('snapshot is written before any ERP write and rollback restores everything', async () => {
    const { erp, customers, docs } = fakeErp();
    const runs = fakeStore();
    const spy = erp.setCustomerSeller;
    erp.setCustomerSeller = async (c, v) => {
      expect(runs.all.get('run1')?.status).toBe('pending'); // snapshot already stored
      return spy(c, v);
    };
    await applyPlan({ erp, runs, newId: () => 'run1' }, await planFrom(erp), { mappingFile: 'm.csv' });
    const rb = await rollbackRun({ erp, runs }, 'run1');
    expect(rb.failures).toEqual([]);
    expect(customers.get('J1')).toMatchObject({ coVen: '7', coSeg: '0001' });
    expect(docs.map(d => d.coVen)).toEqual(['7', '6']);
    expect(runs.all.get('run1')!.status).toBe('rolled_back');
  });

  test('a failing document is reported, the run is marked failed, the rest still applies', async () => {
    const { erp, docs } = fakeErp({ failDoc: 'F1' });
    const runs = fakeStore();
    const res = await applyPlan({ erp, runs, newId: () => 'run1' }, await planFrom(erp), { mappingFile: 'm.csv' });
    expect(res.failures[0]).toMatch(/F1.*boom/);
    expect(runs.all.get('run1')!.status).toBe('failed');
    expect(docs.find(d => d.docNum === 'F2')!.coVen).toBe('000015');
    expect(runs.all.get('run1')!.snapshot.docs.map(d => d.docNum)).toContain('F1'); // can still roll back
  });

  test('refuses to apply a plan that has problems', async () => {
    const { erp } = fakeErp();
    const plan = await planFrom(erp);
    plan.problems.push({ kind: 'unknown_customer', coCli: 'X', detail: 'x' });
    await expect(applyPlan({ erp, runs: fakeStore() }, plan, { mappingFile: 'm.csv' })).rejects.toThrow(/problemas/i);
  });
});
```

- [ ] **Step 6: Run to verify failure**

Run: `bun test __tests__/unit/customer-mapping/apply.test.ts`
Expected: FAIL — `apply` module not found.

- [ ] **Step 7: Implement `apply.ts`**

```ts
import type { ErpGateway } from './erp';
import type { Plan } from './plan';
import type { RunSnapshot, RunStore } from './runs-repo';

export interface ApplyDeps {
  erp: ErpGateway;
  runs: RunStore;
  now?: () => number;
  newId?: () => string;
  log?: (m: string) => void;
}

function snapshotOf(plan: Plan): RunSnapshot {
  const customers = new Map<string, { coCli: string; coVen?: string; coSeg?: string }>();
  const entry = (coCli: string) => {
    if (!customers.has(coCli)) customers.set(coCli, { coCli });
    return customers.get(coCli)!;
  };
  for (const c of plan.customerSeller) entry(c.coCli).coVen = c.from;
  for (const c of plan.customerSegment) if (c.from) entry(c.coCli).coSeg = c.from;
  return {
    customers: [...customers.values()],
    docs: plan.docSeller.map(d => ({ kind: d.kind, docNum: d.docNum, coVen: d.from })),
  };
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function applyPlan(
  deps: ApplyDeps, plan: Plan, meta: { mappingFile: string },
): Promise<{ runId: string; failures: string[] }> {
  if (plan.problems.length > 0) {
    throw new Error(`El plan tiene ${plan.problems.length} problemas; corrija el CSV antes de aplicar`);
  }
  const { erp, runs } = deps;
  const log = deps.log ?? (() => {});
  const runId = (deps.newId ?? (() => crypto.randomUUID()))();

  // Snapshot BEFORE the first write, so a crash mid-run is still recoverable with --rollback.
  runs.create({
    id: runId, createdAt: (deps.now ?? Date.now)(), mappingFile: meta.mappingFile,
    status: 'pending', snapshot: snapshotOf(plan),
  });

  const failures: string[] = [];
  const attempt = async (label: string, fn: () => Promise<void>) => {
    try { await fn(); } catch (e) { failures.push(`${label}: ${msg(e)}`); }
  };

  for (const s of plan.segmentsToCreate) await attempt(`segmento ${s.segDes}`, () => erp.createSegment(s.coSeg, s.segDes));
  for (const c of plan.customerSegment) await attempt(`cliente ${c.coCli} segmento`, () => erp.setCustomerSegment(c.coCli, c.to));
  for (const c of plan.customerSeller) await attempt(`cliente ${c.coCli} vendedor`, () => erp.setCustomerSeller(c.coCli, c.to));
  let done = 0;
  for (const d of plan.docSeller) {
    await attempt(`${d.kind} ${d.docNum}`, () => erp.setDocSeller(d.kind, d.docNum, d.to));
    if (++done % 200 === 0) log(`  documentos: ${done}/${plan.docSeller.length}`);
  }

  runs.setStatus(runId, failures.length ? 'failed' : 'applied');
  return { runId, failures };
}

export async function rollbackRun(deps: ApplyDeps, runId: string): Promise<{ failures: string[] }> {
  const run = deps.runs.get(runId);
  if (!run) throw new Error(`Corrida ${runId} no encontrada`);
  if (run.status === 'rolled_back') throw new Error(`La corrida ${runId} ya fue revertida`);

  const failures: string[] = [];
  const attempt = async (label: string, fn: () => Promise<void>) => {
    try { await fn(); } catch (e) { failures.push(`${label}: ${msg(e)}`); }
  };
  for (const c of run.snapshot.customers) {
    if (c.coSeg) await attempt(`cliente ${c.coCli} segmento`, () => deps.erp.setCustomerSegment(c.coCli, c.coSeg!));
    if (c.coVen) await attempt(`cliente ${c.coCli} vendedor`, () => deps.erp.setCustomerSeller(c.coCli, c.coVen!));
  }
  for (const d of run.snapshot.docs) await attempt(`${d.kind} ${d.docNum}`, () => deps.erp.setDocSeller(d.kind, d.docNum, d.coVen));

  if (failures.length === 0) deps.runs.setStatus(runId, 'rolled_back');
  return { failures };
}
```
(Segments created by a run are intentionally not deleted on rollback; customers whose previous `co_seg` was NULL keep the new segment — documented in INSTRUCTIONS.md in Task 7.)

- [ ] **Step 8: Run all unit tests**

Run: `bun test __tests__/unit/customer-mapping`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/customer-mapping __tests__/unit/customer-mapping
git commit -m "feat(mapping): plan diff, apply and rollback orchestration" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: DWH table, view, mapping upsert, loads and verification

**Files:**
- Create: `migrations/dwh/0039_dim_customer_mapping.sql`, `lib/customer-mapping/dwh.ts`, `scripts/dwh/__tests__/dim-customer-mapping.test.ts`
- Modify: `migrations/dwh/README.md` (one line listing 0039)

**Interfaces:**
- Consumes: `MappingRow`, `sellerKey`.
- Produces:
  - `upsertDwhMapping(pool: sql.ConnectionPool, rows: MappingRow[]): Promise<number>`
  - `runDwhRestateLoads(pool: sql.ConnectionPool): Promise<void>` (runs `dwh.Load_Dim_Customer`, `Load_Dim_SalesRep`, `Load_Fact_Sales`, `Load_Fact_Returns`)
  - `findSellerMismatches(pool: sql.ConnectionPool, rows: MappingRow[], sinceDateKey: number): Promise<{ table: 'Fact_Sales' | 'Fact_Returns'; coCli: string; expected: string; actual: string | null; n: number }[]>`

- [ ] **Step 1: Write the failing DWH test**

`scripts/dwh/__tests__/dim-customer-mapping.test.ts` (same skeleton as `dim-customer.test.ts`: throwaway DB name, `testConfig`, `afterAll` drop):
```ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { runDwhMigrations, dwhDatabaseName } from '../../migrate-dwh';
import { upsertDwhMapping } from '../../../lib/customer-mapping/dwh';

process.env.DW_NAME = `DWH_AlimentosNY_Test_dim_customer_mapping_${Date.now()}`;

function testConfig(database: string): sql.config {
  return {
    server: process.env.DW_SERVER ?? process.env.DB_SERVER!,
    port: parseInt(process.env.DW_PORT ?? process.env.DB_PORT ?? '1433'),
    database,
    user: process.env.DW_USER ?? process.env.DB_USER!,
    password: process.env.DW_PASSWORD ?? process.env.DB_PASSWORD!,
    options: {
      encrypt: (process.env.DW_ENCRYPT ?? process.env.DB_ENCRYPT) === 'true',
      trustServerCertificate: (process.env.DW_TRUST_SERVER_CERT ?? process.env.DB_TRUST_SERVER_CERT) !== 'false',
    },
  };
}

describe('Dim_CustomerMapping', () => {
  let pool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    await pool.request().execute('dwh.Load_Dim_Customer');
  }, 60_000);

  afterAll(async () => {
    await pool.close();
    const master = await new sql.ConnectionPool(testConfig('master')).connect();
    await master.request().query(`
      ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE [${dwhDatabaseName()}];`);
    await master.close();
  });

  test('upsert inserts then updates; the view exposes group/type/parent next to the dimension row', async () => {
    const pick = await pool.request().query(`SELECT TOP 1 RTRIM(CustomerCode) AS code FROM dim.Dim_Customer WHERE IsCurrent = 1`);
    const code: string = pick.recordset[0].code;
    const row = (grupo: string) => ({
      coCli: code, nombre: 'X', coVen: '', grupo, tipoCliente: 'Cadena' as const,
      clientePrincipal: 'Gama', effectiveFrom: '2026-03-01', sourceNote: '',
    });
    await upsertDwhMapping(pool, [row('Supermercado')]);
    await upsertDwhMapping(pool, [row('Farmacia')]);

    const count = await pool.request().input('c', sql.Char(16), code)
      .query(`SELECT COUNT(*) AS n FROM dim.Dim_CustomerMapping WHERE RTRIM(CustomerCode) = RTRIM(@c)`);
    expect(count.recordset[0].n).toBe(1);

    const v = await pool.request().input('c', sql.Char(16), code)
      .query(`SELECT CustomerGroup, CustomerType, ParentCustomerName FROM dim.vw_Customer_Classified
              WHERE RTRIM(CustomerCode) = RTRIM(@c) AND IsCurrent = 1`);
    expect(v.recordset[0]).toMatchObject({ CustomerGroup: 'Farmacia', CustomerType: 'Cadena', ParentCustomerName: 'Gama' });
  });

  test('migration 0039 is re-runnable', async () => {
    await runDwhMigrations();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test --isolate --env-file=.env.local --timeout 30000 scripts/dwh/__tests__/dim-customer-mapping.test.ts`
Expected: FAIL — `lib/customer-mapping/dwh` not found / view missing.

- [ ] **Step 3: Write the migration**

`migrations/dwh/0039_dim_customer_mapping.sql`:
```sql
-- 0039: customer classification supplied by the business (2026-bbdd-profit.xlsx).
-- Group also lives in the ERP (saCliente.co_seg → Dim_Customer.SegmentCode); type and
-- parent customer exist only here. Populated by `bun run mapping:apply`. Re-runnable.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Dim_CustomerMapping' AND schema_id = SCHEMA_ID('dim'))
BEGIN
    CREATE TABLE dim.Dim_CustomerMapping (
        CustomerCode       char(16)     NOT NULL PRIMARY KEY,
        CustomerGroup      varchar(60)  NOT NULL,
        CustomerType       varchar(20)  NOT NULL,
        ParentCustomerName varchar(120) NOT NULL,
        EffectiveFrom      date         NOT NULL,
        LoadedAtUtc        datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

CREATE OR ALTER VIEW dim.vw_Customer_Classified AS
SELECT
    c.CustomerKey, c.CustomerCode, c.CustomerName, c.SegmentCode, c.DefaultSalesRepCode,
    c.IsCurrent, c.ValidFrom, c.ValidTo,
    m.CustomerGroup, m.CustomerType, m.ParentCustomerName, m.EffectiveFrom AS ClassificationEffectiveFrom
FROM dim.Dim_Customer c
LEFT JOIN dim.Dim_CustomerMapping m ON RTRIM(m.CustomerCode) = RTRIM(c.CustomerCode);
GO
```
Add one line to `migrations/dwh/README.md` where migrations are listed (follow the file's existing format).

- [ ] **Step 4: Implement `lib/customer-mapping/dwh.ts`**

```ts
import sql from 'mssql';
import { sellerKey } from './codes';
import type { MappingRow } from './types';

export async function upsertDwhMapping(pool: sql.ConnectionPool, rows: MappingRow[]): Promise<number> {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    for (const r of rows) {
      await new sql.Request(tx)
        .input('code', sql.Char(16), r.coCli).input('grupo', sql.VarChar(60), r.grupo)
        .input('tipo', sql.VarChar(20), r.tipoCliente).input('parent', sql.VarChar(120), r.clientePrincipal)
        .input('eff', sql.VarChar(10), r.effectiveFrom)
        .query(`
          MERGE dim.Dim_CustomerMapping AS t
          USING (SELECT @code AS CustomerCode) AS s ON RTRIM(t.CustomerCode) = RTRIM(s.CustomerCode)
          WHEN MATCHED THEN UPDATE SET CustomerGroup = @grupo, CustomerType = @tipo,
               ParentCustomerName = @parent, EffectiveFrom = CONVERT(date, @eff, 23), LoadedAtUtc = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN INSERT (CustomerCode, CustomerGroup, CustomerType, ParentCustomerName, EffectiveFrom)
               VALUES (@code, @grupo, @tipo, @parent, CONVERT(date, @eff, 23));`);
    }
    await tx.commit();
    return rows.length;
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

// Order matters: dimensions before facts (same rule as scripts/dwh-incremental-load.ts).
// Facts reload by themselves because the ERP writes bumped `validador` on the changed documents.
export async function runDwhRestateLoads(pool: sql.ConnectionPool): Promise<void> {
  await pool.request().batch(`
    EXEC dwh.Load_Dim_Customer;
    EXEC dwh.Load_Dim_SalesRep;
    EXEC dwh.Load_Fact_Sales;
    EXEC dwh.Load_Fact_Returns;`);
}

export interface SellerMismatch {
  table: 'Fact_Sales' | 'Fact_Returns';
  coCli: string; expected: string; actual: string | null; n: number;
}

export async function findSellerMismatches(
  pool: sql.ConnectionPool, rows: MappingRow[], sinceDateKey: number,
): Promise<SellerMismatch[]> {
  const expected = new Map(rows.filter(r => r.coVen.trim()).map(r => [r.coCli, r.coVen.trim()]));
  const out: SellerMismatch[] = [];
  for (const table of ['Fact_Sales', 'Fact_Returns'] as const) {
    const res = await pool.request().input('since', sql.Int, sinceDateKey).query(`
      SELECT RTRIM(c.CustomerCode) AS coCli, RTRIM(rep.SalesRepCode) AS rep, COUNT(*) AS n
      FROM fact.${table} f
      JOIN dim.Dim_Customer c ON c.CustomerKey = f.CustomerKey
      LEFT JOIN dim.Dim_SalesRep rep ON rep.SalesRepKey = f.SalesRepKey
      WHERE f.DateKey >= @since AND f.IsVoided = 0
      GROUP BY RTRIM(c.CustomerCode), RTRIM(rep.SalesRepCode)`);
    for (const x of res.recordset as { coCli: string; rep: string | null; n: number }[]) {
      const want = expected.get(x.coCli);
      if (want && (x.rep == null || sellerKey(x.rep) !== sellerKey(want))) {
        out.push({ table, coCli: x.coCli, expected: want, actual: x.rep, n: x.n });
      }
    }
  }
  return out;
}
```

- [ ] **Step 5: Run the DWH test and typecheck**

Run: `bun test --isolate --env-file=.env.local --timeout 30000 scripts/dwh/__tests__/dim-customer-mapping.test.ts && bunx tsc --noEmit`
Expected: PASS (2 tests); no type errors.

- [ ] **Step 6: Commit**

```bash
git add migrations/dwh lib/customer-mapping/dwh.ts scripts/dwh/__tests__/dim-customer-mapping.test.ts
git commit -m "feat(mapping): DWH customer mapping table, view, loads and verification" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `mapping:apply` CLI, docs, and the guarded rollout

**Files:**
- Create: `scripts/mapping-apply.ts`
- Modify: `package.json` (script `mapping:apply`), `INSTRUCTIONS.md` (new section), `AGENTS.md` (directory map + co_seg exception)

**Interfaces:**
- Consumes: `csvToMapping`, `buildPlan`, `applyPlan`, `rollbackRun`, `mssqlGateway`, `sqliteRunStore`, `upsertDwhMapping`, `runDwhRestateLoads`, `findSellerMismatches`, `getPool`, `getDb`, `buildConfig`/`dwhDatabaseName` (`scripts/migrate-dwh.ts`).

- [ ] **Step 1: Implement the CLI**

`scripts/mapping-apply.ts`:
```ts
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import sql from 'mssql';
import { buildCsv } from '@/lib/csv';
import { getPool } from '@/lib/db/mssql';
import { getDb } from '@/lib/db/sqlite';
import { applyPlan, rollbackRun } from '@/lib/customer-mapping/apply';
import { csvToMapping } from '@/lib/customer-mapping/csv';
import { findSellerMismatches, runDwhRestateLoads, upsertDwhMapping } from '@/lib/customer-mapping/dwh';
import { mssqlGateway } from '@/lib/customer-mapping/erp';
import { buildPlan, type Plan } from '@/lib/customer-mapping/plan';
import { sqliteRunStore } from '@/lib/customer-mapping/runs-repo';
import { buildConfig, dwhDatabaseName } from './migrate-dwh';

const USAGE = `Uso:
  bun run mapping:apply -- --file data/customer-mapping/2026-03.csv                       # simulación (por defecto)
  bun run mapping:apply -- --file ... --apply --confirm-db <DB_NAME> [--no-dwh]           # aplica
  bun run mapping:apply -- --rollback <runId> --confirm-db <DB_NAME>                       # revierte
  bun run mapping:apply -- --file ... --verify                                             # compara el DWH con el CSV`;

function diffCsv(plan: Plan): string {
  const rows: Record<string, unknown>[] = [
    ...plan.segmentsToCreate.map(s => ({ kind: 'crear_segmento', key: s.coSeg, from: '', to: s.segDes })),
    ...plan.customerSegment.map(c => ({ kind: 'cliente_segmento', key: c.coCli, from: c.from ?? '', to: `${c.to} (${c.grupo})` })),
    ...plan.customerSeller.map(c => ({ kind: 'cliente_vendedor', key: c.coCli, from: c.from, to: c.to })),
    ...plan.docSeller.map(d => ({ kind: `doc_${d.kind}`, key: `${d.docNum} (${d.coCli})`, from: d.from, to: d.to })),
    ...plan.problems.map(p => ({ kind: `PROBLEMA_${p.kind}`, key: p.coCli, from: '', to: p.detail })),
  ];
  return buildCsv(['kind', 'key', 'from', 'to'].map((k, i) => ({ key: k, label: k, defaultVisible: true, defaultOrder: i })), rows);
}

async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: 'string' }, apply: { type: 'boolean', default: false },
      rollback: { type: 'string' }, 'confirm-db': { type: 'string' },
      'no-dwh': { type: 'boolean', default: false }, verify: { type: 'boolean', default: false },
    },
  });
  const erpPool = await getPool();
  const dwhPool = await new sql.ConnectionPool(buildConfig(dwhDatabaseName())).connect();
  const runs = sqliteRunStore(getDb());
  const erp = mssqlGateway(erpPool);
  const deps = { erp, runs, log: console.log };

  try {
    const writing = values.apply || values.rollback;
    if (writing && values['confirm-db'] !== process.env.DB_NAME) {
      throw new Error(`--confirm-db debe ser exactamente '${process.env.DB_NAME}' (la base de datos ERP destino)`);
    }

    if (values.rollback) {
      const r = await rollbackRun(deps, values.rollback);
      console.log(r.failures.length ? `Reversión con ${r.failures.length} fallos:\n${r.failures.join('\n')}` : 'Reversión completa.');
      process.exitCode = r.failures.length ? 1 : 0;
      return;
    }

    if (!values.file) throw new Error(USAGE);
    const { rows, errors } = csvToMapping(await readFile(values.file, 'utf8'));
    if (errors.length) throw new Error(`CSV inválido:\n${errors.join('\n')}`);
    const since = rows[0]?.effectiveFrom ?? '2026-03-01';

    if (values.verify) {
      const sinceKey = Number(since.replaceAll('-', ''));
      const bad = await findSellerMismatches(dwhPool, rows, sinceKey);
      console.log(bad.length ? `${bad.length} grupos con vendedor distinto al mapeo:` : 'DWH coincide con el mapeo.');
      console.table(bad.slice(0, 30));
      process.exitCode = bad.length ? 1 : 0;
      return;
    }

    const plan = buildPlan({
      rows, since,
      customers: await erp.listCustomers(), activeSellers: await erp.listActiveSellers(),
      segments: await erp.listSegments(), docs: await erp.listSellerDocs(since),
    });
    const diffPath = values.file.replace(/\.csv$/, '.diff.csv');
    await writeFile(diffPath, diffCsv(plan), 'utf8');
    console.log(`Segmentos a crear: ${plan.segmentsToCreate.length} | clientes (grupo): ${plan.customerSegment.length} | ` +
      `clientes (vendedor): ${plan.customerSeller.length} | documentos: ${plan.docSeller.length} | problemas: ${plan.problems.length}`);
    for (const p of plan.problems.slice(0, 20)) console.log(`  ✗ ${p.coCli}: ${p.detail}`);
    console.log(`Diff completo: ${diffPath}`);

    if (!values.apply) { console.log('Simulación: no se escribió nada. Use --apply --confirm-db para aplicar.'); return; }

    const res = await applyPlan(deps, plan, { mappingFile: values.file });
    console.log(`Corrida ${res.runId}: ${res.failures.length ? `${res.failures.length} fallos` : 'OK'}`);
    for (const f of res.failures.slice(0, 20)) console.log(`  ✗ ${f}`);
    if (res.failures.length) { process.exitCode = 1; return; }

    if (!values['no-dwh']) {
      await upsertDwhMapping(dwhPool, rows);
      await runDwhRestateLoads(dwhPool);
      console.log('DWH actualizado. Verifique con: bun run mapping:apply -- --file ' + values.file + ' --verify');
    }
  } finally {
    await dwhPool.close();
    await erpPool.close();
  }
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
```
Add `"mapping:apply": "bun --bun run scripts/mapping-apply.ts"` to `package.json`.

- [ ] **Step 2: Typecheck and run all unit tests**

Run: `bunx tsc --noEmit && bun test __tests__/unit/customer-mapping`
Expected: PASS, no type errors.

- [ ] **Step 3: Docs**

- `INSTRUCTIONS.md`: add a section "Customer mapping fix": build (`mapping:build`), review `*.conflicts.csv` and edit the CSV, dry-run + `*.diff.csv`, `--apply --confirm-db`, `--verify`, `--rollback <runId>`; state that segments created by a run and `co_seg` of customers whose previous value was NULL are not reverted; that the first real run must go against a non-production copy; and that `bun run test:mapping-erp` writes to the ERP.
- `AGENTS.md`: in the Directory Map add `lib/customer-mapping/` (one line per file group) and `migrations/mssql/0016`, `migrations/dwh/0039`; in the Pricing section's rule "`saCliente.co_seg` is never written", add "— except by `bun run mapping:apply` (`pApiActualizarSegmentoCliente`), which assigns the business customer group".

- [ ] **Step 4: Commit code + docs**

```bash
git add scripts/mapping-apply.ts package.json INSTRUCTIONS.md AGENTS.md
git commit -m "feat(mapping): mapping:apply CLI with dry-run, rollback and DWH verify" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Guarded rollout (HUMAN checkpoints — do not skip)**

1. `bun run mapping:build -- /Users/eugenio/Desktop/2026-bbdd-profit.xlsx` → hand the CSV and `2026-03.conflicts.csv` to the user; **wait** for their edits (multi-seller customers, duplicate code, no-invoice customers).
2. Dry-run against the **non-production** ERP: `bun run mapping:apply -- --file data/customer-mapping/2026-03.csv`. Resolve every `PROBLEMA_*` row in the diff CSV with the user (unknown customers/sellers).
3. Apply on non-production: `bun run mapping:apply -- --file ... --apply --confirm-db <NON-PROD DB_NAME>`, then `--verify` (expect "DWH coincide con el mapeo."), then test `--rollback <runId>` and re-apply.
4. Only after the user explicitly approves, repeat step 3 against production. Report counts exactly as the command prints them.
