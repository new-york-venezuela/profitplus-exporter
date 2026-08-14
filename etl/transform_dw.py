"""
transform_dw.py — Transforms DW_Profit stg.* tables into the dw.* dimensional model.

Runs entirely inside DW_Profit (stg -> dw), no source-DB connection needed —
run etl/extract_staging.py first to populate stg.*.

Dimensions (Dim_Cliente, Dim_Vendedor, Dim_Articulo, Dim_Tiempo) are upserted
(MERGE) since they're small and slowly-changing. Fact_Ventas is rebuilt for
the date range present in stg.saFacturaVenta (delete + reinsert by Fecha_Key),
mirroring the pattern in scripts/etl_dw.py.

Usage:
    python etl/transform_dw.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from etl._db import load_dotenv, get_dw_connection  # noqa: E402


MERGE_DIM_CLIENTE = """
MERGE dw.Dim_Cliente AS tgt
USING (SELECT co_cli, cli_des, co_ven, rif, contrib FROM stg.saCliente) AS src
    ON tgt.Cliente_Key = src.co_cli
WHEN MATCHED THEN UPDATE SET
    Cliente_Des = src.cli_des, Vendedor_Key = src.co_ven,
    RIF = src.rif, Contribuyente_Especial = src.contrib
WHEN NOT MATCHED THEN INSERT (Cliente_Key, Cliente_Des, Vendedor_Key, RIF, Contribuyente_Especial)
    VALUES (src.co_cli, src.cli_des, src.co_ven, src.rif, src.contrib);
"""

MERGE_DIM_VENDEDOR = """
MERGE dw.Dim_Vendedor AS tgt
USING (SELECT co_ven, ven_des FROM stg.saVendedor) AS src
    ON tgt.Vendedor_Key = src.co_ven
WHEN MATCHED THEN UPDATE SET Vendedor_Des = src.ven_des
WHEN NOT MATCHED THEN INSERT (Vendedor_Key, Vendedor_Des) VALUES (src.co_ven, src.ven_des);
"""

MERGE_DIM_ARTICULO = """
MERGE dw.Dim_Articulo AS tgt
USING (SELECT co_art, art_des, co_lin, anulado FROM stg.saArticulo) AS src
    ON tgt.Articulo_Key = src.co_art
WHEN MATCHED THEN UPDATE SET
    Articulo_Des = src.art_des, Linea_Key = src.co_lin, Activo = CASE WHEN src.anulado = 1 THEN 0 ELSE 1 END
WHEN NOT MATCHED THEN INSERT (Articulo_Key, Articulo_Des, Linea_Key, Activo)
    VALUES (src.co_art, src.art_des, src.co_lin, CASE WHEN src.anulado = 1 THEN 0 ELSE 1 END);
"""

# Populate Dim_Tiempo for every distinct date present in the staged sales window.
MERGE_DIM_TIEMPO = """
MERGE dw.Dim_Tiempo AS tgt
USING (
    SELECT DISTINCT
        CAST(CONVERT(VARCHAR(8), CAST(fec_emis AS DATE), 112) AS INT) AS Fecha_Key,
        CAST(fec_emis AS DATE) AS Fecha
    FROM stg.saFacturaVenta
    WHERE fec_emis IS NOT NULL
) AS src
    ON tgt.Fecha_Key = src.Fecha_Key
WHEN NOT MATCHED THEN INSERT (Fecha_Key, Fecha, Anio, Mes, Dia, Trimestre, Nombre_Mes)
    VALUES (src.Fecha_Key, src.Fecha, YEAR(src.Fecha), MONTH(src.Fecha), DAY(src.Fecha),
            DATEPART(QUARTER, src.Fecha), DATENAME(MONTH, src.Fecha));
"""

FACT_VENTAS_SELECT = """
SELECT
    CAST(CONVERT(VARCHAR(8), f.fec_emis, 112) AS INT)  AS Fecha_Key,
    ISNULL(f.co_cli, '')                                AS Cliente_Key,
    ISNULL(r.co_art, '')                                AS Articulo_Key,
    ISNULL(f.co_ven, '')                                AS Vendedor_Key,
    ISNULL(r.total_art, 0)                              AS Cantidad,
    ISNULL(r.reng_neto, 0)                               AS Monto_Neto_BS,
    ISNULL(f.tasa, 1)                                   AS Tasa_Documento,
    f.doc_num                                            AS Numero_Factura,
    r.reng_num                                           AS Reng_Num
FROM stg.saFacturaVenta f
INNER JOIN stg.saFacturaVentaReng r ON f.doc_num = r.doc_num
WHERE f.anulado = 0;
"""

FACT_VENTAS_INSERT = """
INSERT INTO dw.Fact_Ventas
    (Fecha_Key, Cliente_Key, Articulo_Key, Vendedor_Key, Cantidad, Monto_Neto_BS, Tasa_Documento, Numero_Factura, Reng_Num)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
"""


def _run_dim_merges(cur) -> None:
    print("  [+] Dim_Cliente…")
    cur.execute(MERGE_DIM_CLIENTE)
    print("  [+] Dim_Vendedor…")
    cur.execute(MERGE_DIM_VENDEDOR)
    print("  [+] Dim_Articulo…")
    cur.execute(MERGE_DIM_ARTICULO)
    print("  [+] Dim_Tiempo…")
    cur.execute(MERGE_DIM_TIEMPO)


def _run_fact_ventas(cur) -> None:
    print("  [+] Fact_Ventas…")
    cur.execute("SELECT DISTINCT CAST(CONVERT(VARCHAR(8), fec_emis, 112) AS INT) FROM stg.saFacturaVenta WHERE fec_emis IS NOT NULL")
    fecha_keys = [row[0] for row in cur.fetchall()]
    if not fecha_keys:
        print("      → no staged sales rows, skipping")
        return

    placeholders = ",".join("?" for _ in fecha_keys)
    cur.execute(f"DELETE FROM dw.Fact_Ventas WHERE Fecha_Key IN ({placeholders})", fecha_keys)

    cur.execute(FACT_VENTAS_SELECT)
    rows = cur.fetchall()
    for row in rows:
        cur.execute(FACT_VENTAS_INSERT, tuple(row))
    print(f"      → {len(rows)} rows across {len(fecha_keys)} date(s)")


def main() -> None:
    load_dotenv()
    print("[*] Transform stg -> dw")

    dw_conn = get_dw_connection(ensure_dw=False)
    cur = dw_conn.cursor()

    try:
        _run_dim_merges(cur)
        _run_fact_ventas(cur)
        dw_conn.commit()
        print("\n[✔] Transform complete")
    except Exception as e:
        dw_conn.rollback()
        sys.exit(f"[✗] Transform failed: {e}")
    finally:
        dw_conn.close()


if __name__ == "__main__":
    main()
