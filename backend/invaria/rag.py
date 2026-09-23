"""Small trusted corpus with PostgreSQL cosine retrieval and honest local fallback."""

import json

from sqlalchemy import text

from .config import settings
from .reasoning import GUIDANCE, embed, retrieve
from .storage import engine


def index_knowledge():
    if engine.dialect.name != "postgresql":
        return {
            "mode": "curated-category",
            "documents": len(GUIDANCE),
            "message": "Vector indexing requires PostgreSQL. Curated guidance is available locally.",
        }
    vectors = embed([g["text"] for g in GUIDANCE])
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS knowledge_chunks (id text PRIMARY KEY, model text NOT NULL, payload jsonb NOT NULL, embedding vector(768) NOT NULL)"
            )
        )
        for doc, vector in zip(GUIDANCE, vectors):
            conn.execute(
                text(
                    "INSERT INTO knowledge_chunks VALUES (:id, :model, CAST(:payload AS jsonb), CAST(:embedding AS vector)) ON CONFLICT (id) DO UPDATE SET model=EXCLUDED.model,payload=EXCLUDED.payload,embedding=EXCLUDED.embedding"
                ),
                {
                    "id": doc["id"],
                    "model": settings.embedding_model,
                    "payload": json.dumps(doc),
                    "embedding": json.dumps(vector),
                },
            )
    return {"mode": "pgvector", "documents": len(GUIDANCE), "model": settings.embedding_model}


def guidance_for(finding):
    if engine.dialect.name == "postgresql":
        try:
            vector = embed([finding.title + ": " + finding.summary])[0]
            with engine.connect() as conn:
                rows = conn.execute(
                    text(
                        "SELECT payload FROM knowledge_chunks WHERE model=:model ORDER BY embedding <=> CAST(:embedding AS vector) LIMIT 2"
                    ),
                    {"model": settings.embedding_model, "embedding": json.dumps(vector)},
                ).all()
            if rows:
                return [r[0] for r in rows], "pgvector"
        except Exception:
            pass  # Caller receives explicit retrieval mode, not a fake vector result.
    return retrieve(finding.category), "curated-category"
