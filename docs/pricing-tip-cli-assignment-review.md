# Review: automatic price-list assignment via `tip_cli`

Date: 2026-10-28. Scope: review of the pricing specs and implementation (`docs/superpowers/specs/2026-09-27-*`, `2026-10-01-pricing-*`), plus a read-only check of invoice data.

> Data caveat: all numbers below come from the **local ERP copy**, which is stale and contains `TP*` test lists. Confirm against production before acting on them.

## Verdict

Customers are **not** yet assigned price lists automatically. The design and the `/pricing` workspace are sound, but no customer has been moved off the March placeholder segments, so every invoice line is priced from a list picked by hand.

## How Profit picks a price

`saCliente.tip_cli` → `saTipoCliente.co_precio` → `saArtPrecio`, filtered by invoice date (`desde`/`hasta`), warehouse and currency (lookup function `PrecioAUnaFecha`).

- The `/pricing` tab writes exactly these fields; "Segmento" there means `tip_cli`.
- This company has **0 pedidos and 0 cotizaciones**; only invoices exist, so there is nothing to check on pedidos.

### `tip_cli` vs `co_seg`

| Field | Table | Affects price? | Written by |
|---|---|---|---|
| `saCliente.tip_cli` | `saTipoCliente` | **Yes**, the only lever | `/pricing`, and the planned `tipo-cliente:apply` |
| `saCliente.co_seg` | `saSegmento` | No (business customer group) | `mapping:apply` |

Focus on `tip_cli` only. `co_seg` matters only if the groups should be aligned with price lists, which is a separate decision.

## Findings (local copy)

| Check | Result |
|---|---|
| Active customers on `tip_cli` `000001` / `000002` (both → list `01`) | 184 of 184 |
| Rates in list `01` | 1 |
| Lists holding the real prices | `02`, `03`, `04`, `06`, `07`, `08`, `09` (USD or BSD) |
| Invoice lines (last 60 days) priced from the customer's own list | 0 of 1,657 |
| Lists actually used on those lines | `09`, `04`, `03`, `02`, `08`, chosen manually at invoicing |
| Segments existing in `saTipoCliente` | `000001`, `000002`, `02`, plus 3 `TP*` test rows |

Lists used by customers in the last 90 days:

| List | Customers |
|---|---|
| `09` | 47 |
| `04` | 46 |
| `03` | 17 |
| `02` | 12 |
| `08` | 3 |
| none (no invoices) | 59 |

## Gaps to close

1. **No customer-to-list mapping.** Someone must decide each customer's list.
2. **Missing segments.** Lists `03`, `04`, `08`, `09` have no `saTipoCliente` row.
3. **Mixed currency.** Lists are BSD or USD, and list `09` appears on invoices in both. Verify Profit converts correctly when invoice currency differs from list currency.
4. **Warehouse hard-coded.** Every rate row is tied to warehouse `000015`; lines from other warehouses may find no price.
5. **Unconfirmed spec items:** does the invoicing lookup honor `desde`/`hasta`; does the price auto-fill on customer change; does the invoice screen default to the customer's list.
6. **Expiry sweep:** confirm the nightly `pricing:sweep-promotions` Task Scheduler job is actually installed.

## Done so far

- `scripts/tipo-cliente-export.ts` (read-only) writes `data/tipo-cliente/2026-10-export.csv`: 184 active customers with `co_cli`, `nombre`, `co_ven`, `tip_cli_actual`, `des_tipo_actual`, `lista_actual`, `lista_usada_90d`, `moneda_90d`, `lineas_90d` and a blank `tip_cli_nuevo` to fill in.
- Not yet added to `package.json` as `tipo-cliente:export`.

## Planned: `tipo-cliente:apply`

Same pattern as `credit-terms:apply`:

1. Reads the CSV; **dry run by default**, printing each customer's before → after list and any segments it would create.
2. `--apply` writes via `pApiActualizarTipoCliente` / `updateCustomerTipCli`, logs every change under a `run_id`, and supports `--rollback <runId>`.
3. `tip_cli_nuevo` accepts an existing `tip_cli` **or a list code** (e.g. `09`); missing segments are created for list codes.
4. Warns (does not fix) on rows whose list does not exist, has no current rates, or differs in currency from the customer's recent invoices.

## Next steps

1. Decide whether `tip_cli_nuevo` is pre-filled with `lista_usada_90d` for the 125 customers who have one (leaving 59 blanks), or starts empty.
2. Rerun the export against production to confirm the counts.
3. Fill in the CSV.
4. Build `tipo-cliente:apply` (dry run first).
5. Integration test on a non-production instance: move one test customer to a USD list, create a draft invoice, confirm the line price (settles gaps 3 to 5).
