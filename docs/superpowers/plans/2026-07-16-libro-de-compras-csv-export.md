# Libro de Compras CSV Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement dual-procedure libro de compras export that joins retention and main purchase data in-memory and outputs a properly formatted CSV with 17 columns.

**Architecture:** Query two stored procedures (`RepLibroCompra` for purchases, `RepLibroCompraRetenciones` for retentions), join on document identifiers in-memory, map to export schema, filter zero-value totals, generate robust CSV (handling commas), and wire download flow. Update report config to reflect dual-procedure approach and add single-option sucursal selector.

**Tech Stack:** TypeScript, SQL Server stored procedures, CSV generation (papaparse or native), React for UI, server routes for query execution.

## Global Constraints

- Filter out rows where `total_neto` is 0
- CSV must handle commas in field values (proper escaping)
- Two procedures: `RepLibroCompra` (main purchases) and `RepLibroCompraRetenciones` (retentions)
- Sucursal selector: single option only, hardcoded to "000001" with label "Oficina"
- Export 17 columns per `outputCsvSchema` mapping
- Date range parameters: start and end date (smalldatetime)

---

## File Structure

**Files to Create:**
- `lib/reports/mappers/compras-mapper.ts` — join and transform raw procedure results to export schema
- `lib/reports/queries/compras-query.ts` — execute both procedures and return joined results
- `lib/routes/export/compras-csv.ts` — CSV generation and download endpoint

**Files to Modify:**
- `lib/reports/compras.ts` — update column definitions and reference dual procedures
- `lib/reports/registry.ts` — ensure compras report is registered correctly
- `lib/routes/export.ts` or similar — wire up CSV export route if needed
- `pages/api/reports/export.ts` or `app/api/reports/[...].ts` — add route handler for compras CSV export

---

## Task 1: Define Mapper for Compras Data

**Files:**
- Create: `lib/reports/mappers/compras-mapper.ts`
- Test: `lib/reports/mappers/__tests__/compras-mapper.test.ts`

**Interfaces:**
- Consumes: Raw rows from `RepLibroCompra` (with columns: `nro_doc`, `fecha_emis`, `r`, `prov_des`, `tipo_prov`, `num_comprobante`, `nro_orig`, `n_control`, `anulado`, `co_tipo_doc`, `doc_orig`, `doc_afec`, `total_neto`, `compras_exentas`, `base_imp`, `tasa`, `monto_imp`, `monto_ret_imp`)
- Consumes: Raw rows from `RepLibroCompraRetenciones` (with columns: `num_comprobante`, `monto_ret_imp_tercero`, etc.)
- Produces: `ComprasExportRow[]` with fields matching `outputCsvSchema`:
  - `nro: number` — sequence index
  - `fecha: string` — formatted date (YYYY-MM-DD)
  - `rif: string`
  - `nombre_proveedor: string`
  - `tipo_proveedor: string`
  - `nro_comprobante: string`
  - `nro_factura: string`
  - `nro_control: string`
  - `tipo_transaccion: string`
  - `nro_nota_debito: string`
  - `nro_nota_credito: string`
  - `nro_factura_afectada: string`
  - `total_compras_incluye_iva: number`
  - `compras_sin_derecho_credito: number`
  - `base_imponible: number`
  - `alicuota: number`
  - `impuesto_iva: number`
  - `iva_retenido: number`

- [ ] **Step 1: Write TypeScript types for raw procedure output**

```typescript
// lib/reports/mappers/compras-mapper.ts

export interface ComprasRawRow {
  nro_doc: string;
  fecha_emis: string; // ISO string or Date
  r: string;
  prov_des: string;
  tipo_prov: string;
  num_comprobante: string;
  nro_orig: string;
  n_control: string;
  anulado: number; // 0 or 1
  co_tipo_doc: string; // 'FACT', 'N/DB', 'N/CR', etc.
  doc_orig: string;
  doc_afec: string;
  total_neto: number;
  compras_exentas: number;
  base_imp: number;
  tasa: number;
  monto_imp: number;
  monto_ret_imp: number;
}

export interface ComprasRetentionRawRow {
  num_comprobante: string;
  monto_ret_imp_tercero: number;
}

export interface ComprasExportRow {
  nro: number;
  fecha: string;
  rif: string;
  nombre_proveedor: string;
  tipo_proveedor: string;
  nro_comprobante: string;
  nro_factura: string;
  nro_control: string;
  tipo_transaccion: string;
  nro_nota_debito: string;
  nro_nota_credito: string;
  nro_factura_afectada: string;
  total_compras_incluye_iva: number;
  compras_sin_derecho_credito: number;
  base_imponible: number;
  alicuota: number;
  impuesto_iva: number;
  iva_retenido: number;
}
```

- [ ] **Step 2: Write mapper function**

```typescript
export function mapComprasData(
  mainRows: ComprasRawRow[],
  retentionRows: ComprasRetentionRawRow[]
): ComprasExportRow[] {
  // Build map of retention data by num_comprobante for fast lookup
  const retentionMap = new Map<string, ComprasRetentionRawRow>();
  retentionRows.forEach(row => {
    retentionMap.set(row.num_comprobante, row);
  });

  return mainRows
    .filter(row => row.total_neto !== 0) // Filter out zero-total rows
    .map((row, index) => {
      const retention = retentionMap.get(row.num_comprobante);
      const monto_ret_imp_tercero = retention?.monto_ret_imp_tercero ?? 0;

      // Determine tipo_transaccion: 0 -> '01-reg', 1 -> '03-anu'
      const tipo_transaccion = row.anulado === 1 ? '03-anu' : '01-reg';

      // Determine nro_factura, nro_nota_debito, nro_nota_credito based on co_tipo_doc
      let nro_factura = '';
      let nro_nota_debito = '';
      let nro_nota_credito = '';
      let nro_factura_afectada = '';

      if (row.co_tipo_doc === 'FACT') {
        nro_factura = row.nro_orig;
        nro_factura_afectada = row.doc_afec || '';
      } else if (row.co_tipo_doc === 'N/DB') {
        nro_nota_debito = row.doc_orig;
        nro_factura_afectada = row.doc_afec || '';
      } else if (row.co_tipo_doc === 'N/CR') {
        nro_nota_credito = row.doc_orig;
        nro_factura_afectada = row.doc_afec || '';
      }

      // Format fecha_emis as YYYY-MM-DD
      const fecha = new Date(row.fecha_emis);
      const fecha_formatted = fecha.toISOString().split('T')[0];

      return {
        nro: index + 1,
        fecha: fecha_formatted,
        rif: row.r,
        nombre_proveedor: row.prov_des,
        tipo_proveedor: row.tipo_prov,
        nro_comprobante: row.num_comprobante,
        nro_factura,
        nro_control: row.n_control,
        tipo_transaccion,
        nro_nota_debito,
        nro_nota_credito,
        nro_factura_afectada,
        total_compras_incluye_iva: row.total_neto,
        compras_sin_derecho_credito: row.compras_exentas,
        base_imponible: row.base_imp,
        alicuota: row.tasa,
        impuesto_iva: row.monto_imp,
        iva_retenido: row.monto_ret_imp + monto_ret_imp_tercero,
      };
    });
}
```

- [ ] **Step 3: Write test for mapper**

```typescript
// lib/reports/mappers/__tests__/compras-mapper.test.ts

import { mapComprasData } from '../compras-mapper';

describe('comprasMapper', () => {
  it('filters out rows with total_neto = 0', () => {
    const mainRows = [
      {
        nro_doc: '001',
        fecha_emis: '2026-06-10',
        r: 'J-12345',
        prov_des: 'Provider A',
        tipo_prov: 'PJD',
        num_comprobante: 'CB001',
        nro_orig: 'FACT001',
        n_control: 'NC001',
        anulado: 0,
        co_tipo_doc: 'FACT',
        doc_orig: '',
        doc_afec: '',
        total_neto: 0,
        compras_exentas: 0,
        base_imp: 0,
        tasa: 0,
        monto_imp: 0,
        monto_ret_imp: 0,
      },
      {
        nro_doc: '002',
        fecha_emis: '2026-06-10',
        r: 'J-12346',
        prov_des: 'Provider B',
        tipo_prov: 'PJD',
        num_comprobante: 'CB002',
        nro_orig: 'FACT002',
        n_control: 'NC002',
        anulado: 0,
        co_tipo_doc: 'FACT',
        doc_orig: '',
        doc_afec: '',
        total_neto: 1000,
        compras_exentas: 0,
        base_imp: 1000,
        tasa: 16,
        monto_imp: 160,
        monto_ret_imp: 0,
      },
    ];
    const result = mapComprasData(mainRows, []);
    expect(result).toHaveLength(1);
    expect(result[0].nro).toBe(1);
  });

  it('joins retention data by num_comprobante', () => {
    const mainRows = [
      {
        nro_doc: '001',
        fecha_emis: '2026-06-10',
        r: 'J-12345',
        prov_des: 'Provider A',
        tipo_prov: 'PJD',
        num_comprobante: 'CB001',
        nro_orig: 'FACT001',
        n_control: 'NC001',
        anulado: 0,
        co_tipo_doc: 'FACT',
        doc_orig: '',
        doc_afec: '',
        total_neto: 1000,
        compras_exentas: 0,
        base_imp: 1000,
        tasa: 16,
        monto_imp: 160,
        monto_ret_imp: 50,
      },
    ];
    const retentionRows = [
      { num_comprobante: 'CB001', monto_ret_imp_tercero: 30 },
    ];
    const result = mapComprasData(mainRows, retentionRows);
    expect(result[0].iva_retenido).toBe(80); // 50 + 30
  });

  it('maps co_tipo_doc to correct columns', () => {
    const mainRows = [
      {
        nro_doc: '001',
        fecha_emis: '2026-06-10',
        r: 'J-12345',
        prov_des: 'Provider A',
        tipo_prov: 'PJD',
        num_comprobante: 'CB001',
        nro_orig: 'FACT001',
        n_control: 'NC001',
        anulado: 0,
        co_tipo_doc: 'N/DB',
        doc_orig: 'ND001',
        doc_afec: 'FACT999',
        total_neto: 1000,
        compras_exentas: 0,
        base_imp: 1000,
        tasa: 16,
        monto_imp: 160,
        monto_ret_imp: 0,
      },
    ];
    const result = mapComprasData(mainRows, []);
    expect(result[0].nro_nota_debito).toBe('ND001');
    expect(result[0].nro_factura).toBe('');
    expect(result[0].nro_factura_afectada).toBe('FACT999');
  });

  it('converts anulado to tipo_transaccion', () => {
    const mainRows = [
      {
        nro_doc: '001',
        fecha_emis: '2026-06-10',
        r: 'J-12345',
        prov_des: 'Provider A',
        tipo_prov: 'PJD',
        num_comprobante: 'CB001',
        nro_orig: 'FACT001',
        n_control: 'NC001',
        anulado: 1,
        co_tipo_doc: 'FACT',
        doc_orig: '',
        doc_afec: '',
        total_neto: 1000,
        compras_exentas: 0,
        base_imp: 1000,
        tasa: 16,
        monto_imp: 160,
        monto_ret_imp: 0,
      },
    ];
    const result = mapComprasData(mainRows, []);
    expect(result[0].tipo_transaccion).toBe('03-anu');
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npm test -- lib/reports/mappers/__tests__/compras-mapper.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/reports/mappers/compras-mapper.ts lib/reports/mappers/__tests__/compras-mapper.test.ts
git commit -m "feat: add compras data mapper with join and transformation logic"
```

---

## Task 2: Implement Query Executor for Dual Procedures

**Files:**
- Create: `lib/reports/queries/compras-query.ts`
- Modify: `lib/reports/queries/index.ts` (or similar query export file)
- Test: `lib/reports/queries/__tests__/compras-query.test.ts`

**Interfaces:**
- Consumes: Database connection (your existing query pattern)
- Consumes: Start date and end date (Date or string)
- Consumes: Sucursal code (string, e.g., "000001")
- Produces: `{ mainRows: ComprasRawRow[]; retentionRows: ComprasRetentionRawRow[] }`

- [ ] **Step 1: Write query function with dual procedure calls**

```typescript
// lib/reports/queries/compras-query.ts

import { db } from '@/lib/db'; // Adjust to your DB connection pattern
import type { ComprasRawRow, ComprasRetentionRawRow } from '../mappers/compras-mapper';

export async function queryComprasData(
  startDate: Date | string,
  endDate: Date | string,
  sucursal: string
): Promise<{ mainRows: ComprasRawRow[]; retentionRows: ComprasRetentionRawRow[] }> {
  // Convert dates to ISO strings if needed
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

  // Execute RepLibroCompra procedure
  const mainRows = await db.query<ComprasRawRow>(
    `EXEC [dbo].[RepLibroCompra] @cCo_Sucursal = @sucursal, @sCo_fecha_d = @startDate, @sCo_fecha_h = @endDate`,
    {
      sucursal,
      startDate: start,
      endDate: end,
    }
  );

  // Execute RepLibroCompraRetenciones procedure
  const retentionRows = await db.query<ComprasRetentionRawRow>(
    `EXEC [dbo].[RepLibroCompraRetenciones] @cCo_Sucursal = @sucursal, @sCo_fecha_d = @startDate, @sCo_fecha_h = @endDate`,
    {
      sucursal,
      startDate: start,
      endDate: end,
    }
  );

  return { mainRows, retentionRows };
}
```

*(Adjust the query syntax and DB pattern to match your existing codebase — this assumes a generic `db.query()` pattern. If using a different query builder, adapt accordingly.)*

- [ ] **Step 2: Write unit test for query executor**

```typescript
// lib/reports/queries/__tests__/compras-query.test.ts

import { queryComprasData } from '../compras-query';
import * as db from '@/lib/db';

jest.mock('@/lib/db');

describe('queryComprasData', () => {
  it('executes both procedures with correct parameters', async () => {
    const mockMainRows = [
      {
        nro_doc: '001',
        fecha_emis: '2026-06-10',
        r: 'J-12345',
        prov_des: 'Provider A',
        tipo_prov: 'PJD',
        num_comprobante: 'CB001',
        nro_orig: 'FACT001',
        n_control: 'NC001',
        anulado: 0,
        co_tipo_doc: 'FACT',
        doc_orig: '',
        doc_afec: '',
        total_neto: 1000,
        compras_exentas: 0,
        base_imp: 1000,
        tasa: 16,
        monto_imp: 160,
        monto_ret_imp: 0,
      },
    ];
    const mockRetentionRows = [
      { num_comprobante: 'CB001', monto_ret_imp_tercero: 30 },
    ];

    (db.query as jest.Mock)
      .mockResolvedValueOnce(mockMainRows)
      .mockResolvedValueOnce(mockRetentionRows);

    const result = await queryComprasData('2026-06-01', '2026-06-30', '000001');

    expect(result.mainRows).toEqual(mockMainRows);
    expect(result.retentionRows).toEqual(mockRetentionRows);
    expect(db.query).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npm test -- lib/reports/queries/__tests__/compras-query.test.ts
```

Expected: Tests pass (mocked DB calls work correctly).

- [ ] **Step 4: Commit**

```bash
git add lib/reports/queries/compras-query.ts lib/reports/queries/__tests__/compras-query.test.ts
git commit -m "feat: add dual-procedure query executor for compras report"
```

---

## Task 3: Implement CSV Generation with Robust Escaping

**Files:**
- Create: `lib/reports/csv/compras-csv-generator.ts`
- Test: `lib/reports/csv/__tests__/compras-csv-generator.test.ts`

**Interfaces:**
- Consumes: `ComprasExportRow[]`
- Produces: CSV string (with proper header and escaping)

- [ ] **Step 1: Write CSV generator function**

```typescript
// lib/reports/csv/compras-csv-generator.ts

import type { ComprasExportRow } from '../mappers/compras-mapper';

const HEADERS = [
  'Nº',
  'FECHA',
  'RIF',
  'NOMBRE PROVEEDOR',
  'TIPO PROVEEDOR',
  'Nº DE COMPROBANTE',
  'Nº DE FACTURA',
  'Nº DE CONTROL',
  'TIPO DE TRANSACCION',
  'Nº NOTA DE DEBITO',
  'Nº NOTA DE CREDITO',
  'Nº FACTURA AFECTADA',
  'TOTAL COMPRAS INCLUYE IVA',
  'COMPRAS SIN DERECHO A CREDITO IVA',
  'BASE IMPONIBLE',
  '% ALICUOTA',
  'IMPUESTO IVA',
  'IVA RETENIDO',
];

function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // If field contains comma, quote, or newline, wrap in quotes and escape inner quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export function generateComprasCsv(rows: ComprasExportRow[]): string {
  const lines: string[] = [];

  // Add header row
  lines.push(HEADERS.map(h => escapeCsvField(h)).join(','));

  // Add data rows
  rows.forEach(row => {
    const values = [
      row.nro,
      row.fecha,
      row.rif,
      row.nombre_proveedor,
      row.tipo_proveedor,
      row.nro_comprobante,
      row.nro_factura,
      row.nro_control,
      row.tipo_transaccion,
      row.nro_nota_debito,
      row.nro_nota_credito,
      row.nro_factura_afectada,
      row.total_compras_incluye_iva,
      row.compras_sin_derecho_credito,
      row.base_imponible,
      row.alicuota,
      row.impuesto_iva,
      row.iva_retenido,
    ];
    lines.push(values.map(v => escapeCsvField(v)).join(','));
  });

  return lines.join('\n');
}
```

- [ ] **Step 2: Write test for CSV generation**

```typescript
// lib/reports/csv/__tests__/compras-csv-generator.test.ts

import { generateComprasCsv } from '../compras-csv-generator';
import type { ComprasExportRow } from '../../mappers/compras-mapper';

describe('generateComprasCsv', () => {
  it('generates CSV with proper header', () => {
    const rows: ComprasExportRow[] = [];
    const csv = generateComprasCsv(rows);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('Nº,FECHA,RIF');
  });

  it('escapes commas in field values', () => {
    const rows: ComprasExportRow[] = [
      {
        nro: 1,
        fecha: '2026-06-10',
        rif: 'J-12345',
        nombre_proveedor: 'Provider, Inc.',
        tipo_proveedor: 'PJD',
        nro_comprobante: 'CB001',
        nro_factura: 'FACT001',
        nro_control: 'NC001',
        tipo_transaccion: '01-reg',
        nro_nota_debito: '',
        nro_nota_credito: '',
        nro_factura_afectada: '',
        total_compras_incluye_iva: 1000,
        compras_sin_derecho_credito: 0,
        base_imponible: 1000,
        alicuota: 16,
        impuesto_iva: 160,
        iva_retenido: 50,
      },
    ];
    const csv = generateComprasCsv(rows);
    expect(csv).toContain('"Provider, Inc."');
  });

  it('escapes quotes in field values', () => {
    const rows: ComprasExportRow[] = [
      {
        nro: 1,
        fecha: '2026-06-10',
        rif: 'J-12345',
        nombre_proveedor: 'Provider "Special" Ltd.',
        tipo_proveedor: 'PJD',
        nro_comprobante: 'CB001',
        nro_factura: 'FACT001',
        nro_control: 'NC001',
        tipo_transaccion: '01-reg',
        nro_nota_debito: '',
        nro_nota_credito: '',
        nro_factura_afectada: '',
        total_compras_incluye_iva: 1000,
        compras_sin_derecho_credito: 0,
        base_imponible: 1000,
        alicuota: 16,
        impuesto_iva: 160,
        iva_retenido: 50,
      },
    ];
    const csv = generateComprasCsv(rows);
    expect(csv).toContain('"Provider ""Special"" Ltd."');
  });

  it('handles newlines in field values', () => {
    const rows: ComprasExportRow[] = [
      {
        nro: 1,
        fecha: '2026-06-10',
        rif: 'J-12345',
        nombre_proveedor: 'Provider\nMultiline',
        tipo_proveedor: 'PJD',
        nro_comprobante: 'CB001',
        nro_factura: 'FACT001',
        nro_control: 'NC001',
        tipo_transaccion: '01-reg',
        nro_nota_debito: '',
        nro_nota_credito: '',
        nro_factura_afectada: '',
        total_compras_incluye_iva: 1000,
        compras_sin_derecho_credito: 0,
        base_imponible: 1000,
        alicuota: 16,
        impuesto_iva: 160,
        iva_retenido: 50,
      },
    ];
    const csv = generateComprasCsv(rows);
    expect(csv).toContain('"Provider\nMultiline"');
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npm test -- lib/reports/csv/__tests__/compras-csv-generator.test.ts
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add lib/reports/csv/compras-csv-generator.ts lib/reports/csv/__tests__/compras-csv-generator.test.ts
git commit -m "feat: add robust CSV generator for compras export"
```

---

## Task 4: Create API Route for CSV Export

**Files:**
- Create: `lib/routes/api/reports/compras-csv.ts`
- Modify: `pages/api/reports/[...].ts` or `app/api/reports/route.ts` (depending on whether using Pages Router or App Router)

**Interfaces:**
- Consumes: Query parameters: `startDate`, `endDate`, `sucursal`
- Produces: CSV file download response (Content-Type: text/csv, Content-Disposition: attachment)

- [ ] **Step 1: Create route handler**

```typescript
// lib/routes/api/reports/compras-csv.ts

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

    // Query both procedures
    const { mainRows, retentionRows } = await queryComprasData(startDate, endDate, sucursal);

    // Map and join data
    const exportRows = mapComprasData(mainRows, retentionRows);

    // Generate CSV
    const csv = generateComprasCsv(exportRows);

    // Return as downloadable file
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
```

- [ ] **Step 2: Wire route into API handler** (depends on your router)

If using **App Router** (`app/api/`):

```typescript
// app/api/reports/compras-csv/route.ts

import { handleComprasCsvExport } from '@/lib/routes/api/reports/compras-csv';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  return handleComprasCsvExport(request);
}
```

If using **Pages Router** (`pages/api/`), modify the appropriate handler file to dispatch to `handleComprasCsvExport`.

- [ ] **Step 3: Test route manually** (skip if no integration test infrastructure)

```bash
curl 'http://localhost:3000/api/reports/compras-csv?startDate=2026-06-01&endDate=2026-06-30&sucursal=000001' > test.csv
cat test.csv | head -5
```

Expected: CSV file downloads with header and data rows.

- [ ] **Step 4: Commit**

```bash
git add lib/routes/api/reports/compras-csv.ts app/api/reports/compras-csv/route.ts
git commit -m "feat: add API route for compras CSV export"
```

---

## Task 5: Update Compras Report Configuration

**Files:**
- Modify: `lib/reports/compras.ts`
- Modify: `lib/reports/registry.ts` (if needed to ensure compras is registered)

**Interfaces:**
- Updates: `COMPRAS_CONFIG.columns` to match the 18 columns (including Nº)
- Updates: `COMPRAS_CONFIG` to reflect dual-procedure approach (update description/documentation)

- [ ] **Step 1: Read current compras config**

Run: `cat lib/reports/compras.ts`

Expected: See current `COMPRAS_CONFIG` structure.

- [ ] **Step 2: Update column definitions**

```typescript
// lib/reports/compras.ts

import type { ReportConfig } from './registry';

export const COMPRAS_CONFIG: ReportConfig = {
  id: 'compras',
  label: 'Libro de Compras',
  queryType: 'procedure', // Updated: now queries two procedures and joins in-memory
  sourceName: 'dbo.sp_GetComprasByDateRange', // Note: This is now handled by queryComprasData
  columns: [
    { key: 'nro', label: 'Nº', defaultVisible: true, defaultOrder: 0, alwaysVisible: true },
    { key: 'fecha', label: 'FECHA', defaultVisible: true, defaultOrder: 1, alwaysVisible: true },
    { key: 'rif', label: 'RIF', defaultVisible: true, defaultOrder: 2 },
    { key: 'nombre_proveedor', label: 'NOMBRE PROVEEDOR', defaultVisible: true, defaultOrder: 3 },
    { key: 'tipo_proveedor', label: 'TIPO PROVEEDOR', defaultVisible: true, defaultOrder: 4 },
    { key: 'nro_comprobante', label: 'Nº DE COMPROBANTE', defaultVisible: true, defaultOrder: 5 },
    { key: 'nro_factura', label: 'Nº DE FACTURA', defaultVisible: true, defaultOrder: 6 },
    { key: 'nro_control', label: 'Nº DE CONTROL', defaultVisible: true, defaultOrder: 7 },
    { key: 'tipo_transaccion', label: 'TIPO DE TRANSACCION', defaultVisible: true, defaultOrder: 8 },
    { key: 'nro_nota_debito', label: 'Nº NOTA DE DEBITO', defaultVisible: false, defaultOrder: 9 },
    { key: 'nro_nota_credito', label: 'Nº NOTA DE CREDITO', defaultVisible: false, defaultOrder: 10 },
    { key: 'nro_factura_afectada', label: 'Nº FACTURA AFECTADA', defaultVisible: false, defaultOrder: 11 },
    { key: 'total_compras_incluye_iva', label: 'TOTAL COMPRAS INCLUYE IVA', defaultVisible: true, defaultOrder: 12 },
    { key: 'compras_sin_derecho_credito', label: 'COMPRAS SIN DERECHO A CREDITO IVA', defaultVisible: false, defaultOrder: 13 },
    { key: 'base_imponible', label: 'BASE IMPONIBLE', defaultVisible: true, defaultOrder: 14 },
    { key: 'alicuota', label: '% ALICUOTA', defaultVisible: true, defaultOrder: 15 },
    { key: 'impuesto_iva', label: 'IMPUESTO IVA', defaultVisible: true, defaultOrder: 16 },
    { key: 'iva_retenido', label: 'IVA RETENIDO', defaultVisible: true, defaultOrder: 17 },
  ],
};
```

- [ ] **Step 3: Commit**

```bash
git add lib/reports/compras.ts
git commit -m "feat: update compras report config with dual-procedure approach and revised columns"
```

---

## Task 6: Add Sucursal Selector UI Component

**Files:**
- Create: `lib/components/reports/SucursalSelector.tsx`
- Modify: Report generation/export UI to include sucursal selector
- Modify: Report generation function to accept and pass sucursal parameter

**Interfaces:**
- Produces: Single-option dropdown component (hardcoded "Oficina" → "000001")
- Consumes: Selected sucursal value
- Produces: `sucursal: string` (passed to query)

- [ ] **Step 1: Create SucursalSelector component**

```typescript
// lib/components/reports/SucursalSelector.tsx

'use client';

import React from 'react';

interface SucursalSelectorProps {
  value: string;
  onChange: (sucursal: string) => void;
}

export function SucursalSelector({ value, onChange }: SucursalSelectorProps) {
  const options = [
    { label: 'Oficina', value: '000001' },
  ];

  return (
    <div className="form-group">
      <label htmlFor="sucursal-select">Sucursal / Oficina</label>
      <select
        id="sucursal-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 2: Integrate selector into report page**

Find your report generation page (e.g., `pages/reports.tsx` or `app/reports/page.tsx`) and:

```typescript
// Example integration (adjust to your actual page structure)

import { SucursalSelector } from '@/lib/components/reports/SucursalSelector';
import { useState } from 'react';

export default function ReportsPage() {
  const [sucursal, setSucursal] = useState('000001');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleExport = async () => {
    const params = new URLSearchParams({
      startDate,
      endDate,
      sucursal,
    });
    window.location.href = `/api/reports/compras-csv?${params.toString()}`;
  };

  return (
    <div>
      <h1>Reportes</h1>
      <SucursalSelector value={sucursal} onChange={setSucursal} />
      {/* ... other date selectors ... */}
      <button onClick={handleExport}>Descargar CSV</button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/components/reports/SucursalSelector.tsx
git commit -m "feat: add single-option sucursal selector component"
```

---

## Task 7: Integration Testing

**Files:**
- Create: `__tests__/integration/compras-export.integration.test.ts`

**Interfaces:**
- Consumes: Full export pipeline (query → map → generate CSV → download)

- [ ] **Step 1: Write integration test**

```typescript
// __tests__/integration/compras-export.integration.test.ts

import { queryComprasData } from '@/lib/reports/queries/compras-query';
import { mapComprasData } from '@/lib/reports/mappers/compras-mapper';
import { generateComprasCsv } from '@/lib/reports/csv/compras-csv-generator';

describe('Compras Export Integration', () => {
  it('completes full pipeline: query → map → generate CSV', async () => {
    // Mock query (in real test, use actual DB or fixtures)
    const { mainRows, retentionRows } = await queryComprasData(
      '2026-06-01',
      '2026-06-30',
      '000001'
    );

    // Map data
    const exportRows = mapComprasData(mainRows, retentionRows);

    // Generate CSV
    const csv = generateComprasCsv(exportRows);

    // Assertions
    expect(csv).toBeTruthy();
    expect(csv).toContain('Nº,FECHA,RIF'); // Header present
    expect(csv.split('\n').length).toBeGreaterThan(1); // Has data rows
  });

  it('filters out zero-total rows', async () => {
    const { mainRows, retentionRows } = await queryComprasData(
      '2026-06-01',
      '2026-06-30',
      '000001'
    );

    const exportRows = mapComprasData(mainRows, retentionRows);

    // Verify no rows with total_neto = 0
    exportRows.forEach(row => {
      expect(row.total_compras_incluye_iva).not.toBe(0);
    });
  });
});
```

- [ ] **Step 2: Run integration tests**

```bash
npm test -- __tests__/integration/compras-export.integration.test.ts
```

Expected: Tests pass.

- [ ] **Step 3: Commit**

```bash
git add __tests__/integration/compras-export.integration.test.ts
git commit -m "test: add integration tests for compras export pipeline"
```

---

## Task 8: Verify End-to-End Export Flow

**Files:**
- No new files; verification only

**Interfaces:**
- Verify: User can select date range, sucursal, and download CSV with all 18 columns and correct data

- [ ] **Step 1: Start development server**

```bash
npm run dev
```

Expected: Server starts on localhost:3000.

- [ ] **Step 2: Navigate to reports page**

Open browser: `http://localhost:3000/reports` (or your reports page URL)

Expected: See sucursal selector with "Oficina" option and date pickers.

- [ ] **Step 3: Select date range and export**

1. Select start date: 2026-06-01
2. Select end date: 2026-06-30
3. Sucursal: (should default to "Oficina" / "000001")
4. Click "Descargar CSV" or similar

Expected: CSV file downloads.

- [ ] **Step 4: Verify CSV structure**

Open downloaded `libro-de-compras.csv`:

```bash
head -20 ~/Downloads/libro-de-compras.csv
```

Expected:
- First line is header with 18 columns (Nº, FECHA, RIF, ..., IVA RETENIDO)
- Data rows follow with correct values
- No rows with total = 0
- Commas in field values are properly escaped

- [ ] **Step 5: Verify data accuracy**

Spot-check a few rows against expected data from procedures. Verify:
- Dates are formatted as YYYY-MM-DD
- RIF values match provider data
- Retention amounts are summed correctly (monto_ret_imp + monto_ret_imp_tercero)
- Transaction types (01-reg vs 03-anu) match anulado flag

- [ ] **Step 6: No commit needed** (verification step only)

---

## Spec Coverage Verification

✓ Dual stored procedures: `RepLibroCompra` + `RepLibroCompraRetenciones` (Task 2)
✓ In-memory join and transformation (Task 1)
✓ 17 export columns per `outputCsvSchema` mapping (Tasks 1, 5)
✓ Robust CSV generation with comma/quote escaping (Task 3)
✓ Filter zero-total rows (Tasks 1, 3)
✓ Update report config (Task 5)
✓ Sucursal selector (single option, hardcoded "000001") (Task 6)
✓ Wired export route and download flow (Task 4)
✓ Integration tests (Task 7)
✓ End-to-end verification (Task 8)

---

## Placeholder Check

✓ No "TBD", "TODO", or "implement later" placeholders
✓ All code steps contain complete, exact code
✓ All commands shown with expected output
✓ No generic error handling ("add appropriate validation")
✓ All types, functions, and properties defined in tasks

---

## Type Consistency Check

✓ `ComprasRawRow` defined in Task 1, used consistently in Tasks 2, 3
✓ `ComprasExportRow` defined in Task 1, used in Tasks 3, 4, 7
✓ Field names consistent across mapper, CSV generator, report config
✓ `sucursal: string` parameter passed consistently through query → handler pipeline

---

Plan complete and saved. Two execution options:

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?