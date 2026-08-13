"""
index_docs_rag.py — Index /docs Markdown files into Qdrant using FastEmbed.

Usage:
    python scripts/index_docs_rag.py [--docs docs/] [--collection profit_docs]
                                     [--qdrant-url http://localhost:6333]
                                     [--model BAAI/bge-m3]

The script is idempotent: it upserts by a deterministic point ID derived from
(file path, chunk index), so re-running after adding new docs is safe.

Run Qdrant first:
    docker compose -f docker/docker-compose.qdrant.yml up -d
"""

import argparse
import hashlib
import sys
from pathlib import Path


VECTOR_SIZES = {
    "BAAI/bge-small-en-v1.5": 384,
    "BAAI/bge-m3": 1024,
    "jinaai/jina-embeddings-v2-base-es": 768,
    "intfloat/multilingual-e5-large": 1024,
    "sentence-transformers/paraphrase-multilingual-mpnet-base-v2": 768,
}


def _chunk_markdown(text: str) -> list[str]:
    """Split at ## headings; keep each chunk under ~1500 chars."""
    raw_chunks = text.split("\n## ")
    chunks: list[str] = []
    for i, part in enumerate(raw_chunks):
        full = ("## " + part) if i > 0 else part
        if len(full) <= 1500:
            chunks.append(full.strip())
        else:
            # Further split at paragraph boundaries
            paragraphs = full.split("\n\n")
            buf = ""
            for para in paragraphs:
                if len(buf) + len(para) > 1400 and buf:
                    chunks.append(buf.strip())
                    buf = para
                else:
                    buf = (buf + "\n\n" + para).strip()
            if buf:
                chunks.append(buf.strip())
    return [c for c in chunks if c]


def _stable_id(file_path: str, chunk_idx: int) -> int:
    """Deterministic uint64-safe integer ID from path + index."""
    key = f"{file_path}::{chunk_idx}"
    return int(hashlib.sha256(key.encode()).hexdigest()[:15], 16)


def index_docs(docs_dir: Path, collection: str, qdrant_url: str, model_name: str) -> None:
    try:
        from fastembed import TextEmbedding
    except ImportError:
        sys.exit("fastembed not installed. Run: pip install fastembed")
    try:
        from qdrant_client import QdrantClient
        from qdrant_client.models import Distance, PointStruct, VectorParams
    except ImportError:
        sys.exit("qdrant-client not installed. Run: pip install qdrant-client")

    vector_size = VECTOR_SIZES.get(model_name)
    if vector_size is None:
        sys.exit(f"Unknown model '{model_name}'. Supported: {list(VECTOR_SIZES)}")

    print(f"[*] Loading embedding model: {model_name}…")
    embedder = TextEmbedding(model_name=model_name)

    print(f"[*] Connecting to Qdrant at {qdrant_url}…")
    client = QdrantClient(url=qdrant_url)

    if not client.collection_exists(collection):
        print(f"[+] Creating collection '{collection}'…")
        client.create_collection(
            collection_name=collection,
            vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
        )
    else:
        print(f"[*] Collection '{collection}' already exists — upserting")

    md_files = list(docs_dir.rglob("*.md"))
    if not md_files:
        sys.exit(f"No .md files found in {docs_dir}. Run orchestrate_docs.py first.")

    print(f"[+] Indexing {len(md_files)} files…")

    points: list[PointStruct] = []
    total_chunks = 0

    for filepath in sorted(md_files):
        text = filepath.read_text(encoding="utf-8")
        chunks = _chunk_markdown(text)
        rel_path = str(filepath.relative_to(docs_dir.parent))

        texts = [c for c in chunks if c]
        if not texts:
            continue

        vectors = list(embedder.embed(texts))

        for chunk_idx, (chunk_text, vector) in enumerate(zip(texts, vectors)):
            points.append(
                PointStruct(
                    id=_stable_id(rel_path, chunk_idx),
                    vector=vector.tolist(),
                    payload={
                        "path": rel_path,
                        "chunk_idx": chunk_idx,
                        "text": chunk_text,
                    },
                )
            )
            total_chunks += 1

        # Upsert in batches of 100
        if len(points) >= 100:
            client.upsert(collection_name=collection, points=points)
            points = []

    if points:
        client.upsert(collection_name=collection, points=points)

    print(f"[✔] Done. Collection '{collection}': {total_chunks} chunks from {len(md_files)} files")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Index /docs into Qdrant for RAG")
    parser.add_argument("--docs", default="docs/")
    parser.add_argument("--collection", default="profit_docs")
    parser.add_argument("--qdrant-url", default="http://localhost:6333")
    parser.add_argument("--model", default="BAAI/bge-m3",
                        choices=list(VECTOR_SIZES), help="Embedding model")
    args = parser.parse_args()

    index_docs(
        docs_dir=Path(args.docs),
        collection=args.collection,
        qdrant_url=args.qdrant_url,
        model_name=args.model,
    )
