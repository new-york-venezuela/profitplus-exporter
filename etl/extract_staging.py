"""
extract_staging.py — Loads Profit Plus source tables into DW_Profit's stg schema.

Truncate-and-reload (full refresh) for reference/dimension tables (saCliente,
saVendedor, saArticulo, saTasa) and for transactional tables restricted to a
date window (saFacturaVenta/Reng, saDocumentoVenta) to keep runtime bounded.
saStockAlmacen is always a full snapshot (no date column to filter on).

Usage:
    python etl/extract_staging.py [--since 2026-01-01]  # default: last 7 days

Requires ddl/01_dw_profit_schema.sql to have been run first (creates stg.*).
"""

import argparse
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from etl._db import load_dotenv, get_connections  # noqa: E402


TABLES_FULL_REFRESH = [
    # (stg table, source query)
    ("saCliente", "SELECT co_cli, cli_des, co_ven, rif, contrib FROM saCliente"),
    ("saVendedor", "SELECT co_ven, ven_des FROM saVendedor"),
    ("saArticulo", "SELECT co_art, art_des, co_lin, anulado, stock_min, stock_max, tipo_cos FROM saArticulo"),
    ("saTasa", "SELECT co_mone, fecha, tasa_c, tasa_v FROM saTasa"),
    ("saStockAlmacen", "SELECT co_alma, co_art, tipo, stock FROM saStockAlmacen"),
]

FACT_VENTAS_HEADER = """
SELECT doc_num, co_cli, co_ven, co_mone, fec_emis, fec_venc, tasa,
       total_bruto, monto_imp, total_neto, saldo, anulado, n_control, contrib
FROM saFacturaVenta
WHERE fec_emis >= ?
"""

FACT_VENTAS_RENG = """
SELECT r.doc_num, r.reng_num, r.co_art, r.co_alma, r.total_art, r.reng_neto
FROM saFacturaVentaReng r
INNER JOIN saFacturaVenta f ON r.doc_num = f.doc_num
WHERE f.fec_emis >= ?
"""

DOCUMENTO_VENTA = """
SELECT co_tipo_doc, nro_doc, co_cli, co_ven, tasa, fec_emis, fec_venc,
       total_neto, saldo, anulado
FROM saDocumentoVenta
WHERE fec_emis >= ?
"""


def _reload_full(src_cur, dw_cur, table: str, query: str) -> int:
    dw_cur.execute(f"TRUNCATE TABLE stg.{table}")
    src_cur.execute(query)
    rows = src_cur.fetchall()
    if not rows:
        return 0
    placeholders = ",".join("?" for _ in rows[0])
    insert_sql = f"INSERT INTO stg.{table} VALUES ({placeholders})"
    for row in rows:
        dw_cur.execute(insert_sql, tuple(row))
    return len(rows)


def _reload_windowed(src_cur, dw_cur, table: str, query: str, since: date) -> int:
    dw_cur.execute(f"TRUNCATE TABLE stg.{table}")
    src_cur.execute(query, (since.isoformat(),))
    rows = src_cur.fetchall()
    if not rows:
        return 0
    placeholders = ",".join("?" for _ in rows[0])
    insert_sql = f"INSERT INTO stg.{table} VALUES ({placeholders})"
    for row in rows:
        dw_cur.execute(insert_sql, tuple(row))
    return len(rows)


def main() -> None:
    load_dotenv()

    parser = argparse.ArgumentParser(description="Extract Profit Plus source tables into DW_Profit stg schema")
    parser.add_argument("--since", default=(date.today() - timedelta(days=7)).isoformat(),
                        help="Load transactional tables from this date forward (default: last 7 days)")
    args = parser.parse_args()
    since = date.fromisoformat(args.since)

    print(f"[*] Staging extract — transactional window since {since}")
    src_conn, dw_conn = get_connections()
    src_cur = src_conn.cursor()
    dw_cur = dw_conn.cursor()

    try:
        for table, query in TABLES_FULL_REFRESH:
            n = _reload_full(src_cur, dw_cur, table, query)
            print(f"  [+] stg.{table}: {n} rows (full refresh)")

        n = _reload_windowed(src_cur, dw_cur, "saFacturaVenta", FACT_VENTAS_HEADER, since)
        print(f"  [+] stg.saFacturaVenta: {n} rows (since {since})")

        n = _reload_windowed(src_cur, dw_cur, "saFacturaVentaReng", FACT_VENTAS_RENG, since)
        print(f"  [+] stg.saFacturaVentaReng: {n} rows (since {since})")

        n = _reload_windowed(src_cur, dw_cur, "saDocumentoVenta", DOCUMENTO_VENTA, since)
        print(f"  [+] stg.saDocumentoVenta: {n} rows (since {since})")

        dw_conn.commit()
        print("\n[✔] Staging extract complete")
    except Exception as e:
        dw_conn.rollback()
        sys.exit(f"[✗] Staging extract failed: {e}")
    finally:
        src_conn.close()
        dw_conn.close()


if __name__ == "__main__":
    main()
