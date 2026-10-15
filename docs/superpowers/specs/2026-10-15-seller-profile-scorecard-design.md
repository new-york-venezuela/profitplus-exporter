# Seller profile scorecard — design

Date: 2026-10-15. Status: design approved by the user in chat; implementation follows.

## Problem
The seller profile (`app/(app)/analitica/tabs/seller-profile.tsx`, Seller 360 spec 2026-09-27) is seven stacked, numbered sections
with no verdict, no month pace/projection, activation as a bare count table, quotas edited in three scattered places, and sales
attributed by the DOCUMENT seller (Seguimiento uses the customer's CURRENT seller), so the two screens disagree.

## Decisions (user)
- Top of the page is a **verdict scorecard** (status chips), not a narrative.
- Sales use the **Seguimiento attribution** (customer's current seller; consignment excluded, shown as "Con consignación").

## Layout
1. Header: seller, reference month, "al <fecha>", month pace strip, print button.
2. Verdict row (6 cards, status chip each): Ventas del mes (vs goal, subtitle projection + con consignación), Proyección al cierre,
   Clientes activos (semana actual, vs weekly goal), Nuevos clientes (vs goal), Visitas vencidas, Cobranza vencida.
3. "Qué mirar": rule-based findings, worst first.
4. Detail sections (collapsible, unnumbered; expanded when printing): Activación semanal, Mix por línea, Clientes, Cobranza,
   Devoluciones, Clientes recuperados, Profundidad de línea.
5. One "Editar metas" panel (sales USD, weekly visits, new customers) replaces the scattered editors.

## Data flow
No new endpoint. `GET /api/dwh/seguimiento?kind=vendedor&dateRange=…` -> pick the root with `salesRepKey`; headline, activation, mix,
customers and quotas come from it, so numbers equal Seguimiento's. `GET /api/dwh/vendedor-360` stays for Cobranza, Devoluciones,
Recuperados, Profundidad (its Activación/Cuota sections are no longer rendered). Targets via `/api/admin/seller-targets`; a save
refetches with `no-store`. The scorecard is for the MONTH the date range ends in (`resolveReferenceMonth`); the 360 detail
sections use the full range — the header says which month the scorecard covers.

## Status rules (`lib/seguimiento/seller-verdict.ts`, pure)
- Ratio chips: >= 100% good, 80-99% amber, < 80% red, no goal = grey "Sin meta" (same thresholds as today's profile).
- Activación: active customers this week / weekly goal. Nuevos: count / goal.
- Visitas vencidas: overdue share of (ok+overdue): < 10% good, < 30% amber, else red. Cobranza vencida: share of balance outside the
  `Current` bucket: < 20% good, < 40% amber, else red. (These two thresholds are new — assumption, easy to tune.)
- Findings: projected attainment, "activación bajó N semanas seguidas" (needs >= 3 elapsed weeks with data), overdue visits,
  new customers behind goal.

## Edge cases
Seller absent from the Seguimiento roots -> empty state. A failed 360 request keeps the scorecard visible. Print expands every section.

## Testing
Unit: seller-verdict boundaries (79/80/99/100%), no-goal, 3-week decline vs <3 weeks, findings order. Component: cards and chips,
profile sales equal the Seguimiento root sales, consignment subtitle only with consignment, Editar metas saves + refetches,
360 failure keeps scorecard, empty seller. Existing seller-profile tests updated.
