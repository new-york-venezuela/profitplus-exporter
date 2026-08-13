"""
mcp-server/server.py — MCP server exposing Profit Plus RAG tools to Claude Code.

Tools:
  search_profit_docs(query)        Semantic search over /docs
  get_table_schema(table_name)     Return full Markdown doc for a table
  get_sql_recipe(intent)           Find pre-written SQL recipes by intent

Start:
    python mcp-server/server.py

Or via Claude Code settings (claude_desktop_config.json / .claude/settings.json):
    {
      "mcpServers": {
        "profit-rag": {
          "command": "python",
          "args": ["mcp-server/server.py"],
          "env": {
            "QDRANT_URL": "http://localhost:6333",
            "COLLECTION_NAME": "profit_docs",
            "DOCS_DIR": "docs/"
          }
        }
      }
    }
"""

import os
import sys
from pathlib import Path

# Resolve project root (parent of mcp-server/)
_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(_ROOT))


def _load_dotenv() -> None:
    try:
        from dotenv import load_dotenv
        for name in (".env.local", ".env"):
            p = _ROOT / name
            if p.exists():
                load_dotenv(p)
                break
    except ImportError:
        pass


_load_dotenv()

QDRANT_URL = os.environ.get("QDRANT_URL", "http://localhost:6333")
COLLECTION = os.environ.get("COLLECTION_NAME", "profit_docs")
DOCS_DIR = Path(os.environ.get("DOCS_DIR", str(_ROOT / "docs")))
EMBED_MODEL = os.environ.get("EMBED_MODEL", "jinaai/jina-embeddings-v2-base-es")

try:
    import mcp.server.stdio
    from mcp.server import Server
    from mcp.types import TextContent, Tool
except ImportError:
    sys.exit("mcp not installed. Run: pip install mcp")

try:
    from fastembed import TextEmbedding
except ImportError:
    sys.exit("fastembed not installed. Run: pip install fastembed")

try:
    from qdrant_client import QdrantClient
except ImportError:
    sys.exit("qdrant-client not installed. Run: pip install qdrant-client")


# ── Lazy singletons ──────────────────────────────────────────────────────────

_embedder: "TextEmbedding | None" = None
_qdrant: "QdrantClient | None" = None


def _get_embedder() -> "TextEmbedding":
    global _embedder
    if _embedder is None:
        _embedder = TextEmbedding(model_name=EMBED_MODEL)
    return _embedder


def _get_qdrant() -> "QdrantClient":
    global _qdrant
    if _qdrant is None:
        _qdrant = QdrantClient(url=QDRANT_URL)
    return _qdrant


# ── Tool implementations ─────────────────────────────────────────────────────

def _embed(text: str) -> list[float]:
    return list(_get_embedder().embed([text]))[0].tolist()


def search_profit_docs(query: str, limit: int = 5) -> str:
    """Semantic search over indexed Profit Plus documentation."""
    vector = _embed(query)
    response = _get_qdrant().query_points(
        collection_name=COLLECTION,
        query=vector,
        limit=limit,
        with_payload=True,
    )
    hits = response.points
    if not hits:
        return "No results found."

    parts: list[str] = []
    for hit in hits:
        payload = hit.payload or {}
        score = round(hit.score, 3)
        path = payload.get("path", "")
        text = payload.get("text", "")
        parts.append(f"**[score={score}] {path}**\n{text}")
    return "\n\n---\n\n".join(parts)


def get_table_schema(table_name: str) -> str:
    """Return the full Markdown documentation for a specific table."""
    # Try exact match first
    candidates = [
        DOCS_DIR / "tables" / f"{table_name}.md",
        DOCS_DIR / "tables" / f"{table_name.lower()}.md",
    ]
    for path in candidates:
        if path.exists():
            return path.read_text(encoding="utf-8")

    # Fall back to semantic search
    return search_profit_docs(f"tabla {table_name} schema columns", limit=3)


def get_sql_recipe(intent: str) -> str:
    """Find pre-written SQL recipes matching a business intent."""
    # Search with SQL-focused query
    query = f"SQL recipe query {intent} recetario"
    vector = _embed(query)
    response = _get_qdrant().query_points(
        collection_name=COLLECTION,
        query=vector,
        limit=8,
        with_payload=True,
    )

    sql_parts: list[str] = []
    for hit in response.points:
        text = (hit.payload or {}).get("text", "")
        # Extract SQL blocks
        if "```sql" in text.lower():
            sql_parts.append(f"[from {(hit.payload or {}).get('path', '')}]\n{text}")

    if sql_parts:
        return "\n\n---\n\n".join(sql_parts[:4])
    return search_profit_docs(intent, limit=4)


# ── MCP server setup ─────────────────────────────────────────────────────────

app = Server("profit-rag")

TOOLS = [
    Tool(
        name="search_profit_docs",
        description=(
            "Semantic search over Profit Plus 2k12 documentation (tables, "
            "stored procedures, triggers, workflows). Use for general questions "
            "about schema, business logic, or module behavior."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Natural language search query"},
                "limit": {"type": "integer", "default": 5, "description": "Number of results"},
            },
            "required": ["query"],
        },
    ),
    Tool(
        name="get_table_schema",
        description=(
            "Return the full schema documentation for a specific Profit Plus table, "
            "including columns, triggers, stored procedures, and SQL recipes."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "table_name": {"type": "string", "description": "Exact table name (e.g. saFacturaVenta)"},
            },
            "required": ["table_name"],
        },
    ),
    Tool(
        name="get_sql_recipe",
        description=(
            "Find pre-built SQL queries for common Profit Plus reporting tasks: "
            "retenciones, libros de ventas/compras, cuentas por cobrar, saldos USD, inventario."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "intent": {"type": "string", "description": "Describe what you want to query (e.g. 'saldo pendiente por cliente en USD')"},
            },
            "required": ["intent"],
        },
    ),
]


@app.list_tools()
async def list_tools():
    return TOOLS


@app.call_tool()
async def call_tool(name: str, arguments: dict):
    try:
        if name == "search_profit_docs":
            result = search_profit_docs(
                query=arguments["query"],
                limit=arguments.get("limit", 5),
            )
        elif name == "get_table_schema":
            result = get_table_schema(arguments["table_name"])
        elif name == "get_sql_recipe":
            result = get_sql_recipe(arguments["intent"])
        else:
            result = f"Unknown tool: {name}"
    except Exception as e:
        result = f"Error: {e}"

    return [TextContent(type="text", text=result)]


if __name__ == "__main__":
    import asyncio
    asyncio.run(mcp.server.stdio.stdio_server(app))
