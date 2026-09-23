FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 INVARIA_FIXTURE_DIR=/app/fixtures
RUN apt-get update && apt-get install -y --no-install-recommends antiword git && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml requirements.lock ./
COPY backend ./backend
COPY fixtures ./fixtures
RUN pip install -r requirements.lock && pip install --no-deps .
RUN python -m venv /opt/semgrep && /opt/semgrep/bin/pip install 'semgrep==1.136.0' && ln -s /opt/semgrep/bin/semgrep /usr/local/bin/semgrep
RUN useradd --create-home --uid 10001 scanner && mkdir -p /app/.data && chown scanner:scanner /app/.data
USER scanner
EXPOSE 8000
CMD ["uvicorn", "invaria.api:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
