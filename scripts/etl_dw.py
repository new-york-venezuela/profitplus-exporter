"""
etl_dw.py — Nightly ETL: populates DW_Profit from Profit Plus MSSQL source.

Tables populated:
  Fact_Ventas                          — sales fact table
  Snapshot_FlujoCaja_CuentasPorCobrar  — daily A/R snapshot
  Snapshot_Inventario                  — daily inventory snapshot

Usage:
    python scripts/etl_dw.py [--date 2024-01-31]  # defaults to today

Reads connection from env vars (DB_SERVER, DB_NAME, etc.) for the source DB.
DW target: DW_Profit database on the same server (DW_SERVER / DW_NAME override).

Run nightly via Task Scheduler on Windows Server before the backup job.
"""

import argparse
import os
import sys
from datetime import date, datetime
from pathlib import Path


def _load_dotenv() -> None:
    try:
        from dotenv import load_dotenv
        root = Path(__file__).parent.parent
        for name in (".env.local", ".env"):
            p = root / name
            if p.exists():
                load_dotenv(p)
                break
    except ImportError:
        pass


def _conn_str(server: str, port: str, db: str, user: str, pwd: str,
              encrypt: str = "no", trust: str = "yes") -> str:
    return (
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={server},{port};"
        f"DATABASE={db};"
        f"UID={user};"
        f"PWD={pwd};"
        f"Encrypt={encrypt};"
        f"TrustServerCertificate={trust};"
    )


def _get_connections():
    try:
        import pyodbc
    except ImportError:
        sys.exit("pyodbc not installed. Run: pip install pyodbc")

    server = os.environ["DB_SERVER"]
    port = os.environ.get("DB_PORT", "1433")
    user = os.environ["DB_USER"]
    pwd = os.environ["DB_PASSWORD"]
    encrypt = "yes" if os.environ.get("DB_ENCRYPT", "false").lower() == "true" else "no"
    trust = "yes" if os.environ.get("DB_TRUST_SERVER_CERT", "true").lower() == "true" else "no"

    src_db = os.environ["DB_NAME"]
    dw_server = os.environ.get("DW_SERVER", server)
    dw_port = os.environ.get("DW_PORT", port)
    dw_db = os.environ.get("DW_NAME", "DW_Profit")

    src = pyodbc.connect(_conn_str(server, port, src_db, user, pwd, encrypt, trust))
    dw = pyodbc.connect(_conn_str(dw_server, dw_port, dw_db, user, pwd, encrypt, trust))
    return src, dw


# ── DDL bootstrap (idempotent) ────────────────────────────────────────────────

DDL = """
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fact_Ventas')
CREATE TABLE Fact_Ventas (
    Fecha_Key         INT         NOT NULL,
    Cliente_Key       VARCHAR(20) NOT NULL,
    Articulo_Key      VARCHAR(20) NOT NULL,
    Vendedor_Key      VARCHAR(20) NOT NULL,
    Cantidad          DECIMAL(18,4) NOT NULL DEFAULT 0,
    Monto_Bruto_BS    DECIMAL(18,4) NOT NULL DEFAULT 0,
    Monto_Neto_BS     DECIMAL(18,4) NOT NULL DEFAULT 0,
    Tasa_Documento    DECIMAL(18,6) NOT NULL DEFAULT 1,
    Monto_Neto_USD    AS (CASE WHEN Tasa_Documento = 0 THEN 0
                              ELSE Monto_Neto_BS / Tasa_Documento END) PERSISTED,
    Numero_Factura    VARCHAR(20),
    Tipo_Documento    VARCHAR(10),
    ETL_Timestamp     DATETIME2   NOT NULL DEFAULT GETDATE(),
    PRIMARY KEY (Fecha_Key, Cliente_Key, Articulo_Key, Numero_Factura)
);

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Snapshot_FlujoCaja_CuentasPorCobrar')
CREATE TABLE Snapshot_FlujoCaja_CuentasPorCobrar (
    Fecha_Snapshot              DATE        NOT NULL,
    co_cli                      VARCHAR(20) NOT NULL,
    Monto_Pendiente_BS          DECIMAL(18,4) NOT NULL DEFAULT 0,
    Monto_Pendiente_USD         DECIMAL(18,4) NOT NULL DEFAULT 0,
    Notas_Credito_Sin_Aplicar_USD DECIMAL(18,4) NOT NULL DEFAULT 0,
    Saldo_Neto_Real_USD         AS (Monto_Pendiente_USD - Notas_Credito_Sin_Aplicar_USD) PERSISTED,
    ETL_Timestamp               DATETIME2   NOT NULL DEFAULT GETDATE(),
    PRIMARY KEY (Fecha_Snapshot, co_cli)
);

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Snapshot_Inventario')
CREATE TABLE Snapshot_Inventario (
    Fecha_Snapshot       DATE        NOT NULL,
    co_art               VARCHAR(20) NOT NULL,
    co_alma              VARCHAR(10) NOT NULL,
    Stock_Actual         DECIMAL(18,4) NOT NULL DEFAULT 0,
    Costo_Promedio_BS    DECIMAL(18,4) NOT NULL DEFAULT 0,
    Costo_Promedio_USD   DECIMAL(18,4) NOT NULL DEFAULT 0,
    ETL_Timestamp        DATETIME2   NOT NULL DEFAULT GETDATE(),
    PRIMARY KEY (Fecha_Snapshot, co_art, co_alma)
);
"""


# ── ETL queries (source → DW) ─────────────────────────────────────────────────

# Fact_Ventas: join invoice header + line items for the target date
FACT_VENTAS_SRC = """
SELECT
    CAST(CONVERT(VARCHAR(8), f.fec_emis, 112) AS INT)  AS Fecha_Key,
    ISNULL(f.co_cli, '')                                AS Cliente_Key,
    ISNULL(r.co_art, '')                                AS Articulo_Key,
    ISNULL(f.co_ven, '')                                AS Vendedor_Key,
    ISNULL(r.cant_art, 0)                               AS Cantidad,
    ISNULL(r.mont_bruto, 0)                             AS Monto_Bruto_BS,
    ISNULL(r.mont_neto, 0)                              AS Monto_Neto_BS,
    ISNULL(f.tasa, 1)                                   AS Tasa_Documento,
    ISNULL(f.nro_doc, '')                               AS Numero_Factura,
    ISNULL(f.tipo_doc, 'FACT')                          AS Tipo_Documento
FROM saFacturaVenta f
INNER JOIN saFacturaVentaReng r ON f.co_tipo_doc = r.co_tipo_doc
                                AND f.nro_doc    = r.nro_doc
WHERE CAST(f.fec_emis AS DATE) = ?
  AND f.anulada = 0;
"""

FACT_VENTAS_DELETE = "DELETE FROM Fact_Ventas WHERE Fecha_Key = ?;"
FACT_VENTAS_INSERT = """
INSERT INTO Fact_Ventas
    (Fecha_Key, Cliente_Key, Articulo_Key, Vendedor_Key,
     Cantidad, Monto_Bruto_BS, Monto_Neto_BS, Tasa_Documento,
     Numero_Factura, Tipo_Documento)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
"""

# A/R snapshot: open documents by client
AR_SNAPSHOT_SRC = """
SELECT
    co_cli,
    SUM(ISNULL(saldo, 0))                                    AS Monto_Pendiente_BS,
    SUM(ISNULL(saldo, 0) / NULLIF(ISNULL(tasa, 1), 0))      AS Monto_Pendiente_USD
FROM saDocumentoVenta
WHERE saldo > 0
  AND tipo_doc NOT IN ('N/CR', 'NCR')
GROUP BY co_cli;
"""

NC_SNAPSHOT_SRC = """
SELECT
    co_cli,
    SUM(ISNULL(saldo, 0) / NULLIF(ISNULL(tasa, 1), 0))  AS Notas_Credito_Sin_Aplicar_USD
FROM saDocumentoVenta
WHERE saldo > 0
  AND tipo_doc IN ('N/CR', 'NCR')
GROUP BY co_cli;
"""

AR_DELETE = "DELETE FROM Snapshot_FlujoCaja_CuentasPorCobrar WHERE Fecha_Snapshot = ?;"
AR_INSERT = """
INSERT INTO Snapshot_FlujoCaja_CuentasPorCobrar
    (Fecha_Snapshot, co_cli, Monto_Pendiente_BS, Monto_Pendiente_USD,
     Notas_Credito_Sin_Aplicar_USD)
VALUES (?, ?, ?, ?, ?);
"""

# Inventory snapshot
INV_SNAPSHOT_SRC = """
SELECT
    co_art,
    ISNULL(co_alma, '')                                      AS co_alma,
    ISNULL(stock_act, 0)                                     AS Stock_Actual,
    ISNULL(cost_prom, 0)                                     AS Costo_Promedio_BS,
    ISNULL(cost_prom, 0) / NULLIF(
        ISNULL((SELECT TOP 1 tasa FROM saTasaCambio
                WHERE moneda = 'USD' ORDER BY fec_desde DESC), 1), 0)
                                                             AS Costo_Promedio_USD
FROM saStockArticulo
WHERE stock_act <> 0;
"""

INV_DELETE = "DELETE FROM Snapshot_Inventario WHERE Fecha_Snapshot = ?;"
INV_INSERT = """
INSERT INTO Snapshot_Inventario
    (Fecha_Snapshot, co_art, co_alma, Stock_Actual, Costo_Promedio_BS, Costo_Promedio_USD)
VALUES (?, ?, ?, ?, ?, ?);
"""


# ── ETL runners ───────────────────────────────────────────────────────────────

def _run_fact_ventas(src_cur, dw_cur, target_date: date) -> None:
    date_str = target_date.isoformat()
    fecha_key = int(target_date.strftime("%Y%m%d"))

    print(f"  [+] Fact_Ventas for {date_str}…")
    src_cur.execute(FACT_VENTAS_SRC, (date_str,))
    rows = src_cur.fetchall()

    dw_cur.execute(FACT_VENTAS_DELETE, (fecha_key,))
    for row in rows:
        dw_cur.execute(FACT_VENTAS_INSERT, row)
    print(f"      → {len(rows)} rows")


def _run_ar_snapshot(src_cur, dw_cur, target_date: date) -> None:
    date_str = target_date.isoformat()
    print(f"  [+] Snapshot_FlujoCaja_CuentasPorCobrar for {date_str}…")

    src_cur.execute(AR_SNAPSHOT_SRC)
    ar_rows = {r[0]: list(r) for r in src_cur.fetchall()}

    src_cur.execute(NC_SNAPSHOT_SRC)
    for r in src_cur.fetchall():
        if r[0] in ar_rows:
            ar_rows[r[0]].append(r[1])
        else:
            ar_rows[r[0]] = [r[0], 0, 0, r[1]]

    dw_cur.execute(AR_DELETE, (date_str,))
    count = 0
    for co_cli, vals in ar_rows.items():
        monto_bs  = vals[1] if len(vals) > 1 else 0
        monto_usd = vals[2] if len(vals) > 2 else 0
        nc_usd    = vals[3] if len(vals) > 3 else 0
        dw_cur.execute(AR_INSERT, (date_str, co_cli, monto_bs, monto_usd, nc_usd))
        count += 1
    print(f"      → {count} clients")


def _run_inv_snapshot(src_cur, dw_cur, target_date: date) -> None:
    date_str = target_date.isoformat()
    print(f"  [+] Snapshot_Inventario for {date_str}…")

    src_cur.execute(INV_SNAPSHOT_SRC)
    rows = src_cur.fetchall()

    dw_cur.execute(INV_DELETE, (date_str,))
    for row in rows:
        dw_cur.execute(INV_INSERT, (date_str, row[0], row[1], row[2], row[3], row[4]))
    print(f"      → {len(rows)} SKU-warehouse pairs")


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    _load_dotenv()

    parser = argparse.ArgumentParser(description="Nightly ETL: Profit Plus → DW_Profit")
    parser.add_argument("--date", default=date.today().isoformat(),
                        help="Target date YYYY-MM-DD (default: today)")
    parser.add_argument("--skip-ddl", action="store_true",
                        help="Skip DDL bootstrap (use when tables already exist)")
    args = parser.parse_args()

    target_date = datetime.strptime(args.date, "%Y-%m-%d").date()
    print(f"[*] ETL run for {target_date}")

    src_conn, dw_conn = _get_connections()
    src_cur = src_conn.cursor()
    dw_cur = dw_conn.cursor()

    if not args.skip_ddl:
        print("[*] Bootstrapping DW schema…")
        for stmt in DDL.strip().split("\n\n"):
            stmt = stmt.strip()
            if stmt:
                dw_cur.execute(stmt)
        dw_conn.commit()
        print("    → Done")

    try:
        _run_fact_ventas(src_cur, dw_cur, target_date)
        _run_ar_snapshot(src_cur, dw_cur, target_date)
        _run_inv_snapshot(src_cur, dw_cur, target_date)
        dw_conn.commit()
        print(f"\n[✔] ETL complete for {target_date}")
    except Exception as e:
        dw_conn.rollback()
        sys.exit(f"[✗] ETL failed: {e}")
    finally:
        src_conn.close()
        dw_conn.close()


if __name__ == "__main__":
    main()
