"""
generate_sp_docs.py — Deterministic skeleton doc generator for stored procedures.

For each SP in profit_schema.json:
  - Classifies type (Report, Insert, Update, Delete, Select, Validate, Get, etc.)
  - Extracts table references from the SQL code via regex
  - Classifies module from referenced tables or SP name
  - Writes docs/procedures/<sp_name>.md

Usage: python scripts/generate_sp_docs.py
"""

import json
import re
from pathlib import Path

SCHEMA_FILE = Path("profit_schema.json")
DOCS_DIR = Path("docs/procedures")

# Map table names to modules (same as in skeleton generator)
TABLE_MODULE = {
    # Inventario
    "saArticulo": "Inventario", "saAjuste": "Inventario", "saAjusteReng": "Inventario",
    "saAlmacen": "Inventario", "saStockAlmacen": "Inventario",
    "saResInventario": "Inventario", "saInventarioFisico": "Inventario",
    "saCatArticulo": "Inventario", "saLineaArticulo": "Inventario",
    "saSubLinea": "Inventario", "saArtPrecio": "Inventario",
    "saArtCompuesto": "Inventario", "saLoteEntrada": "Inventario",
    "saLoteSalida": "Inventario", "saSeriales": "Inventario",
    "saArtIdentificadorReng": "Inventario",
    # Ventas
    "saFacturaVenta": "Ventas", "saFacturaVentaReng": "Ventas",
    "saDocumentoVenta": "Ventas", "saDocumentoVentaReng": "Ventas",
    "saCotizacionCliente": "Ventas", "saPedidoVenta": "Ventas",
    "saNotaDespachoVenta": "Ventas", "saNotaEntregaVenta": "Ventas",
    "saDevolucionCliente": "Ventas", "saGiroVenta": "Ventas",
    # Compras
    "saFacturaCompra": "Compras", "saFacturaCompraReng": "Compras",
    "saDocumentoCompra": "Compras", "saDocumentoCompraReng": "Compras",
    "saCotizacionProveedor": "Compras", "saOrdenCompra": "Compras",
    "saNotaRecepcionCompra": "Compras", "saDevolucionProveedor": "Compras",
    "saGiroCompra": "Compras",
    # Tesorería
    "saCobro": "Tesorería", "saCobroDocReng": "Tesorería",
    "saPago": "Tesorería", "saPagoDocReng": "Tesorería",
    "saMovimientoBanco": "Tesorería", "saMovimientoCaja": "Tesorería",
    "saBanco": "Tesorería", "saCaja": "Tesorería",
    "saCuentaBancaria": "Tesorería", "saDepositoBanco": "Tesorería",
    "saOrdenPago": "Tesorería", "saTransferenciaEntreCuentas": "Tesorería",
    # Fiscal
    "saImpuesto": "Fiscal", "saConISLR": "Fiscal",
    "saTabuladorIslr": "Fiscal", "saPlanillaFiscal": "Fiscal",
    "saCobroRetenIvaReng": "Fiscal", "saCobroRentenReng": "Fiscal",
    "saPagoRetenIvaReng": "Fiscal", "saPagoRentenReng": "Fiscal",
    # Clientes
    "saCliente": "Clientes", "saProveedor": "Clientes",
    "saVendedor": "Clientes",
}

SP_TYPE_PATTERNS = [
    (r"^Rep",            "Reporte"),
    (r"^pInsertar",      "Insertar"),
    (r"^pEliminar",      "Eliminar"),
    (r"^pActualizar",    "Actualizar"),
    (r"^pSeleccionar",   "Seleccionar"),
    (r"^pValidar",       "Validar"),
    (r"^pObtener",       "Obtener"),
    (r"^pConsultar",     "Consultar"),
    (r"^pv_Insertar",    "PV-Insertar"),
    (r"^pv_Actualizar",  "PV-Actualizar"),
    (r"^pv_",            "Punto de Venta"),
    (r"^pv",             "Punto de Venta"),
    (r"^sp_",            "Sistema"),
]

# Known table names for reference extraction
KNOWN_TABLES: set[str] = set()


def classify_sp_type(name: str) -> str:
    for pattern, label in SP_TYPE_PATTERNS:
        if re.match(pattern, name):
            return label
    return "Procedimiento"


def extract_table_refs(code: str) -> list[str]:
    """Extract known table names referenced in the SQL code."""
    if not code:
        return []
    # Match word boundaries around known table names
    found: list[str] = []
    for table in KNOWN_TABLES:
        pattern = r'\b' + re.escape(table) + r'\b'
        if re.search(pattern, code, re.IGNORECASE):
            found.append(table)
    return sorted(found)


def classify_module(name: str, table_refs: list[str]) -> str:
    # Try to infer from referenced tables
    module_votes: dict[str, int] = {}
    for t in table_refs:
        mod = TABLE_MODULE.get(t)
        if mod:
            module_votes[mod] = module_votes.get(mod, 0) + 1
    if module_votes:
        return max(module_votes, key=lambda k: module_votes[k])

    # Fall back to SP name prefix
    low = name.lower()
    if "pv" in name[:3]:
        return "Punto de Venta"
    for kw, mod in [
        ("facturaventa", "Ventas"), ("documentoventa", "Ventas"),
        ("cotizacioncliente", "Ventas"), ("pedidoventa", "Ventas"),
        ("notadespacho", "Ventas"), ("notaentrega", "Ventas"),
        ("devolucioncliente", "Ventas"),
        ("facturacompra", "Compras"), ("documentocompra", "Compras"),
        ("ordencompra", "Compras"), ("notarecepcion", "Compras"),
        ("devolucionproveedor", "Compras"),
        ("cobro", "Tesorería"), ("pago", "Tesorería"),
        ("banco", "Tesorería"), ("caja", "Tesorería"),
        ("deposito", "Tesorería"), ("cheque", "Tesorería"),
        ("articulo", "Inventario"), ("stock", "Inventario"),
        ("almacen", "Inventario"), ("ajuste", "Inventario"),
        ("islr", "Fiscal"), ("retencion", "Fiscal"), ("impuesto", "Fiscal"),
        ("planilla", "Fiscal"), ("contribuy", "Fiscal"),
        ("cliente", "Clientes"), ("proveedor", "Clientes"),
        ("vendedor", "Clientes"),
    ]:
        if kw in low:
            return mod
    return "General"


def build_sp_md(name: str, meta: dict, table_refs: list[str]) -> str:
    code = meta.get("code") or ""
    sp_type = classify_sp_type(name)
    module = classify_module(name, table_refs)
    excerpt = code[:2500].strip()

    lines = [
        f"# SP: {name}",
        f"**Tipo**: {sp_type}",
        f"**Módulo**: {module}",
        "",
    ]

    if table_refs:
        lines.append("## Tablas Referenciadas")
        for t in table_refs:
            lines.append(f"- [`{t}`](../tables/{t}.md)")
        lines.append("")

    lines += [
        "## Código (excerpt)",
        "```sql",
        excerpt,
        "```" if not excerpt.endswith("```") else "",
    ]

    return "\n".join(lines) + "\n"


def main() -> None:
    print("[*] Loading schema…")
    schema = json.loads(SCHEMA_FILE.read_text(encoding="utf-8"))

    global KNOWN_TABLES
    KNOWN_TABLES = set(schema["tables"].keys())

    DOCS_DIR.mkdir(parents=True, exist_ok=True)

    procedures = schema["procedures"]
    print(f"[+] Generating {len(procedures)} SP docs…")

    for i, (name, meta) in enumerate(procedures.items(), 1):
        safe_name = name.replace("/", "_").replace("\\", "_").replace(":", "_")
        path = DOCS_DIR / f"{safe_name}.md"
        if path.exists():
            continue
        code = meta.get("code") or ""
        table_refs = extract_table_refs(code)
        md = build_sp_md(name, meta, table_refs)
        path.write_text(md, encoding="utf-8")

        if i % 200 == 0:
            print(f"    {i}/{len(procedures)}")

    # Write SP index
    by_type: dict[str, list[str]] = {}
    for name in procedures:
        t = classify_sp_type(name)
        by_type.setdefault(t, []).append(name)

    idx = [
        "# Profit Plus 2k12 — Stored Procedures Index",
        "",
        f"**Total**: {len(procedures)} stored procedures",
        "",
    ]
    for sp_type in sorted(by_type):
        idx.append(f"## {sp_type} ({len(by_type[sp_type])})")
        for n in sorted(by_type[sp_type]):
            idx.append(f"- [{n}]({n}.md)")
        idx.append("")

    (DOCS_DIR / "INDEX.md").write_text("\n".join(idx), encoding="utf-8")

    print(f"[✔] Done → {DOCS_DIR.resolve()}")
    type_counts = {t: len(v) for t, v in sorted(by_type.items(), key=lambda x: -len(x[1]))}
    print("    Types:", type_counts)


if __name__ == "__main__":
    main()
