"""
generate_skeleton_docs.py — Deterministic skeleton doc generator.

Reads profit_schema.json and writes docs/tables/<table>.md with:
  - Full column list (type, nullable, identity)
  - Explicit FKs from sys.foreign_keys
  - Implicit FK hints based on naming conventions
  - Trigger list
  - Raw SP list (just names) that reference this table

Usage: python scripts/generate_skeleton_docs.py
"""

import json
import re
from pathlib import Path

SCHEMA_FILE = Path("profit_schema.json")
DOCS_DIR = Path("docs")

# Known Profit Plus implicit FK patterns: suffix -> table.column
FK_PATTERNS = {
    "co_cli":    ("saCliente",         "co_cli"),
    "co_art":    ("saArticulo",        "co_art"),
    "co_ven":    ("saVendedor",        "co_ven"),
    "co_prov":   ("saProveedor",       "co_prov"),
    "co_lin":    ("saLineaArticulo",   "co_lin"),
    "co_alma":   ("saAlmacen",         "co_alma"),
    "co_caj":    ("saCaja",            "co_caj"),
    "co_ban":    ("saBanco",           "co_ban"),
    "co_mone":   ("saMoneda",          "co_mone"),
    "co_uni":    ("saUnidad",          "co_uni"),
    "co_cat":    ("saCatArticulo",     "co_cat"),
    "co_subl":   ("saSubLinea",        "co_subl"),
    "co_color":  ("saColor",           "co_color"),
    "co_zona":   ("saZona",            "co_zona"),
    "co_tasa":   ("saTasa",            "co_tasa"),
    "co_impu":   ("saImpuesto",        "co_impu"),
    "co_tipo_doc": ("saTipoDocumento", "co_tipo_doc"),
    "nro_doc":   None,  # document number — context-dependent
    "tasa":      None,  # exchange rate in the row itself
}

# Module classification by prefix/name
def classify_module(name: str) -> str:
    if name.startswith("pv"):
        return "Punto de Venta"
    if name.startswith("sc"):
        return "Contabilidad"
    if name.startswith("stg"):
        return "Staging"
    if name in ("sysdiagrams", "par_emp", "Historico_Dolar_BCV_2026"):
        return "Sistema"

    inv_tables = {
        "saArticulo","saAjuste","saAjusteReng","saAlmacen","saStockAlmacen",
        "saResInventario","saResInventarioReng","saInventarioFisico",
        "saCatArticulo","saLineaArticulo","saSubLinea","saColor","saSegmento",
        "saUnidad","saArtPrecio","saArtUnidad","saArtUbicacion","saArtImagen",
        "saArtCaracteristica","saArtCaracteristicaMov","saArtCompuesto",
        "saArtCompuestoGen","saArtCompuestoGenReng","saArtCompuestoReng",
        "saArtCrearAut","saArtIdentificadorReng","saArtImportacion",
        "saArtMargen","saArtProveedorReng","saArtRelacionadoReng",
        "saDescArticulo","saDescCategoria","saDescLinea","saTipoPrecio",
        "saAjPrecioCostoAuto","saAjPrecioCostoM","saAjPrecioCostoReng",
        "saSerie","saSerieTipo","saSerieTipoExt","saSeriales",
        "saLoteEntrada","saLoteSalida","saCostoHistoricoEntrada","saCostoHistoricoSalida",
        "saUbicacion","saIncoterm","saProcedencia","saDatosDeImportacion",
    }
    ventas_tables = {
        "saFacturaVenta","saFacturaVentaReng","saFacturaVentaInfoTercero",
        "saDocumentoVenta","saDocumentoVentaReng","saDocumentoVentaInfoIGTF",
        "saCotizacionCliente","saCotizacionClienteReng",
        "saPedidoVenta","saPedidoVentaReng",
        "saNotaDespachoVenta","saNotaDespachoVentaReng",
        "saNotaEntregaVenta","saNotaEntregaVentaReng",
        "saDevolucionCliente","saDevolucionClienteReng",
        "saGiroVenta","saGiroVentaReng",
        "saNCFInfoDocVenta","saTipoAnulacionVenta",
        "saConfigFacturaVenta","saConfigCotizacionCliente",
        "saConfigDevolucionCliente","saConfigNotaDespachoVenta",
        "saConfigNotaEntregaVenta","saConfigPedidoVenta",
        "saPlantillaVenta","saPlantillaVentaReng",
        "saComisionResultado","saComisionTipo","saComisionGeneracion",
        "saComisionPrecioArticulo","saComisionPrecioCategoria","saComisionPrecioLinea",
        "saComisionRentabArticulo","saComisionRentabCategoria","saComisionRentabLinea",
        "saDescProntoPago",
    }
    compras_tables = {
        "saFacturaCompra","saFacturaCompraReng","saFacturaCompraRengExt",
        "saFacturaCompraImportacion","saFactCompRengCaracteristicasAdic","saFactCompRengPesoVolumen",
        "saDocumentoCompra","saDocumentoCompraReng","saDocumentoCompraInfoIGTF",
        "saCotizacionProveedor","saCotizacionProveedorReng",
        "saOrdenCompra","saOrdenCompraReng",
        "saNotaRecepcionCompra","saNotaRecepcionCompraReng",
        "saDevolucionProveedor","saDevolucionProveedorReng","saDevolucionProveedorRengExt",
        "saGiroCompra","saGiroCompraReng","saNCFInfoDocCompra",
        "saConfigFacturaCompra","saConfigCotizacionProveedor",
        "saConfigDevolucionProveedor","saConfigOrdenCompra","saConfigNotaRecepcionCompra",
        "saPlantillaCompra","saPlantillaCompraReng","saPlantillaCompraReq",
        "saPlantillaCompraReqRelacion","saPlantillaCompraReqRenglon",
    }
    tesoreria_tables = {
        "saCobro","saCobroDocReng","saCobroTPReng",
        "saPago","saPagoDocReng","saPagoTPReng",
        "saMovimientoBanco","saMovimientoCaja",
        "saSaldoBanco","saSaldoCaja",
        "saBanco","saCaja","saChequera","saCheque",
        "saChequeDevueltoVenta","saChequeDevueltoCompra",
        "saCuentaBancaria","saImpuestoCuentaBancaria",
        "saDepositoBanco","saDepositoBancoReng",
        "saOrdenPago","saOrdenPagoReng",
        "saTransferenciaEntreCuentas",
        "saConcBanco","saConciliacionDetalle","saConciliacionAutoReng",
        "saTarjetaCredito","saConfigCobro","saConfigPago",
        "saConfigMovBanco","saConfigMovCaja","saConfigOrdenPago",
        "saConfigDistCosto","saDistribCosto","saDistribCostoDestinoReng",
        "saDistribCostoOrigenReng","saDistribCostoRelaReng",
    }
    fiscal_tables = {
        "saImpuesto","saImpuestoReng","saImpuestoSobreVenta","saImpuestoSobreVentaReng",
        "saConISLR","saTabuladorIslr","saTabuladorIslrReng","saPlanillaFiscal",
        "saCobroRentenReng","saCobroRetenIvaReng",
        "saPagoRentenReng","saPagoRetenIvaReng",
        "saTax","saCuentaIngEgr","saImpMun",
    }
    clientes_tables = {
        "saCliente","saClienteExt","saProveedor","saProveedorExt","saBeneficiario",
        "saTipoCliente","saTipoProveedor","saZona","saCondicionPago","saTransporte",
        "saVendedor",
    }
    logistica_tables = {
        "saTraslado","saTrasladoReng","saTrasladoImpDig",
        "saConfigTraslado",
    }
    if name in inv_tables:      return "Inventario"
    if name in ventas_tables:   return "Ventas"
    if name in compras_tables:  return "Compras"
    if name in tesoreria_tables: return "Tesorería"
    if name in fiscal_tables:   return "Fiscal"
    if name in clientes_tables: return "Clientes"
    if name in logistica_tables: return "Logística"
    return "Configuración"


def implicit_fk(col_name: str, table_name: str) -> str:
    pattern = FK_PATTERNS.get(col_name)
    if pattern is None:
        return ""
    if pattern:
        ref_table, ref_col = pattern
        if ref_table != table_name:
            return f"FK Implícita → `{ref_table}.{ref_col}`"
    return ""


def build_table_md(name: str, meta: dict, explicit_fks: list[dict]) -> str:
    module = classify_module(name)
    cols = meta.get("columns", {})
    triggers = meta.get("triggers", [])

    # Explicit FKs for this table
    efk_map: dict[str, str] = {}
    for fk in explicit_fks:
        if fk["parent_table"] == name:
            efk_map[fk["parent_column"]] = f"FK → `{fk['referenced_table']}.{fk['referenced_column']}`"

    # Build column rows
    col_rows = []
    for col, info in cols.items():
        dtype = info["type"]
        prec = ""
        if info.get("precision") and dtype not in ("varchar","nvarchar","char","text","ntext"):
            prec = f"({info['precision']},{info['scale']})"
        elif info.get("max_length") and dtype in ("varchar","nvarchar","char"):
            ml = info["max_length"]
            if dtype in ("nvarchar","nchar"):
                ml = ml // 2 if ml != -1 else ml
            prec = f"({'max' if ml == -1 else ml})"
        nullable = "NULL" if info["nullable"] else "NOT NULL"
        identity = " IDENTITY" if info["identity"] else ""
        desc = info.get("description", "") or ""

        rel = efk_map.get(col, "") or implicit_fk(col, name)

        col_rows.append(
            f"| `{col}` | {dtype}{prec}{identity} | {nullable} | {desc or '—'} | {rel or '—'} |"
        )

    # Trigger section
    if triggers:
        trg_section = "\n".join(f"- `{t}`" for t in triggers)
    else:
        trg_section = "_Ninguno_"

    lines = [
        f"# Tabla: {name}",
        f"**Módulo**: {module}",
        f"**Descripción de Negocio**: _Pendiente de enriquecimiento_",
        "",
        "## Campos",
        "| Campo | Tipo | Nulo | Descripción | Relación |",
        "|---|---|---|---|---|",
        *col_rows,
        "",
        "## Triggers Relacionados",
        trg_section,
    ]

    # Explicit FKs section
    table_fks = [f for f in explicit_fks if f["parent_table"] == name]
    if table_fks:
        lines += ["", "## Foreign Keys (explícitas)"]
        for fk in table_fks:
            lines.append(
                f"- `{fk['fk_name']}`: `{fk['parent_column']}` → "
                f"`{fk['referenced_table']}.{fk['referenced_column']}`"
            )

    return "\n".join(lines) + "\n"


def main() -> None:
    print("[*] Loading schema…")
    schema = json.loads(SCHEMA_FILE.read_text(encoding="utf-8"))

    tables_dir = DOCS_DIR / "tables"
    tables_dir.mkdir(parents=True, exist_ok=True)
    (DOCS_DIR / "procedures").mkdir(parents=True, exist_ok=True)
    (DOCS_DIR / "triggers").mkdir(parents=True, exist_ok=True)

    explicit_fks: list[dict] = schema.get("foreign_keys", [])
    tables = schema["tables"]

    print(f"[+] Generating {len(tables)} table skeletons…")
    for name, meta in tables.items():
        path = tables_dir / f"{name}.md"
        md = build_table_md(name, meta, explicit_fks)
        path.write_text(md, encoding="utf-8")

    # Skeleton trigger docs (raw code excerpt)
    print(f"[+] Generating {len(schema['triggers'])} trigger skeletons…")
    for name, meta in schema["triggers"].items():
        path = DOCS_DIR / "triggers" / f"{name}.md"
        code = (meta.get("code") or "")[:3000]
        table = meta.get("table", "")
        path.write_text(
            f"# Trigger: {name}\n**Tabla**: `{table}`\n\n"
            f"## Código (excerpt)\n```sql\n{code}\n```\n",
            encoding="utf-8",
        )

    # Write module index
    by_module: dict[str, list[str]] = {}
    for name in tables:
        mod = classify_module(name)
        by_module.setdefault(mod, []).append(name)

    index_lines = [
        "# Profit Plus 2k12 — Schema Index (skeleton)",
        "",
        f"**Tables**: {len(tables)}  |  "
        f"**SPs**: {len(schema['procedures'])}  |  "
        f"**Triggers**: {len(schema['triggers'])}  |  "
        f"**FKs**: {len(explicit_fks)}",
        "",
    ]
    for mod in sorted(by_module):
        index_lines.append(f"## {mod}")
        for t in sorted(by_module[mod]):
            index_lines.append(f"- [{t}](tables/{t}.md)")
        index_lines.append("")

    index_lines += ["## Triggers"]
    for t in sorted(schema["triggers"]):
        index_lines.append(f"- [{t}](triggers/{t}.md)")

    (DOCS_DIR / "INDEX.md").write_text("\n".join(index_lines), encoding="utf-8")

    print(f"[✔] Skeleton docs written → {DOCS_DIR.resolve()}")
    print("    Modules:", {m: len(v) for m, v in sorted(by_module.items())})


if __name__ == "__main__":
    main()
