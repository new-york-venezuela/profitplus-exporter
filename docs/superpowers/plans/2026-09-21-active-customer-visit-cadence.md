# Active Customer Visit Cadence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new "Cadencia" analytics tab showing, per active customer (legal entity), how often they're actually buying — days since last purchase, average inter-purchase gap — sorted so the quietest customers surface first, with an optional manual per-customer/segment target (stored in SQLite) that flags overdue customers when set.

**Architecture:** One new DWH-reading API route (`app/api/dwh/cadencia/route.ts`) computing purchase-gap statistics from `Fact_Sales`/`Dim_LegalEntity`/`Dim_Date` (no new DWH migration needed), one new SQLite table (`visit_cadence_targets`) via a Drizzle migration for manual targets, a small CRUD API route for target management, and a new tab registered in `analitica-client.tsx`.

**Tech Stack:** Next.js 16 App Router, TypeScript, `mssql` against `DWH_AlimentosNY`, Drizzle ORM against the app's own SQLite (`bun:sqlite`), Bun test, Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-09-21-active-customer-visit-cadence-design.md`

## Global Constraints

- Primary view leads with plain purchase-frequency data (days since last sale, average gap) — a target is optional and never required to see a customer's cadence (per user: "more important that we show how many sales per week/month than comparing it against a target").
- No statistical inference of cadence as a default target — targets are manual-only per the spec's explicit scope decision.
- Target precedence: entity-specific override → segment-level default → no target (shown plainly, no overdue flag).
- `DaysSinceLastPurchase` is always computed against the current date (`GETDATE()`), not relative to the selected date range's end — this is "how overdue right now," an operational view, not a historical report metric.
- SQLite writes use Drizzle, follow the existing `inventory_settings`/`inventory_warehouses` migration and CRUD conventions.
- DWH route tests only assert the auth gate; SQLite CRUD route tests can assert both auth and basic behavior, following `app/api/admin/inventory-settings` conventions (that route has no dedicated test file today — checked; this plan adds one for the new route since it's new functionality, not a modification).
- New e2e tests go in `e2e/cadencia.spec.ts`; the DWH-reading parts are `@mssql`-tagged, the SQLite target-CRUD parts are not (they don't touch the ERP mock, matching how `e2e/config-cobranza.spec.ts` — a pure SQLite settings test — has no `@mssql` tag).

---

## File Structure

- **Modify:** `lib/db/schema.ts` — add `visitCadenceTargets` table.
- **Create:** `drizzle/migrations/000N_<generated-name>.sql` — via `bun run db:generate`.
- **Create:** `app/api/dwh/cadencia/route.ts` — purchase-gap query, joined with resolved targets.
- **Create:** `app/api/dwh/cadencia/__tests__/route.test.ts`
- **Create:** `app/api/dwh/cadencia/target-resolution.ts` — pure precedence-resolution function.
- **Create:** `app/api/dwh/cadencia/__tests__/target-resolution.test.ts`
- **Create:** `app/api/cadencia-targets/route.ts` — CRUD for `visitCadenceTargets`.
- **Create:** `app/api/cadencia-targets/__tests__/route.test.ts`
- **Modify:** `app/(app)/analitica/types.ts` — add `CadenceRow`, `CadenceResponse`.
- **Create:** `app/(app)/analitica/tabs/tab-cadencia.tsx`.
- **Modify:** `app/(app)/analitica/analitica-client.tsx` — register the new tab.
- **Create:** `e2e/cadencia.spec.ts`.

---

### Task 1: SQLite schema and migration for manual targets

**Files:**
- Modify: `lib/db/schema.ts`
- Create: `drizzle/migrations/000N_<generated>.sql` (auto-generated, filename determined by `db:generate`)

**Interfaces:**
- Produces: `visitCadenceTargets` Drizzle table, `VisitCadenceTarget`/`NewVisitCadenceTarget` types — consumed by Task 4 (target CRUD route) and Task 2 (cadencia route, to resolve targets).

- [ ] **Step 1: Add the table to `lib/db/schema.ts`**

Append to the end of `lib/db/schema.ts`:

```typescript
// ── Visit cadence targets ───────────────────────────────────────────
// Manual per-customer/segment expected purchase-gap targets, used by the
// Cadencia tab to flag overdue customers. No cadence/frequency concept
// exists anywhere in Profit Plus (confirmed during spec design), so this
// is entered manually — see docs/superpowers/specs/
// 2026-09-21-active-customer-visit-cadence-design.md. A row with
// legalEntityKey set overrides any segment-level default for that entity; a
// row with legalEntityKey NULL and segmentCode set is a fallback for every
// entity in that segment without its own override.

export const visitCadenceTargets = sqliteTable('visit_cadence_targets', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  legalEntityKey: integer('legal_entity_key'),                             // null = segment-level default
  segmentCode:    text('segment_code', { enum: ['CADENA', 'INDEPENDIENTES'] }),
  targetGapDays:  integer('target_gap_days').notNull(),
});

export type VisitCadenceTarget    = typeof visitCadenceTargets.$inferSelect;
export type NewVisitCadenceTarget = typeof visitCadenceTargets.$inferInsert;
```

- [ ] **Step 2: Generate the migration**

Run: `bun run db:generate`
Expected: a new file appears under `drizzle/migrations/`, e.g. `0003_<generated-name>.sql`, containing a `CREATE TABLE visit_cadence_targets (...)` statement. Read the generated file to confirm it matches the schema (integer id autoincrement, nullable `legal_entity_key`, nullable `segment_code`, not-null `target_gap_days`).

- [ ] **Step 3: Apply the migration locally**

Run: `bun run migrate`
Expected: succeeds with no errors; `data/exporter.db` now has the `visit_cadence_targets` table.

- [ ] **Step 4: Verify the table exists**

Run: `sqlite3 data/exporter.db ".schema visit_cadence_targets"` (or equivalent — if `sqlite3` CLI isn't available, use `bun run db:studio` briefly to visually confirm, then close it)
Expected: shows the table with the four expected columns.

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema.ts drizzle/migrations/
git commit -m "feat: add visit_cadence_targets table"
```

---

### Task 2: Target precedence resolution pure function

**Files:**
- Create: `app/api/dwh/cadencia/target-resolution.ts`
- Test: `app/api/dwh/cadencia/__tests__/target-resolution.test.ts`

**Interfaces:**
- Produces: `resolveTarget(legalEntityKey: number, segment: 'CADENA' | 'INDEPENDIENTES' | null, entityOverrides: Map<number, number>, segmentDefaults: Map<string, number>): number | null` — consumed by Task 3 (cadencia route).

- [ ] **Step 1: Write the failing tests**

```typescript
// app/api/dwh/cadencia/__tests__/target-resolution.test.ts
import { describe, test, expect } from 'bun:test';
import { resolveTarget } from '../target-resolution';

describe('resolveTarget', () => {
  test('entity-specific override takes precedence over segment default', () => {
    const entityOverrides = new Map([[1, 7]]);
    const segmentDefaults = new Map([['CADENA', 14]]);
    expect(resolveTarget(1, 'CADENA', entityOverrides, segmentDefaults)).toBe(7);
  });

  test('falls back to segment default when no entity override exists', () => {
    const entityOverrides = new Map<number, number>();
    const segmentDefaults = new Map([['CADENA', 14]]);
    expect(resolveTarget(1, 'CADENA', entityOverrides, segmentDefaults)).toBe(14);
  });

  test('returns null when neither an override nor a segment default exists', () => {
    const entityOverrides = new Map<number, number>();
    const segmentDefaults = new Map<string, number>();
    expect(resolveTarget(1, 'CADENA', entityOverrides, segmentDefaults)).toBeNull();
  });

  test('returns null when segment is null and no entity override exists', () => {
    const entityOverrides = new Map<number, number>();
    const segmentDefaults = new Map([['CADENA', 14]]);
    expect(resolveTarget(1, null, entityOverrides, segmentDefaults)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test --isolate --env-file=.env.local app/api/dwh/cadencia/__tests__/target-resolution.test.ts`
Expected: FAIL with "Cannot find module '../target-resolution'"

- [ ] **Step 3: Write the implementation**

```typescript
// app/api/dwh/cadencia/target-resolution.ts
export function resolveTarget(
  legalEntityKey: number,
  segment: 'CADENA' | 'INDEPENDIENTES' | null,
  entityOverrides: Map<number, number>,
  segmentDefaults: Map<string, number>,
): number | null {
  const override = entityOverrides.get(legalEntityKey);
  if (override !== undefined) return override;
  if (segment === null) return null;
  return segmentDefaults.get(segment) ?? null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test --isolate --env-file=.env.local app/api/dwh/cadencia/__tests__/target-resolution.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/dwh/cadencia/target-resolution.ts app/api/dwh/cadencia/__tests__/target-resolution.test.ts
git commit -m "feat: add visit cadence target precedence resolution function"
```

---

### Task 3: Types for the Cadencia tab

**Files:**
- Modify: `app/(app)/analitica/types.ts`

**Interfaces:**
- Produces: `CadenceRow`, `CadenceResponse` — consumed by Task 4 (route) and Task 6 (tab).

- [ ] **Step 1: Append the new types**

```typescript
// Cadencia tab — per-customer purchase frequency, with an optional manual
// target overlay. See docs/superpowers/specs/
// 2026-09-21-active-customer-visit-cadence-design.md.
export interface CadenceRow {
  legalEntityKey: number;
  legalEntityName: string;
  purchaseDayCount: number;
  avgGapDays: number | null;      // null if only one purchase in range (no gap to compute)
  lastPurchaseDate: string;       // ISO date
  daysSinceLastPurchase: number;
  segment: CustomerSegment | null;
  targetGapDays: number | null;    // resolved: entity override, else segment default, else null
  isOverdue: boolean | null;       // null when no target resolves for this entity
}

export interface CadenceResponse {
  rows: CadenceRow[];
}
```

Note: this depends on `CustomerSegment` already existing in `types.ts` — added by the Depth of Line plan (`docs/superpowers/plans/2026-09-21-profundidad-linea-tab.md`, Task 2). If that plan has not been implemented yet, add this minimal type alongside it instead: `export type CustomerSegment = 'CADENA' | 'INDEPENDIENTES';` — but check first with `grep -n "CustomerSegment" app/\(app\)/analitica/types.ts` to avoid a duplicate declaration.

- [ ] **Step 2: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors (pure type addition)

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/analitica/types.ts
git commit -m "feat: add Cadencia tab types"
```

---

### Task 4: Target CRUD API route

**Files:**
- Create: `app/api/cadencia-targets/route.ts`
- Test: `app/api/cadencia-targets/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `visitCadenceTargets` from `@/lib/db/schema` (Task 1); `getDb` from `@/lib/db/sqlite`; `getSessionFromRequest` from `@/lib/inventory/access`; `hasDwhAccess` from `@/lib/dwh/access`.
- Produces: `GET`/`POST`/`DELETE` handlers at `/api/cadencia-targets` — consumed by Task 6 (tab).

- [ ] **Step 1: Write the failing tests**

```typescript
// app/api/cadencia-targets/__tests__/route.test.ts
import { describe, test, expect } from 'bun:test';
import { GET, POST, DELETE } from '../route';
import { NextRequest } from 'next/server';

describe('/api/cadencia-targets', () => {
  test('GET rejects unauthenticated requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/cadencia-targets');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  test('POST rejects unauthenticated requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/cadencia-targets', {
      method: 'POST',
      body: JSON.stringify({ segmentCode: 'CADENA', targetGapDays: 7 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  test('DELETE rejects unauthenticated requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/cadencia-targets?id=1', { method: 'DELETE' });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test --isolate --env-file=.env.local app/api/cadencia-targets/__tests__/route.test.ts`
Expected: FAIL with "Cannot find module '../route'"

- [ ] **Step 3: Write the route**

This is gated by `hasDwhAccess` (dwh-access is enough per the spec's recommendation — this is an operational sales tool, not an admin/security setting, unlike `admin/*` routes):

```typescript
// app/api/cadencia-targets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { hasDwhAccess } from '@/lib/dwh/access';
import { getDb } from '@/lib/db/sqlite';
import { visitCadenceTargets } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

async function requireDwhAccessForRequest(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return { error: 'No autorizado', status: 401 } as const;
  const db = getDb();
  const allowed = await hasDwhAccess(db, session.sub, session.role);
  if (!allowed) return { error: 'Prohibido', status: 403 } as const;
  return { session };
}

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccessForRequest(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = getDb();
  const rows = db.select().from(visitCadenceTargets).all();
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireDwhAccessForRequest(request);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || typeof body.targetGapDays !== 'number' || body.targetGapDays <= 0) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const hasEntityKey = 'legalEntityKey' in body && typeof body.legalEntityKey === 'number';
    const hasSegment = 'segmentCode' in body && (body.segmentCode === 'CADENA' || body.segmentCode === 'INDEPENDIENTES');
    if (!hasEntityKey && !hasSegment) {
      return NextResponse.json({ error: 'Debe especificar legalEntityKey o segmentCode' }, { status: 400 });
    }
    if (hasEntityKey && hasSegment) {
      return NextResponse.json({ error: 'Especifique solo uno: legalEntityKey o segmentCode' }, { status: 400 });
    }

    const db = getDb();

    // Upsert semantics: one target row per (legalEntityKey) or per (segmentCode
    // with null legalEntityKey) — delete any existing row for the same key
    // before inserting, since there's no natural unique constraint spanning
    // two nullable columns in SQLite that cleanly expresses this.
    if (hasEntityKey) {
      db.delete(visitCadenceTargets).where(eq(visitCadenceTargets.legalEntityKey, body.legalEntityKey)).run();
      const result = db.insert(visitCadenceTargets).values({
        legalEntityKey: body.legalEntityKey,
        segmentCode: null,
        targetGapDays: body.targetGapDays,
      }).returning({ id: visitCadenceTargets.id }).get();
      return NextResponse.json({ id: result?.id }, { status: 201 });
    }

    db.delete(visitCadenceTargets).where(eq(visitCadenceTargets.segmentCode, body.segmentCode)).run();
    const result = db.insert(visitCadenceTargets).values({
      legalEntityKey: null,
      segmentCode: body.segmentCode,
      targetGapDays: body.targetGapDays,
    }).returning({ id: visitCadenceTargets.id }).get();
    return NextResponse.json({ id: result?.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireDwhAccessForRequest(request);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');
    if (!idParam || !/^\d+$/.test(idParam)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const db = getDb();
    db.delete(visitCadenceTargets).where(eq(visitCadenceTargets.id, Number(idParam))).run();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test --isolate --env-file=.env.local app/api/cadencia-targets/__tests__/route.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/cadencia-targets/route.ts app/api/cadencia-targets/__tests__/route.test.ts
git commit -m "feat: add visit cadence target CRUD API route"
```

---

### Task 5: Cadencia DWH route (purchase frequency + resolved targets)

**Files:**
- Create: `app/api/dwh/cadencia/route.ts`
- Test: `app/api/dwh/cadencia/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `resolveTarget` from `./target-resolution` (Task 2); `requireDwhAccess` from `@/lib/dwh/access`; `getDwhPool` from `@/lib/db/dwh-mssql`; `buildDateWhereClause`, `jsonWithCache` from `@/app/api/dwh/lib/query-builder`; `getDb`, `visitCadenceTargets` from `@/lib/db/sqlite`/`@/lib/db/schema`; `CadenceRow`, `CadenceResponse`, `CustomerSegment` from `@/app/(app)/analitica/types` (Task 3).
- Produces: `GET` handler at `/api/dwh/cadencia` — consumed by Task 6 (tab).

- [ ] **Step 1: Write the failing auth-gate test**

```typescript
// app/api/dwh/cadencia/__tests__/route.test.ts
import { describe, test, expect } from 'bun:test';
import { GET } from '../route';
import { NextRequest } from 'next/server';

describe('GET /api/dwh/cadencia', () => {
  test('rejects unauthenticated requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/dwh/cadencia');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test --isolate --env-file=.env.local app/api/dwh/cadencia/__tests__/route.test.ts`
Expected: FAIL with "Cannot find module '../route'"

- [ ] **Step 3: Write the route**

```typescript
// app/api/dwh/cadencia/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { buildDateWhereClause, jsonWithCache } from '@/app/api/dwh/lib/query-builder';
import { getDb } from '@/lib/db/sqlite';
import { visitCadenceTargets } from '@/lib/db/schema';
import { resolveTarget } from './target-resolution';
import type { CadenceRow, CadenceResponse, CustomerSegment } from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// Reads from the pre-aggregated dwh/dim/fact schema in DWH_AlimentosNY (see
// dwh-migrations/) for purchase frequency, and the app's own SQLite for
// manually-set targets (visit_cadence_targets). See docs/superpowers/specs/
// 2026-09-21-active-customer-visit-cadence-design.md.
//
// DaysSinceLastPurchase is computed against GETDATE() regardless of the
// selected date range's end — intentionally always "how overdue right now,"
// not relative to a historical report window.

function cadenceQuery(dateWhere: string): string {
  return `
    ;WITH PurchaseDays AS (
      SELECT DISTINCT le.LegalEntityKey, le.LegalEntityName, c.SegmentCode, d.FullDate
      FROM fact.Fact_Sales fs
      JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
      JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
      JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
      WHERE fs.IsVoided = 0 ${dateWhere}
    ),
    Gaps AS (
      SELECT
        LegalEntityKey,
        FullDate,
        DATEDIFF(day, LAG(FullDate) OVER (PARTITION BY LegalEntityKey ORDER BY FullDate), FullDate) AS GapDays
      FROM PurchaseDays
    )
    SELECT
      le.LegalEntityKey,
      le.LegalEntityName,
      MAX(pd.SegmentCode) AS SegmentCode,
      COUNT(DISTINCT pd.FullDate) AS PurchaseDayCount,
      AVG(CAST(g.GapDays AS float)) AS AvgGapDays,
      MAX(pd.FullDate) AS LastPurchaseDate,
      DATEDIFF(day, MAX(pd.FullDate), GETDATE()) AS DaysSinceLastPurchase
    FROM dim.Dim_LegalEntity le
    JOIN PurchaseDays pd ON pd.LegalEntityKey = le.LegalEntityKey
    LEFT JOIN Gaps g ON g.LegalEntityKey = le.LegalEntityKey AND g.GapDays IS NOT NULL
    GROUP BY le.LegalEntityKey, le.LegalEntityName
    ORDER BY DaysSinceLastPurchase DESC
  `;
}

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const dateRange = searchParams.get('dateRange') ?? '12m';
  const dateWhere = buildDateWhereClause(dateRange, 'fs');

  try {
    const pool = await getDwhPool();
    const result = await pool.request().query(cadenceQuery(dateWhere));

    const db = getDb();
    const targetRows = db.select().from(visitCadenceTargets).all();
    const entityOverrides = new Map<number, number>();
    const segmentDefaults = new Map<string, number>();
    for (const t of targetRows) {
      if (t.legalEntityKey !== null) entityOverrides.set(t.legalEntityKey, t.targetGapDays);
      else if (t.segmentCode !== null) segmentDefaults.set(t.segmentCode, t.targetGapDays);
    }

    const rows: CadenceRow[] = result.recordset.map(r => {
      const legalEntityKey = Number(r.LegalEntityKey);
      const segmentRaw = r.SegmentCode === null ? null : String(r.SegmentCode);
      const segment: CustomerSegment | null = segmentRaw === 'CADENA' || segmentRaw === 'INDEPENDIENTES' ? segmentRaw : null;
      const targetGapDays = resolveTarget(legalEntityKey, segment, entityOverrides, segmentDefaults);
      const daysSinceLastPurchase = Number(r.DaysSinceLastPurchase);

      return {
        legalEntityKey,
        legalEntityName: String(r.LegalEntityName),
        purchaseDayCount: Number(r.PurchaseDayCount),
        avgGapDays: r.AvgGapDays === null ? null : Number(r.AvgGapDays),
        lastPurchaseDate: new Date(r.LastPurchaseDate).toISOString().slice(0, 10),
        daysSinceLastPurchase,
        segment,
        targetGapDays,
        isOverdue: targetGapDays === null ? null : daysSinceLastPurchase > targetGapDays,
      };
    });

    const response: CadenceResponse = { rows };
    return jsonWithCache(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test --isolate --env-file=.env.local app/api/dwh/cadencia/__tests__/route.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add app/api/dwh/cadencia/route.ts app/api/dwh/cadencia/__tests__/route.test.ts
git commit -m "feat: add cadencia purchase-frequency API route"
```

---

### Task 6: Cadencia tab UI

**Files:**
- Create: `app/(app)/analitica/tabs/tab-cadencia.tsx`
- Modify: `app/(app)/analitica/analitica-client.tsx`

**Interfaces:**
- Consumes: `CadenceResponse`, `CadenceRow`, `CustomerSegment` from `@/app/(app)/analitica/types` (Task 3); `TabComponentProps` shape `{dateRange, currency}` from `analitica-client.tsx` (existing).
- Produces: default export `TabCadencia` — consumed by the modification to `analitica-client.tsx`.

- [ ] **Step 1: Build the tab component**

```typescript
// app/(app)/analitica/tabs/tab-cadencia.tsx
'use client';

import { useEffect, useState } from 'react';
import type { CadenceResponse, CadenceRow, CustomerSegment, Currency, DateRange } from '../types';

function EmptyState() {
  return (
    <div className="h-40 flex items-center justify-center text-sm text-gray-400 text-center px-4">
      Sin datos disponibles todavía.
    </div>
  );
}

const SEGMENT_OPTIONS: { value: CustomerSegment | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'CADENA', label: 'Cadena' },
  { value: 'INDEPENDIENTES', label: 'Independientes' },
];

export default function TabCadencia({ dateRange }: { dateRange: DateRange; currency: Currency }) {
  const [data, setData] = useState<CadenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [segmentFilter, setSegmentFilter] = useState<CustomerSegment | 'todos'>('todos');
  const [editingKey, setEditingKey] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/dwh/cadencia?dateRange=${dateRange}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Error desconocido');
        return;
      }
      setData(await res.json());
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  async function saveTarget(row: CadenceRow) {
    const days = Number(editValue);
    if (!Number.isFinite(days) || days <= 0) return;
    setSaving(true);
    try {
      await fetch('/api/cadencia-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ legalEntityKey: row.legalEntityKey, targetGapDays: days }),
      });
      setEditingKey(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">Cargando…</div>;
  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p>
      </div>
    );
  }
  if (!data) return <div className="p-6"><EmptyState /></div>;

  const rows = data.rows.filter(r => segmentFilter === 'todos' || r.segment === segmentFilter);

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Cadencia de compra</h2>
            <p className="text-xs text-gray-500">
              Frecuencia de compra por cliente — ventas como proxy de visitas
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            Segmento:
            <select
              value={segmentFilter}
              onChange={e => setSegmentFilter(e.target.value as CustomerSegment | 'todos')}
              className="border border-gray-200 rounded px-2 py-1 text-sm"
            >
              {SEGMENT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        </div>

        {rows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Cliente</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Días desde última compra</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Brecha promedio (días)</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Días con compra</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Meta (días)</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, i) => (
                  <tr key={row.legalEntityKey} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                    <td className="px-3 py-2 text-gray-800">{row.legalEntityName}</td>
                    <td className="px-3 py-2 text-right text-gray-900 font-medium">{row.daysSinceLastPurchase}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{row.avgGapDays === null ? '—' : row.avgGapDays.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{row.purchaseDayCount}</td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {editingKey === row.legalEntityKey ? (
                        <span className="inline-flex items-center gap-1">
                          <input
                            type="number" min={1} value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            className="border border-gray-200 rounded px-1 py-0.5 w-14 text-right"
                          />
                          <button disabled={saving} onClick={() => saveTarget(row)} className="text-blue-600 hover:text-blue-800 text-xs">
                            Guardar
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => { setEditingKey(row.legalEntityKey); setEditValue(String(row.targetGapDays ?? '')); }}
                          className="hover:text-blue-600 underline"
                        >
                          {row.targetGapDays === null ? 'Definir' : row.targetGapDays}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.isOverdue === null ? (
                        <span className="text-gray-400 text-xs">Sin meta</span>
                      ) : row.isOverdue ? (
                        <span className="inline-block px-2 py-0.5 rounded text-xs bg-red-100 text-red-800">Atrasado</span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">Al día</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Register the tab in `analitica-client.tsx`**

```typescript
// add near the other tab imports
import TabCadencia from './tabs/tab-cadencia';
```

```typescript
// in TABS, insert after 'clientes' (or after 'profundidad' if that plan is
// already implemented — either position is fine, this tab is independent)
{ key: 'cadencia', label: 'Cadencia', component: TabCadencia },
```

- [ ] **Step 3: Typecheck and lint**

Run: `bunx tsc --noEmit && bun run lint`
Expected: no errors

- [ ] **Step 4: Manual smoke test**

Run `bun --bun run dev`, navigate to `/analitica?tab=cadencia`, confirm the table renders sorted by days-since-last-purchase descending, the segment filter works, and clicking "Definir"/a target number lets you set and save a target that then shows an Atrasado/Al día badge.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/analitica/tabs/tab-cadencia.tsx app/\(app\)/analitica/analitica-client.tsx
git commit -m "feat: add Cadencia tab UI"
```

---

### Task 7: E2E coverage

**Files:**
- Create: `e2e/cadencia.spec.ts`

- [ ] **Step 1: Write the e2e spec**

```typescript
// e2e/cadencia.spec.ts
import { test, expect } from './fixtures';

// The DWH-reading parts of this tab require the profitplus-erp-mock
// container with DWH_AlimentosNY migrated/loaded (@mssql), same as every
// other analitica tab. The target-setting parts also write to the app's own
// SQLite (visit_cadence_targets) — not mssql-gated on their own, but these
// tests still need the tab to load real DWH rows first, so the whole file
// is tagged @mssql for simplicity, matching e2e/analitica.spec.ts's
// per-file (not per-test) tagging convention.

test.describe('cadencia @mssql', () => {
  test('tab renders customers sorted by days since last purchase', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=cadencia');

    await expect(adminPage.getByRole('heading', { name: 'Cadencia de compra' })).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });
  });

  test('segment filter narrows the list', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=cadencia');
    await expect(adminPage.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });

    const initialCount = await adminPage.locator('table tbody tr').count();
    await adminPage.getByLabel('Segmento:').selectOption('CADENA');
    await expect(adminPage.locator('table tbody tr')).not.toHaveCount(0);
    const cadenaCount = await adminPage.locator('table tbody tr').count();
    expect(cadenaCount).toBeLessThanOrEqual(initialCount);
  });

  test('setting a target shows an overdue/al-día badge', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=cadencia');
    await expect(adminPage.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });

    const firstRow = adminPage.locator('table tbody tr').first();
    const daysSinceLastPurchaseText = await firstRow.locator('td').nth(1).textContent();
    const daysSinceLastPurchase = Number(daysSinceLastPurchaseText);

    await firstRow.getByRole('button', { name: /Definir|^\d+$/ }).click();
    // Set a target well below the customer's actual days-since-last-purchase
    // so it's guaranteed to show as overdue, regardless of that customer's
    // real data in the live test DWH.
    const targetInput = firstRow.locator('input[type="number"]');
    await targetInput.fill('1');
    await firstRow.getByRole('button', { name: 'Guardar' }).click();

    if (daysSinceLastPurchase > 1) {
      await expect(firstRow.getByText('Atrasado')).toBeVisible({ timeout: 10_000 });
    } else {
      await expect(firstRow.getByText('Al día')).toBeVisible({ timeout: 10_000 });
    }
  });
});
```

- [ ] **Step 2: Run the e2e spec against the real DWH**

Run: `bun run e2e:mssql -- cadencia`
Expected: all 3 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/cadencia.spec.ts
git commit -m "test: add e2e coverage for Cadencia tab"
```

---

### Task 8: Full verification pass

- [ ] **Step 1: Run the full unit test suite**

Run: `bun run test:unit`
Expected: all tests PASS, including `target-resolution.test.ts`, `cadencia-targets/route.test.ts`, and `dwh/cadencia/route.test.ts`.

- [ ] **Step 2: Run lint**

Run: `bun run lint`
Expected: no errors.

- [ ] **Step 3: Run typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the full default e2e suite (non-mssql)**

Run: `bun run e2e`
Expected: all existing tests still PASS.

- [ ] **Step 5: Run the mssql e2e suite**

Run: `bun run e2e:mssql`
Expected: all tests PASS, including `cadencia.spec.ts`.

- [ ] **Step 6: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address verification findings for Cadencia tab"
```
