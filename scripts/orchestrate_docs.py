"""
orchestrate_docs.py — Multi-pass orchestrator for Profit Plus reverse engineering.

Reads profit_schema.json and generates /docs/tables/, /docs/procedures/,
/docs/triggers/ Markdown files using the Anthropic API.

Passes:
  1  Structural mapping  — identify modules per table
  2  Dependency inference — implicit FKs from SP/trigger code
  3  Code analysis       — clarify ambiguous fields
  4  Consolidation       — write final .md files + index

Usage:
    python scripts/orchestrate_docs.py [--schema profit_schema.json] [--docs docs/]
    Requires: ANTHROPIC_API_KEY in env or .env.local
"""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any


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


# ── Anthropic helpers ────────────────────────────────────────────────────────

ORCHESTRATOR_MODEL = "claude-opus-5-20251101"
SUBAGENT_MODEL = "claude-haiku-4-5-20251001"

_client = None


def _get_client():
    global _client
    if _client is None:
        try:
            import anthropic
        except ImportError:
            sys.exit("anthropic not installed. Run: pip install anthropic")
        _client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client


def _call(model: str, system: str, user: str, max_tokens: int = 4096) -> str:
    client = _get_client()
    for attempt in range(3):
        try:
            msg = client.messages.create(
                model=model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            return msg.content[0].text
        except Exception as e:
            if attempt == 2:
                raise
            wait = 2 ** attempt
            print(f"    [!] API error ({e}), retrying in {wait}s…")
            time.sleep(wait)
    return ""


# ── System prompts ───────────────────────────────────────────────────────────

ORCHESTRATOR_SYSTEM = """
You are an expert in reverse-engineering Profit Plus 2k12, a Venezuelan ERP built on MSSQL.
Your job is to analyze schema elements and return structured Markdown documentation.
Focus on business meaning, implicit relationships, and multicurrency logic (tasa, monto_m, monto_p).
Always return clean Markdown, no extra commentary.
""".strip()

SUBAGENT_SYSTEM = """
You are a T-SQL specialist analyzing Profit Plus 2k12 database objects.
Given a table schema, stored procedure, or trigger definition, produce a Markdown doc that:
- Identifies the business module (Inventario, Ventas, Compras, Tesorería, Fiscal)
- Documents every column with its business meaning and any implicit FK relationship
- Explains the business logic in stored procedures or triggers concisely
- Includes a SQL recipe section with 1-3 practical queries
Return ONLY the Markdown content, no preamble.
""".strip()

TABLE_TEMPLATE = """# Tabla: {name}
**Módulo**: {module}
**Descripción de Negocio**: {description}

## Campos Clave
| Campo | Tipo | Nulo | Descripción de Negocio | Tipo de Relación |
|---|---|---|---|---|
{fields_table}

## Triggers Relacionados
{triggers_section}

## Procedimientos Almacenados Asociados
{sps_section}

## Recetario SQL de Negocio
```sql
{sql_recipe}
```
"""


# ── Schema chunking ──────────────────────────────────────────────────────────

def _table_summary(name: str, meta: dict) -> str:
    cols = meta.get("columns", {})
    col_lines = [f"  - {c}: {v['type']} {'NULL' if v['nullable'] else 'NOT NULL'}"
                 for c, v in list(cols.items())[:40]]
    triggers = meta.get("triggers", [])
    return (
        f"TABLE: {name}\n"
        + "\n".join(col_lines)
        + (f"\nTRIGGERS: {', '.join(triggers)}" if triggers else "")
    )


def _sp_summary(name: str, meta: dict, max_chars: int = 6000) -> str:
    code = (meta.get("code") or "")[:max_chars]
    return f"STORED PROCEDURE: {name}\n```sql\n{code}\n```"


def _trigger_summary(name: str, meta: dict, max_chars: int = 4000) -> str:
    code = (meta.get("code") or "")[:max_chars]
    table = meta.get("table", "")
    return f"TRIGGER: {name} (on {table})\n```sql\n{code}\n```"


# ── Pass 1: module classification ────────────────────────────────────────────

MODULE_HINT = """
Classify each table into one of: Inventario, Ventas, Compras, Tesorería, Fiscal, Sistema, Otros.
Return a JSON object mapping table_name -> module. No explanation, only JSON.
Table list:
{tables}
""".strip()


def pass1_classify(schema: dict) -> dict[str, str]:
    print("\n── Pass 1: Module classification ──")
    tables = list(schema["tables"].keys())
    batch_size = 80
    classification: dict[str, str] = {}

    for i in range(0, len(tables), batch_size):
        batch = tables[i: i + batch_size]
        prompt = MODULE_HINT.format(tables="\n".join(batch))
        raw = _call(ORCHESTRATOR_MODEL, ORCHESTRATOR_SYSTEM, prompt, max_tokens=2048)
        try:
            m = re.search(r"\{.*\}", raw, re.DOTALL)
            data = json.loads(m.group() if m else raw)
            classification.update(data)
        except Exception as e:
            print(f"    [!] JSON parse error in batch {i}: {e}")
        print(f"    classified {min(i + batch_size, len(tables))}/{len(tables)} tables")

    return classification


# ── Pass 2: implicit FK discovery ────────────────────────────────────────────

FK_PROMPT = """
Analyze the following stored procedures and triggers from Profit Plus 2k12.
Identify implicit foreign-key relationships by matching field name patterns
(e.g. co_cli in saFacturaVenta -> saCliente.co_cli).
Return a JSON array of objects with keys: from_table, from_column, to_table, to_column.
No explanation, only JSON array.

{code_chunks}
""".strip()


def pass2_implicit_fks(schema: dict) -> list[dict]:
    print("\n── Pass 2: Implicit FK discovery ──")
    chunks: list[str] = []
    for name, meta in list(schema["triggers"].items())[:30]:
        chunks.append(_trigger_summary(name, meta, 2000))
    for name, meta in list(schema["procedures"].items())[:20]:
        chunks.append(_sp_summary(name, meta, 2000))

    combined = "\n\n".join(chunks)
    raw = _call(ORCHESTRATOR_MODEL, ORCHESTRATOR_SYSTEM,
                FK_PROMPT.format(code_chunks=combined[:12000]), max_tokens=3000)
    try:
        m = re.search(r"\[.*\]", raw, re.DOTALL)
        return json.loads(m.group() if m else "[]")
    except Exception as e:
        print(f"    [!] JSON parse error: {e}")
        return []


# ── Pass 3 + 4: per-table subagent docs ──────────────────────────────────────

TABLE_PROMPT = """
Analyze this Profit Plus 2k12 table and produce Markdown documentation.
Module: {module}
Implicit FKs discovered: {implicit_fks}

{table_summary}
""".strip()


def pass3_table_docs(
    schema: dict,
    classification: dict[str, str],
    implicit_fks: list[dict],
    docs_dir: Path,
) -> None:
    print("\n── Pass 3+4: Generating table docs ──")
    tables_dir = docs_dir / "tables"
    tables_dir.mkdir(parents=True, exist_ok=True)

    fk_index: dict[str, list[dict]] = {}
    for fk in implicit_fks:
        fk_index.setdefault(fk.get("from_table", ""), []).append(fk)

    tables = list(schema["tables"].items())
    for idx, (name, meta) in enumerate(tables, 1):
        out_path = tables_dir / f"{name}.md"
        if out_path.exists():
            print(f"    [{idx}/{len(tables)}] {name} — skip (exists)")
            continue

        module = classification.get(name, "Otros")
        fks = fk_index.get(name, [])
        prompt = TABLE_PROMPT.format(
            module=module,
            implicit_fks=json.dumps(fks, ensure_ascii=False),
            table_summary=_table_summary(name, meta),
        )
        md = _call(SUBAGENT_MODEL, SUBAGENT_SYSTEM, prompt, max_tokens=2048)
        out_path.write_text(md, encoding="utf-8")
        print(f"    [{idx}/{len(tables)}] {name} → docs/tables/{name}.md")
        time.sleep(0.1)  # stay within rate limits


def pass3_sp_docs(schema: dict, docs_dir: Path) -> None:
    print("\n── Pass 3+4: Generating SP docs ──")
    sps_dir = docs_dir / "procedures"
    sps_dir.mkdir(parents=True, exist_ok=True)

    sps = list(schema["procedures"].items())
    for idx, (name, meta) in enumerate(sps, 1):
        out_path = sps_dir / f"{name}.md"
        if out_path.exists():
            print(f"    [{idx}/{len(sps)}] {name} — skip (exists)")
            continue

        prompt = _sp_summary(name, meta)
        md = _call(SUBAGENT_MODEL, SUBAGENT_SYSTEM, prompt, max_tokens=2048)
        out_path.write_text(md, encoding="utf-8")
        print(f"    [{idx}/{len(sps)}] {name} → docs/procedures/{name}.md")
        time.sleep(0.1)


def pass3_trigger_docs(schema: dict, docs_dir: Path) -> None:
    print("\n── Pass 3+4: Generating trigger docs ──")
    trg_dir = docs_dir / "triggers"
    trg_dir.mkdir(parents=True, exist_ok=True)

    triggers = list(schema["triggers"].items())
    for idx, (name, meta) in enumerate(triggers, 1):
        out_path = trg_dir / f"{name}.md"
        if out_path.exists():
            print(f"    [{idx}/{len(triggers)}] {name} — skip (exists)")
            continue

        prompt = _trigger_summary(name, meta)
        md = _call(SUBAGENT_MODEL, SUBAGENT_SYSTEM, prompt, max_tokens=2048)
        out_path.write_text(md, encoding="utf-8")
        print(f"    [{idx}/{len(triggers)}] {name} → docs/triggers/{name}.md")
        time.sleep(0.1)


# ── Index ────────────────────────────────────────────────────────────────────

def write_index(schema: dict, classification: dict[str, str], docs_dir: Path) -> None:
    print("\n── Writing index ──")
    by_module: dict[str, list[str]] = {}
    for t, mod in classification.items():
        by_module.setdefault(mod, []).append(t)

    lines = ["# Profit Plus 2k12 — Schema Index\n"]
    lines.append(f"**Tables**: {len(schema['tables'])}  |  "
                 f"**Stored Procedures**: {len(schema['procedures'])}  |  "
                 f"**Triggers**: {len(schema['triggers'])}\n")

    for module in sorted(by_module):
        lines.append(f"\n## {module}\n")
        for t in sorted(by_module[module]):
            lines.append(f"- [{t}](tables/{t}.md)")

    lines.append("\n## Stored Procedures\n")
    for sp in sorted(schema["procedures"]):
        lines.append(f"- [{sp}](procedures/{sp}.md)")

    lines.append("\n## Triggers\n")
    for trg in sorted(schema["triggers"]):
        lines.append(f"- [{trg}](triggers/{trg}.md)")

    index_path = docs_dir / "INDEX.md"
    index_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"    → {index_path}")


# ── Entry point ──────────────────────────────────────────────────────────────

def main() -> None:
    _load_dotenv()

    parser = argparse.ArgumentParser(description="Orchestrate Profit Plus doc generation")
    parser.add_argument("--schema", default="profit_schema.json")
    parser.add_argument("--docs", default="docs/")
    parser.add_argument("--skip-sps", action="store_true",
                        help="Skip stored procedure docs (saves tokens)")
    parser.add_argument("--skip-triggers", action="store_true",
                        help="Skip trigger docs")
    args = parser.parse_args()

    if "ANTHROPIC_API_KEY" not in os.environ:
        sys.exit("ANTHROPIC_API_KEY not set")

    schema_path = Path(args.schema)
    if not schema_path.exists():
        sys.exit(f"Schema file not found: {schema_path}\n"
                 "Run extract_schema.py first.")

    print(f"[*] Loading {schema_path}…")
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    docs_dir = Path(args.docs)
    docs_dir.mkdir(parents=True, exist_ok=True)

    classification = pass1_classify(schema)
    implicit_fks = pass2_implicit_fks(schema)

    pass3_table_docs(schema, classification, implicit_fks, docs_dir)
    if not args.skip_sps:
        pass3_sp_docs(schema, docs_dir)
    if not args.skip_triggers:
        pass3_trigger_docs(schema, docs_dir)

    write_index(schema, classification, docs_dir)
    print("\n[✔] Documentation complete →", docs_dir.resolve())


if __name__ == "__main__":
    main()
