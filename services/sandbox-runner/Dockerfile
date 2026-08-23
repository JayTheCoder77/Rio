FROM python:3.12-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# ruff is the only linter actually wired to an endpoint (see app/main.py) —
# mypy/semgrep were installed here before but never called anywhere, and
# node/npm/eslint/typescript are gone entirely now that JS/TS support was
# dropped (a shipped eslint.config.js usually imports plugins this image
# doesn't have, so it silently no-op'd rather than actually linted).
RUN pip install --no-cache-dir ruff

COPY packages/rio-core /rio-core-src
RUN pip install --no-cache-dir /rio-core-src

COPY services/sandbox-runner /sandbox-runner-src
RUN pip install --no-cache-dir "fastapi[standard]" "uvicorn[standard]" -e /sandbox-runner-src

COPY services/sandbox-runner/app /home/sandbox/app
WORKDIR /home/sandbox

RUN useradd --create-home --shell /bin/bash sandbox
USER sandbox

EXPOSE 8001
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8001}"]