FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/
WORKDIR /repo

COPY pyproject.toml uv.lock .python-version ./
COPY packages/rio-core packages/rio-core
COPY services/ai-engine services/ai-engine

RUN uv sync --frozen --package ai-engine

WORKDIR /repo/services/ai-engine
EXPOSE 8000

CMD ["sh", "-c", "/repo/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]