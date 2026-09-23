"""Opt-in integration check against the local Compose PostgreSQL instance."""

import os
import subprocess
import sys

import pytest


@pytest.mark.skipif(
    not os.environ.get("INVARIA_TEST_POSTGRES_URL"),
    reason="Set INVARIA_TEST_POSTGRES_URL to test PostgreSQL + live EmbeddingGemma",
)
def test_postgres_vector_and_scan_roundtrip():
    env = {**os.environ, "INVARIA_DATABASE_URL": os.environ["INVARIA_TEST_POSTGRES_URL"]}
    script = """
from invaria.storage import init_db, database_health, Session, Scan
from invaria.rag import index_knowledge, guidance_for
from invaria.engine import analyze
from invaria.ingestion import inventory, FIXTURES
init_db(recover=False)
assert database_health() == 'postgresql'
assert index_knowledge()['mode'] == 'pgvector'
finding = analyze(inventory(FIXTURES / 'bola-vulnerable')[0])['findings'][0]
guidance, mode = guidance_for(finding)
assert mode == 'pgvector'
assert any(g['category'] == 'authorization' for g in guidance)
print('PostgreSQL + EmbeddingGemma cosine retrieval passed')
"""
    result = subprocess.run(
        [sys.executable, "-c", script], env=env, text=True, capture_output=True, timeout=120, check=False
    )
    assert result.returncode == 0, result.stderr
