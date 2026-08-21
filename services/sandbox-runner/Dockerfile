FROM python:3.12-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        git curl ca-certificates gnupg && \
    rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir ruff mypy semgrep
RUN npm install -g typescript eslint

COPY packages/rio-core /rio-core-src
RUN pip install --no-cache-dir /rio-core-src

# was missing entirely — sandbox-runner's own deps (fastapi, uvicorn)
COPY services/sandbox-runner /sandbox-runner-src
RUN pip install --no-cache-dir "fastapi[standard]" "uvicorn[standard]" -e /sandbox-runner-src

COPY services/sandbox-runner/app /home/sandbox/app
WORKDIR /home/sandbox

RUN useradd --create-home --shell /bin/bash sandbox
USER sandbox

EXPOSE 8001
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8001}"]