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
RUN cargo build --release -p kent-api

# -- Runtime --
FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=backend /app/target/release/kent-api /usr/local/bin/kent-api
COPY --from=frontend /app/frontend/dist /srv/dist

ENV PORT=8080 \
    STATIC_DIR=/srv/dist \
    RUST_LOG=kent_api=info,kent_domain=info,kent_db=info

EXPOSE 8080
ENTRYPOINT ["kent-api"]
