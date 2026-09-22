# Seller × Depth-of-Line Coverage

Date: 2026-09-21
Status: Approved, pending implementation plan

## Context

Third of four related specs (see
`2026-09-21-profundidad-linea-tab-design.md` for the full list and shared
context, and for the segment/legal-entity matrix this spec extends). Goal:
see whether product-coverage gaps identified in the Depth of Line matrix
concentrate under specific sellers — i.e., is a gap a general market
phenomenon, or is one seller's book of customers systematically missing
products that other sellers' equivalent customers already buy.

### Grain decision (from user)

A seller's "coverage" is measured by **who actually sold what**
(`Fact_Sales.SalesRepKey`), not by the customer's assigned default seller
(`Dim_Customer.DefaultSalesRepCode`). This matches the attribution already
used for commissions (`Fact_Collections.SalesRepKey`, see
`2026-09-21-consignment-commission-exclusion-design.md`) and the existing
Vendedores tab — using a second, different notion of "whose customer is
this" here would make the three seller-facing views inconsistent with each
other.

### Verified: entities are not always single-seller (live, 2026-09-21)

Checked how many distinct `co_ven` values appear across a legal entity's
invoices in the last 12 months: 48 of 67 active entities are served by
exactly one seller, but 19 are split across 2–6 sellers (multi-tienda
chains like Excelsior Gama are the likely driver, since different tiendas
can be served by different reps). **Consequence: the matrix must attribute
at entity × seller × product grain, not assume one seller owns an entity.**
A chain split across three sellers appears under all three, each showing
only the slice of products/tiendas that seller personally sold.

## Design

### Extends, doesn't replace, the Depth of Line tab

Rather than a new tab, this adds a seller filter and a seller-comparison
view to the tab built in spec 1 (`tab-profundidad.tsx`,
`app/api/dwh/profundidad-linea/route.ts`). Reusing the same matrix
component avoids maintaining two nearly-identical grids.

### Seller-scoped matrix

New optional query param `salesRepKey` on the existing route. When present,
every query in spec 1's design (`profundidadLineaQuery`-equivalent,
`activeTotalsQuery`-equivalent) adds `AND fs.SalesRepKey = @salesRepKey`.
This produces the same matrix shape (segment × product-line penetration,
tier classification, gap drill-down), but scoped to only the entities and
sales this seller personally touched — "of the customers I sell to, which
first-line products am I not getting into all of them."

Denominator note: when scoped to a seller, `entitiesActive` in
`DepthMatrixCell` (spec 1's type) means "entities this seller sold
*anything* to in range," not "all entities in the segment" — otherwise a
seller who legitimately only covers 5 of a segment's 60 entities would show
misleadingly low penetration on every product. This makes the seller-scoped
view answer "am I covering my own accounts well," not "am I covering the
whole market," which is the correct question for coaching an individual
seller.

### Seller comparison leaderboard

A new small table above or beside the matrix: one row per seller, showing
their overall penetration rate (pooled across their own entities/products,
same tier-weighted definition as spec 1's `totalPenetration`, but computed
only over each seller's own book) against the **company-wide baseline**
from the unscoped spec-1 matrix. Sorted ascending by relative penetration,
so the seller furthest below baseline — the one most likely to have a real
coverage gap rather than just a smaller or different book — surfaces first.

The leaderboard does not recompute tier classification per seller — it
reuses spec 1's global tier list (computed once, unscoped) and, for each
seller, counts how many (entity, first/second-line product) pairs from that
global list the seller's own entities actually cover:

```sql
-- Step 1 (app code): from spec 1's unscoped matrix response, build the set
-- of (LineName/SKU) values tagged 'primera' or 'segunda'. This is already
-- computed, not re-queried.

-- Step 2: seller's own entities and what they bought, restricted to that tier set
SELECT
  fs.SalesRepKey,
  r.SalesRepName,
  COUNT(DISTINCT c.LegalEntityKey) AS EntitiesServed,
  COUNT(DISTINCT CONCAT(c.LegalEntityKey, '|', p.ProductKey)) AS TieredProductsCovered
FROM fact.Fact_Sales fs
JOIN dim.Dim_SalesRep r ON r.SalesRepKey = fs.SalesRepKey
JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
WHERE fs.IsVoided = 0 AND ISNULL(p.LineName, 'Sin línea') IN (@tieredLineNames) <dateWhere>
GROUP BY fs.SalesRepKey, r.SalesRepName
```

`ownPenetration` is then `TieredProductsCovered / (EntitiesServed *
tieredProductCount)` — the share of this seller's own (entity × tiered
product) pairs that are actually covered, directly comparable to spec 1's
pooled `totalPenetration` since both are penetration rates over the same
tier definition, just over different entity populations.

### Types

Extends spec 1's types in `app/(app)/analitica/types.ts`:

```typescript
export interface SellerCoverageRow {
  salesRepKey: string;
  salesRepName: string;
  entitiesServed: number;
  ownPenetration: number | null;      // this seller's pooled penetration across their own entities
  baselinePenetration: number | null; // company-wide pooled penetration from spec 1, for comparison
  gapVsBaseline: number | null;       // ownPenetration - baselinePenetration; negative = underperforming
}

export interface SellerCoverageResponse {
  rows: SellerCoverageRow[];
  usdRate: number | null;
}
```

`DepthMatrixResponse` (spec 1) gains an optional echo of the `salesRepKey`
filter applied, so the UI can label the matrix clearly ("Mostrando solo
clientes de: Juan Pérez") when scoped.

### UI

In `tab-profundidad.tsx`: a seller dropdown (same `<select>` pattern already
used for the tienda filter in `tab-productos.tsx`) that, when set, scopes
the matrix exactly as described above and shows a "volver a vista general"
affordance. The comparison leaderboard renders as its own small card above
the matrix, always showing the full (unscoped) seller list regardless of
the current matrix filter, so a user can spot an underperforming seller and
then click into their scoped view directly from the leaderboard row.

### Error handling / edge cases

- A seller with zero entities served in range is excluded from the
  leaderboard (nothing to compare), not shown with a `0%`/misleading gap.
- An entity split across multiple sellers (confirmed to happen for ~28% of
  active entities) appears once per seller in that seller's own scoped
  view — this is intentional (each seller's scoped view only reflects their
  own touch on that entity), not deduplicated, since deduplicating would
  hide exactly the overlap this feature might need to reveal as a separate
  future finding (out of scope here, noted for awareness only).

## Testing

- Unit test for the leaderboard's gap calculation (pure function, same
  pattern as prior specs' pure-calculation tests).
- Route test extending spec 1's route test: assert that adding
  `salesRepKey` changes the entity-count denominator to the seller-scoped
  total, not the segment-wide total.
- Manual check against live data: pick a seller known to cover only a
  handful of entities per the 48/19 split found above, confirm their scoped
  matrix's `entitiesActive` matches their own entity count, not the full
  segment.

## Out of scope

- Deduplicating or otherwise specially handling entities served by multiple
  sellers beyond what's described above (each seller simply sees their own
  slice).
- Any commission calculation changes (spec 2 already covers commission
  reliability separately).
- Visit cadence (spec 4).
