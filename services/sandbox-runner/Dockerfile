FROM python:3.12-slim

# git

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        git \
        curl \
        ca-certificates \
        gnupg && \
    rm -rf /var/lib/apt/lists/*

# node js
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install Python tooling
RUN pip install --no-cache-dir \
        ruff \
        mypy \
        semgrep

# Install global Node tooling
RUN npm install -g \
        typescript \
        eslint

COPY packages/rio-core /rio-core-src
RUN pip install /rio-core-src

COPY services/sandbox-runner/app /home/sandbox/app

WORKDIR /home/sandbox

RUN useradd --create-home --shell /bin/bash sandbox
USER sandbox
