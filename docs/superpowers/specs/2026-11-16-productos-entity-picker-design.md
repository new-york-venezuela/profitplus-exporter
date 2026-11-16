# Productos: casa matriz vs tienda picker (design)

Status: approved by user 2026-11-16. Size: small change.

## Intent
In Analítica > Productos the tienda picker mixes legal entities and stores. The user wants to pick a
casa matriz and see its stores' product purchasing aggregated in the existing graphs, or pick a single store as today.

## Goals
- Picker has two groups: **Casas matriz** (`Dim_LegalEntity.StoreCount > 1`, label shows store count) and **Tiendas** (each customer once, by `CustomerCode`).
- Selecting a casa matriz filters every Productos section (table, Profundidad, porLineaMes, grupos) to all of its stores.
- Selecting a store behaves as before (all SCD versions of the code).

## Non-goals
- Store drilldown inside charts/tables (later iteration).
- Changing Clientes/Devoluciones tienda filters.

## Approaches
Only one sensible way: reuse `Dim_LegalEntity` (same entity model as Ventas) rather than grouping by `LegalEntityRIF`, which is a customer attribute, not the app's entity definition.

## Design
- `tienda` param: `e:<LegalEntityKey>` (entity) or `t:<code>` (store); bare value = store.
- Entity filter resolves through CURRENT rows: codes where `IsCurrent = 1 AND LegalEntityKey = @key`, then all SCD versions of those codes (old versions have NULL `LegalEntityKey`).
- One shared SQL fragment for entity/store, used by sales, returns, profundidad, porLineaMes and grupos (`lib/productos/queries.ts`).
- `?tiendas=1` returns options with a `group` field; `SearchableSelect` gets optional `group` rendering headers (backwards compatible).
- Profundidad hides the tier column whenever a tienda/entidad filter is set: tiers come from client penetration (ClientCount / TotalClients), and with one entity or store selected TotalClients = 1, so every row would read "Primera".

## Tests
Picker payload (both groups, deduped), entity filter binding/SQL, store filter unchanged, SearchableSelect group rendering.
