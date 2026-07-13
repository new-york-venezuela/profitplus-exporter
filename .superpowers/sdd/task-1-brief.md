# Task 1: Update Ventas Report Config

**Files:**
- Modify: `lib/reports/ventas.ts`

**Interfaces:**
- Consumes: Existing `ReportConfig` interface from `lib/reports/registry.ts`
- Produces: `VENTAS_CONFIG` with `queryType: 'procedure'`, 11 columns matching `sp_GetVentasByDateRange` schema

**Steps:**

- [ ] **Step 1: Review current ventas.ts and stored procedure schema**

Open `lib/reports/ventas.ts`. Current config uses view-based query with placeholder columns.

Open `docker/mssql/init.sql` lines 104-124. Procedure returns: `id, fecha, numero_comprobante, tipo_comprobante, ruc_cliente, nombre_cliente, monto_total, monto_impuesto, monto_neto, descripcion, created_at`.

- [ ] **Step 2: Update ventas.ts with procedure config and full column definitions**

Replace entire file content:

```typescript
import type { ReportConfig } from './registry';

export const VENTAS_CONFIG: ReportConfig = {
  id:         'ventas',
  label:      'Libro de Ventas',
  queryType:  'procedure',
  sourceName: 'dbo.sp_GetVentasByDateRange',
  columns: [
    { key: 'fecha',               label: 'Fecha',              defaultVisible: true,  defaultOrder: 0, alwaysVisible: true },
    { key: 'numero_comprobante',  label: 'Número Comprobante', defaultVisible: true,  defaultOrder: 1 },
    { key: 'tipo_comprobante',    label: 'Tipo Comprobante',   defaultVisible: true,  defaultOrder: 2 },
    { key: 'ruc_cliente',         label: 'RUC Cliente',        defaultVisible: true,  defaultOrder: 3 },
    { key: 'nombre_cliente',      label: 'Nombre Cliente',     defaultVisible: true,  defaultOrder: 4 },
    { key: 'monto_neto',          label: 'Monto Neto',         defaultVisible: true,  defaultOrder: 5 },
    { key: 'monto_impuesto',      label: 'Monto Impuesto',     defaultVisible: true,  defaultOrder: 6 },
    { key: 'monto_total',         label: 'Monto Total',        defaultVisible: true,  defaultOrder: 7 },
    { key: 'descripcion',         label: 'Descripción',        defaultVisible: false, defaultOrder: 8 },
    { key: 'id',                  label: 'ID',                 defaultVisible: false, defaultOrder: 9 },
    { key: 'created_at',          label: 'Creado',             defaultVisible: false, defaultOrder: 10 },
  ],
};
```

- [ ] **Step 3: Commit**

```bash
git add lib/reports/ventas.ts
git commit -m "feat: Update ventas report to use stored procedure dbo.sp_GetVentasByDateRange"
```
