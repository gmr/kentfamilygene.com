# Kent Family & DNA Project

set dotenv-load

# List available recipes
default:
    @just --list

# Start Neo4j via Docker Compose
db:
    docker compose up -d

# Stop Neo4j
db-stop:
    docker compose down

# Build the Rust backend
build:
    cargo build

# Build in release mode
build-release:
    cargo build --release

# Run the API server
serve:
    cargo run -p kent-api -- serve

# Run the API server in release mode
serve-release:
    cargo run -p kent-api --release -- serve

# Import extracted JSON data into Neo4j
import file:
    cargo run -p kent-api -- import --file {{file}}

# Import FTDNA source HTML into Neo4j
import-html file:
    cargo run -p kent-api -- import-html --file {{file}}

# Dry-run HTML import (parse only, no DB writes)
import-html-dry file:
    cargo run -p kent-api -- import-html --file {{file}} --dry-run

# Run all tests
test:
    cargo test

# Run integration tests (requires Docker)
test-integration:
    cargo test -p kent-db --test integration

# Run privacy tests
test-privacy:
    cargo test -p kent-domain --test privacy_test

# Run clippy lints
clippy:
    cargo clippy --workspace -- -D warnings

# Check compilation without building
check:
    cargo check --workspace

# Format Rust code
fmt:
    cargo fmt --all

# Check Rust formatting
fmt-check:
    cargo fmt --all -- --check

# Install frontend dependencies
fe-install:
    cd frontend && npm install

# Generate frontend GraphQL types
fe-codegen:
    cd frontend && npm run codegen

# Build the frontend
fe-build:
    cd frontend && npm run codegen && npm run build

# Run the frontend dev server
fe-dev:
    cd frontend && npm run dev

# Build everything (backend + frontend)
build-all: build fe-build

# Clean Rust build artifacts
clean:
    cargo clean

# Full CI check (fmt, clippy, test, frontend build)
ci: fmt-check clippy test fe-build
