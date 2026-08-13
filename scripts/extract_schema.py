"""
extract_schema.py — Dumps Profit Plus MSSQL schema to profit_schema.json.

Usage:
    python scripts/extract_schema.py [--output profit_schema.json]

Reads connection settings from environment variables (or .env.local via
python-dotenv if installed):
    DB_SERVER, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD,
    DB_ENCRYPT, DB_TRUST_SERVER_CERT
"""

import argparse
import json
import os
import sys


def _load_dotenv():
    try:
        from dotenv import load_dotenv
        root = os.path.join(os.path.dirname(__file__), "..")
        for name in (".env.local", ".env"):
            path = os.path.join(root, name)
            if os.path.exists(path):
                load_dotenv(path)
                break
    except ImportError:
        pass


def _conn_str() -> str:
    server = os.environ["DB_SERVER"]
    port = os.environ.get("DB_PORT", "1433")
    db = os.environ["DB_NAME"]
    user = os.environ["DB_USER"]
    pwd = os.environ["DB_PASSWORD"]
    encrypt = os.environ.get("DB_ENCRYPT", "false").lower()
    trust = os.environ.get("DB_TRUST_SERVER_CERT", "true").lower()

    return (
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={server},{port};"
        f"DATABASE={db};"
        f"UID={user};"
        f"PWD={pwd};"
        f"Encrypt={'yes' if encrypt == 'true' else 'no'};"
        f"TrustServerCertificate={'yes' if trust == 'true' else 'no'};"
    )


def _connect():
    """Try pyodbc first, fall back to pymssql."""
    server = os.environ["DB_SERVER"]
    port = int(os.environ.get("DB_PORT", "1433"))
    db = os.environ["DB_NAME"]
    user = os.environ["DB_USER"]
    pwd = os.environ["DB_PASSWORD"]

    try:
        import pyodbc
        return pyodbc.connect(_conn_str())
    except Exception:
        pass

    try:
        import pymssql
        return pymssql.connect(
            server=server, port=port, user=user, password=pwd,
            database=db, charset="UTF-8",
        )
    except ImportError:
        sys.exit("Neither pyodbc nor pymssql installed. Run: pip install pymssql")


def extract(output_path: str) -> None:
    print("[*] Connecting to SQL Server…")
    conn = _connect()
    cursor = conn.cursor()

    schema: dict = {"tables": {}, "procedures": {}, "triggers": {}, "foreign_keys": []}

    # ── Tables & columns ────────────────────────────────────────────────────
    print("[+] Extracting tables and columns…")
    cursor.execute("""
        SELECT
            t.name                              AS table_name,
            c.name                              AS column_name,
            TYPE_NAME(c.user_type_id)           AS data_type,
            c.max_length,
            c.precision,
            c.scale,
            c.is_nullable,
            c.is_identity,
            ep.value                            AS column_description
        FROM sys.tables t
        INNER JOIN sys.columns c ON t.object_id = c.object_id
        LEFT JOIN sys.extended_properties ep
            ON  ep.major_id = c.object_id
            AND ep.minor_id = c.column_id
            AND ep.name     = 'MS_Description'
        ORDER BY t.name, c.column_id;
    """)
    for row in cursor.fetchall():
        t_name, c_name, dtype, m_len, prec, scale, is_null, is_id, desc = row
        if t_name not in schema["tables"]:
            schema["tables"][t_name] = {"columns": {}, "triggers": []}
        schema["tables"][t_name]["columns"][c_name] = {
            "type": dtype,
            "max_length": m_len,
            "precision": prec,
            "scale": scale,
            "nullable": bool(is_null),
            "identity": bool(is_id),
            "description": str(desc) if desc else "",
        }
    print(f"    → {len(schema['tables'])} tables")

    # ── Foreign keys ─────────────────────────────────────────────────────────
    print("[+] Extracting foreign keys…")
    cursor.execute("""
        SELECT
            fk.name         AS fk_name,
            tp.name         AS parent_table,
            cp.name         AS parent_column,
            tr.name         AS referenced_table,
            cr.name         AS referenced_column
        FROM sys.foreign_keys fk
        INNER JOIN sys.tables             tp  ON fk.parent_object_id      = tp.object_id
        INNER JOIN sys.foreign_key_columns fkc ON fk.object_id            = fkc.constraint_object_id
        INNER JOIN sys.columns            cp  ON fkc.parent_object_id     = cp.object_id
                                             AND fkc.parent_column_id     = cp.column_id
        INNER JOIN sys.tables             tr  ON fk.referenced_object_id  = tr.object_id
        INNER JOIN sys.columns            cr  ON fkc.referenced_object_id = cr.object_id
                                             AND fkc.referenced_column_id = cr.column_id;
    """)
    for row in cursor.fetchall():
        schema["foreign_keys"].append({
            "fk_name":           row[0],
            "parent_table":      row[1],
            "parent_column":     row[2],
            "referenced_table":  row[3],
            "referenced_column": row[4],
        })
    print(f"    → {len(schema['foreign_keys'])} foreign keys")

    # ── Stored procedures ────────────────────────────────────────────────────
    print("[+] Extracting stored procedures…")
    cursor.execute("""
        SELECT p.name, m.definition
        FROM sys.procedures p
        INNER JOIN sys.sql_modules m ON p.object_id = m.object_id;
    """)
    for row in cursor.fetchall():
        schema["procedures"][row[0]] = {"code": row[1]}
    print(f"    → {len(schema['procedures'])} stored procedures")

    # ── Triggers ─────────────────────────────────────────────────────────────
    print("[+] Extracting triggers…")
    cursor.execute("""
        SELECT tr.name, t.name, m.definition
        FROM sys.triggers tr
        INNER JOIN sys.tables     t ON tr.parent_id  = t.object_id
        INNER JOIN sys.sql_modules m ON tr.object_id = m.object_id;
    """)
    for row in cursor.fetchall():
        trg_name, t_name, code = row
        schema["triggers"][trg_name] = {"table": t_name, "code": code}
        if t_name in schema["tables"]:
            schema["tables"][t_name]["triggers"].append(trg_name)
    print(f"    → {len(schema['triggers'])} triggers")

    conn.close()

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(schema, f, indent=2, ensure_ascii=False)

    print(f"[✔] Done → '{output_path}'")
    print(f"    Tables: {len(schema['tables'])}  |  "
          f"FKs: {len(schema['foreign_keys'])}  |  "
          f"SPs: {len(schema['procedures'])}  |  "
          f"Triggers: {len(schema['triggers'])}")


if __name__ == "__main__":
    _load_dotenv()

    parser = argparse.ArgumentParser(description="Extract Profit Plus schema to JSON")
    parser.add_argument("--output", default="profit_schema.json",
                        help="Output file path (default: profit_schema.json)")
    args = parser.parse_args()

    extract(args.output)
