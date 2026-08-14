"""
snapshot_daily.py — Nightly snapshot job: CXC, CXP and Inventory into DW_Profit's
snap schema. Run before the production backup job (per WORKFLOWS.md guidance
that all reporting reads should use the document's own tasa, never the current
rate — snapshots freeze that view for a given calendar day).

This targets the newer snap.Snapshot_CXC / snap.Snapshot_CXP / snap.Snapshot_Inventario
tables (ddl/01_dw_profit_schema.sql). scripts/etl_dw.py's dbo.Fact_Ventas /
dbo.Snapshot_* tables are a separate, earlier deliverable and are left untouched.

CXC uses saDocumentoVenta; credits are rows with co_tipo_doc IN ('N/CR','NCR').
CXP uses saDocumentoCompra; the same convention is applied for parity, though
no N/CR-equivalent code was observed in purchase documents in the validated
dataset — this snapshot will simply show 0 unapplied credits for such periods.

Usage:
    python etl/snapshot_daily.py [--date 2026-06-30]  # defaults to today
"""

import argparse
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from etl._db import load_dotenv, get_connections  # noqa: E402


CXC_SRC = """
SELECT
    co_cli,
    SUM(CASE WHEN co_tipo_doc NOT IN ('N/CR', 'NCR')
             THEN ISNULL(saldo, 0) ELSE 0 END)                                  AS Monto_Pendiente_BS,
    SUM(CASE WHEN co_tipo_doc NOT IN ('N/CR', 'NCR')
             THEN ISNULL(saldo, 0) / NULLIF(ISNULL(tasa, 1), 0) ELSE 0 END)     AS Monto_Pendiente_USD,
    SUM(CASE WHEN co_tipo_doc IN ('N/CR', 'NCR')
             THEN ISNULL(saldo, 0) / NULLIF(ISNULL(tasa, 1), 0) ELSE 0 END)     AS Notas_Credito_Sin_Aplicar_USD
FROM saDocumentoVenta
WHERE anulado = 0 AND saldo <> 0
GROUP BY co_cli;
"""

CXP_SRC = """
SELECT
    co_prov,
    SUM(CASE WHEN co_tipo_doc NOT IN ('N/CR', 'NCR')
             THEN ISNULL(saldo, 0) ELSE 0 END)                                  AS Monto_Pendiente_BS,
    SUM(CASE WHEN co_tipo_doc NOT IN ('N/CR', 'NCR')
             THEN ISNULL(saldo, 0) / NULLIF(ISNULL(tasa, 1), 0) ELSE 0 END)     AS Monto_Pendiente_USD,
    SUM(CASE WHEN co_tipo_doc IN ('N/CR', 'NCR')
             THEN ISNULL(saldo, 0) / NULLIF(ISNULL(tasa, 1), 0) ELSE 0 END)     AS Notas_Credito_Sin_Aplicar_USD
FROM saDocumentoCompra
WHERE anulado = 0 AND saldo <> 0
GROUP BY co_prov;
"""

# See scripts/etl_dw.py for the discovery notes on saStockAlmacen.tipo
# (ACT/LLE) — summed here for the same reasons documented there.
INV_SRC = """
SELECT
    s.co_art,
    ISNULL(s.co_alma, '')                                    AS co_alma,
    SUM(ISNULL(s.stock, 0))                                  AS Stock_Actual,
    ISNULL(MAX(cp.costo_prom), 0)                            AS Costo_Promedio_BS,
    ISNULL(MAX(cp.costo_prom), 0) / NULLIF(
        (SELECT TOP 1 tasa_v FROM saTasa
         WHERE co_mone = 'USD' ORDER BY fecha DESC), 0)       AS Costo_Promedio_USD
FROM saStockAlmacen s
LEFT JOIN (
    SELECT fcr.co_art, fcr.co_alma, AVG(fcr.cost_unit) AS costo_prom
    FROM saFacturaCompraReng fcr
    INNER JOIN saFacturaCompra fc ON fcr.doc_num = fc.doc_num
    WHERE fc.anulado = 0
    GROUP BY fcr.co_art, fcr.co_alma
) cp ON cp.co_art = s.co_art AND cp.co_alma = s.co_alma
GROUP BY s.co_art, s.co_alma
HAVING SUM(ISNULL(s.stock, 0)) <> 0;
"""

CXC_DELETE = "DELETE FROM snap.Snapshot_CXC WHERE Fecha_Snapshot = ?;"
CXC_INSERT = """
INSERT INTO snap.Snapshot_CXC
    (Fecha_Snapshot, co_cli, Monto_Pendiente_BS, Monto_Pendiente_USD, Notas_Credito_Sin_Aplicar_USD)
VALUES (?, ?, ?, ?, ?);
"""

CXP_DELETE = "DELETE FROM snap.Snapshot_CXP WHERE Fecha_Snapshot = ?;"
CXP_INSERT = """
INSERT INTO snap.Snapshot_CXP
    (Fecha_Snapshot, co_prov, Monto_Pendiente_BS, Monto_Pendiente_USD, Notas_Credito_Sin_Aplicar_USD)
VALUES (?, ?, ?, ?, ?);
"""

INV_DELETE = "DELETE FROM snap.Snapshot_Inventario WHERE Fecha_Snapshot = ?;"
INV_INSERT = """
INSERT INTO snap.Snapshot_Inventario
    (Fecha_Snapshot, co_art, co_alma, Stock_Actual, Costo_Promedio_BS, Costo_Promedio_USD)
VALUES (?, ?, ?, ?, ?, ?);
"""


def _run_cxc(src_cur, dw_cur, date_str: str) -> None:
    print(f"  [+] Snapshot_CXC for {date_str}…")
    src_cur.execute(CXC_SRC)
    rows = src_cur.fetchall()
    dw_cur.execute(CXC_DELETE, (date_str,))
    for co_cli, monto_bs, monto_usd, nc_usd in rows:
        dw_cur.execute(CXC_INSERT, (date_str, co_cli, monto_bs, monto_usd, nc_usd))
    print(f"      → {len(rows)} clients")


def _run_cxp(src_cur, dw_cur, date_str: str) -> None:
    print(f"  [+] Snapshot_CXP for {date_str}…")
    src_cur.execute(CXP_SRC)
    rows = src_cur.fetchall()
    dw_cur.execute(CXP_DELETE, (date_str,))
    for co_prov, monto_bs, monto_usd, nc_usd in rows:
        dw_cur.execute(CXP_INSERT, (date_str, co_prov, monto_bs, monto_usd, nc_usd))
    print(f"      → {len(rows)} proveedores")


def _run_inventory(src_cur, dw_cur, date_str: str) -> None:
    print(f"  [+] Snapshot_Inventario for {date_str}…")
    src_cur.execute(INV_SRC)
    rows = src_cur.fetchall()
    dw_cur.execute(INV_DELETE, (date_str,))
    for co_art, co_alma, stock, costo_bs, costo_usd in rows:
        dw_cur.execute(INV_INSERT, (date_str, co_art, co_alma, stock, costo_bs, costo_usd))
    print(f"      → {len(rows)} SKU-warehouse pairs")


def main() -> None:
    load_dotenv()

    parser = argparse.ArgumentParser(description="Nightly snapshot: CXC, CXP, Inventory -> DW_Profit snap schema")
    parser.add_argument("--date", default=date.today().isoformat(),
                        help="Snapshot date YYYY-MM-DD (default: today)")
    args = parser.parse_args()
    date_str = args.date

    print(f"[*] Snapshot run for {date_str}")
    src_conn, dw_conn = get_connections()
    src_cur = src_conn.cursor()
    dw_cur = dw_conn.cursor()

    try:
        _run_cxc(src_cur, dw_cur, date_str)
        _run_cxp(src_cur, dw_cur, date_str)
        _run_inventory(src_cur, dw_cur, date_str)
        dw_conn.commit()
        print(f"\n[✔] Snapshot complete for {date_str}")
    except Exception as e:
        dw_conn.rollback()
        sys.exit(f"[✗] Snapshot failed: {e}")
    finally:
        src_conn.close()
        dw_conn.close()


if __name__ == "__main__":
    main()
