from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="INVARIA_", extra="ignore")
    database_url: str = "sqlite:///./.data/invaria.db"
    data_dir: Path = Path(".data")
    fixture_dir: Path = ROOT / "fixtures"
    ollama_url: str = "http://127.0.0.1:11434"
    reasoning_model: str = "gemma4:e4b"
    embedding_model: str = "embeddinggemma"
    model_timeout: int = 180
    semgrep_enabled: bool = True
    max_files: int = 2000
    max_file_bytes: int = 500_000
    max_total_bytes: int = 20_000_000
    max_repo_bytes: int = 100_000_000
    max_documents: int = 10
    max_document_bytes: int = 8_000_000
    max_document_total_bytes: int = 25_000_000
    max_document_characters: int = 750_000
    document_timeout: int = 45
    # Local developer tool. A token is required before binding beyond loopback.
    api_token: str = ""
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]


settings = Settings()
