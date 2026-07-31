# syntax=docker/dockerfile:1

# ── Frontend ───────────────────────────────────────────────────────
# src/generated/ is gitignored, so codegen has to run here. It reads
# ../schema.graphql, which is why the whole repo root is the build context.
FROM node:22-slim AS frontend

WORKDIR /build

COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci

COPY schema.graphql ./
COPY frontend/ ./frontend/
RUN cd frontend && npm run codegen && npm run build

# ── Backend ────────────────────────────────────────────────────────
FROM rust:1-slim-bookworm AS backend

WORKDIR /build

# Cache dependency compilation: build stub crates first so the expensive
# dependency layer only rebuilds when the manifests change.
COPY Cargo.toml Cargo.lock ./
COPY crates/kent-db/Cargo.toml ./crates/kent-db/
COPY crates/kent-domain/Cargo.toml ./crates/kent-domain/
COPY crates/kent-api/Cargo.toml ./crates/kent-api/
RUN mkdir -p crates/kent-db/src crates/kent-domain/src crates/kent-api/src \
    && echo 'pub fn stub() {}' > crates/kent-db/src/lib.rs \
    && echo 'pub fn stub() {}' > crates/kent-domain/src/lib.rs \
    && echo 'fn main() {}' > crates/kent-api/src/main.rs \
    && cargo build --release --locked \
    && rm -rf crates/*/src

COPY crates/ ./crates/
# Cargo skips rebuilding when mtimes look unchanged; the stub removal above
# plus this touch guarantees the real sources compile.
RUN touch crates/*/src/lib.rs crates/kent-api/src/main.rs 2>/dev/null || true
RUN cargo build --release --locked --bin kent-api

# ── Runtime ────────────────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --create-home --uid 10001 kent

WORKDIR /app

COPY --from=backend /build/target/release/kent-api /usr/local/bin/kent-api
COPY --from=frontend /build/frontend/dist ./dist

ENV PORT=8080 \
    STATIC_DIR=/app/dist \
    RUST_LOG=kent_api=info,kent_domain=info,kent_db=info

# NEO4J_PASSWORD and ADMIN_PASSWORD have no defaults and the server panics
# without them — supply both at run time. Never bake them into the image.
EXPOSE 8080

USER kent

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -fsS "http://localhost:${PORT}/health" || exit 1

CMD ["kent-api"]
