# -- Build frontend --
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
COPY schema.graphql /app/schema.graphql
RUN npm run codegen && npm run build

# -- Build backend --
FROM rust:1-alpine AS backend
RUN apk add --no-cache musl-dev pkgconf openssl-dev openssl-libs-static
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY crates/ crates/
# No stub-crate dependency cache here: cargo judges freshness by mtime, so a
# prebuilt stub can survive the real COPY and ship a do-nothing binary. Reach
# for cargo-chef if the full rebuild per push becomes a problem.
RUN cargo build --release -p kent-api

# -- Runtime --
FROM alpine:3.21
RUN apk add --no-cache ca-certificates wget \
    && adduser -S -u 10001 kent
COPY --from=backend /app/target/release/kent-api /usr/local/bin/kent-api
COPY --from=frontend /app/frontend/dist /srv/dist

ENV PORT=8080 \
    STATIC_DIR=/srv/dist \
    RUST_LOG=kent_api=info,kent_domain=info,kent_db=info

EXPOSE 8080
USER kent

# Lets compose gate dependents on `condition: service_healthy`.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1

ENTRYPOINT ["kent-api"]
