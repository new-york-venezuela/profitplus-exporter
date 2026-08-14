"""Shared MSSQL connection helpers for the etl/ package.

Mirrors the env-var contract of scripts/etl_dw.py and lib/db/mssql.ts:
DB_SERVER, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_ENCRYPT,
DB_TRUST_SERVER_CERT — for the Profit Plus source DB, plus DW_SERVER /
DW_PORT / DW_NAME overrides (defaulting to the source connection / "DW_Profit")
for the DW_Profit target.
"""

import os
import sys
from pathlib import Path


def load_dotenv() -> None:
    try:
        from dotenv import load_dotenv as _load
        root = Path(__file__).parent.parent
        for name in (".env.local", ".env"):
            p = root / name
            if p.exists():
                _load(p)
                break
    except ImportError:
        pass


def conn_str(server: str, port: str, db: str, user: str, pwd: str,
             encrypt: str = "no", trust: str = "yes") -> str:
    driver = os.environ.get("DB_ODBC_DRIVER", "ODBC Driver 18 for SQL Server")
    return (
        f"DRIVER={{{driver}}};"
        f"SERVER={server},{port};"
        f"DATABASE={db};"
        f"UID={user};"
        f"PWD={pwd};"
        f"Encrypt={encrypt};"
        f"TrustServerCertificate={trust};"
    )


def ensure_database(pyodbc_mod, server: str, port: str, db: str, user: str, pwd: str,
                     encrypt: str, trust: str) -> None:
    master = pyodbc_mod.connect(
        conn_str(server, port, "master", user, pwd, encrypt, trust), autocommit=True
    )
    try:
        master.cursor().execute(
            f"IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = ?) "
            f"EXEC('CREATE DATABASE [{db}]')", (db,)
        )
    finally:
        master.close()


def _base_creds():
    server = os.environ["DB_SERVER"]
    port = os.environ.get("DB_PORT", "1433")
    user = os.environ["DB_USER"]
    pwd = os.environ["DB_PASSWORD"]
    encrypt = "yes" if os.environ.get("DB_ENCRYPT", "false").lower() == "true" else "no"
    trust = "yes" if os.environ.get("DB_TRUST_SERVER_CERT", "true").lower() == "true" else "no"
    return server, port, user, pwd, encrypt, trust


def get_dw_connection(ensure_dw: bool = True):
    """Returns a connection to DW_Profit only — no source-DB connection opened."""
    try:
        import pyodbc
    except ImportError:
        sys.exit("pyodbc not installed. Run: pip install pyodbc")

    server, port, user, pwd, encrypt, trust = _base_creds()
    dw_server = os.environ.get("DW_SERVER", server)
    dw_port = os.environ.get("DW_PORT", port)
    dw_db = os.environ.get("DW_NAME", "DW_Profit")

    if ensure_dw:
        ensure_database(pyodbc, dw_server, dw_port, dw_db, user, pwd, encrypt, trust)

    return pyodbc.connect(conn_str(dw_server, dw_port, dw_db, user, pwd, encrypt, trust))


def get_connections(ensure_dw: bool = True):
    """Returns (src_conn, dw_conn) using the env vars documented above."""
    try:
        import pyodbc
    except ImportError:
        sys.exit("pyodbc not installed. Run: pip install pyodbc")

    server, port, user, pwd, encrypt, trust = _base_creds()
    src_db = os.environ["DB_NAME"]

    dw = get_dw_connection(ensure_dw=ensure_dw)
    src = pyodbc.connect(conn_str(server, port, src_db, user, pwd, encrypt, trust))
    return src, dw
