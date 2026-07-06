# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A self-hosted genetic genealogy project management tool for the Kent Family & DNA Project. Tracks family lineages, links DNA test results to participants, maps haplogroup assignments, records genetic matches, and visualizes ancestor chains. Scale is ~90 lineages, ~350 participants, ~1000-1500 persons.

## Commands

### Backend (Rust workspace)
```bash
cargo build --all-targets              # build everything
cargo fmt --all -- --check             # format check (CI gate)
cargo clippy --all-targets --all-features -- -D warnings   # lint (CI gate; warnings are errors)

cargo test --workspace --exclude kent-db   # unit tests (no Docker needed)
cargo test -p kent-domain --test privacy_test   # privacy unit tests only
cargo test -p kent-db --test integration   # integration tests (REQUIRES Docker — spins up Neo4j via testcontainers)

cargo run -p kent-api                   # start API server (default subcommand: serve)
cargo run -p kent-api -- import --file data/extracted-data.json    # import extracted JSON
cargo run -p kent-api -- import-html --file source.html --dry-run  # parse FTDNA source HTML (dry-run prints JSON)
```
Local Neo4j: `docker compose up -d` (exposes bolt on 7687, browser on 7474). Copy `.env.example` to `.env` first — the server reads `NEO4J_URI/USER/PASSWORD`, `ADMIN_USERNAME/PASSWORD`, `PORT`, `STATIC_DIR`.

### Frontend (`frontend/`)
```bash
cd frontend
npm run codegen        # regenerate src/generated/graphql.ts from schema.graphql + src/graphql/*.graphql (gitignored; run before building)
npm run dev            # Vite dev server on :5173, proxies /graphql -> :8080
npx tsc --noEmit       # typecheck (CI gate)
npm run build          # production build to frontend/dist
```
CI runs codegen → tsc → build in that order; codegen output is not committed, so `tsc`/`build` fail without a prior `npm run codegen`.

Pre-commit hooks run `cargo fmt` and `cargo clippy` on Rust changes.

## Architecture

Three-crate Rust workspace + a React SPA. Data flows: Neo4j ← `kent-db` (queries) ← `kent-domain` (GraphQL schema) ← `kent-api` (HTTP/CLI) ← frontend (urql).

### `crates/kent-db` — Neo4j query layer
One module per entity (`lineage`, `person`, `participant`, `place`, `haplogroup`, `dna_test`, `online_tree`, `admin_note`, `relationship`, `search`). All `Row` structs live in `lib.rs`. Uses `neo4rs` 0.8; the graph handle is re-exported as `Neo4jGraph`. Note: `graph.execute()` returns a `DetachedRowStream` that must be bound (`let _ =`) even when not consumed.

### `crates/kent-domain` — GraphQL schema (async-graphql 7)
`build_schema(graph) -> KentSchema` (`Schema<QueryRoot, MutationRoot, EmptySubscription>`) with the Neo4j graph injected as context `.data()`. Layout:
- `types/` — one GraphQL type per entity, plus `enums.rs` and `connection.rs` (all list results use the `{ items, total, has_more }` connection shape)
- `query.rs` — public + admin queries; `mutation.rs` — all CRUD + relationship mutations
- `auth.rs` — `AuthContext`; admin queries/mutations call `require_auth()` as a guard
- `privacy.rs` — `mask_person()` enforces the 100-year living-person rule in public (unauthenticated) queries. This is the core privacy invariant; changes here are covered by `privacy_test.rs`.

### `crates/kent-api` — Axum server + CLI
`main.rs` defines a `clap` CLI with `serve` (default), `import` (extracted JSON via `import.rs`), and `import-html` (FTDNA HTML via `html_import/`) subcommands. Serves GraphQL, GraphiQL, and static frontend files (`ServeDir` from `STATIC_DIR`). Auth is HTTP Basic → `AuthContext`. The `html_import/` pipeline is staged: `parse_document` → `parse_lineage`/`parse_participant`/`parse_ancestor`/`parse_date` → `dedup` → `persist`.

### `frontend/` — admin SPA
Vite + React 18 + TypeScript + Tailwind v4 + shadcn/ui + urql + react-hook-form + zod v4 + react-router-dom v6. All routes live under `/admin/*` behind a `RequireAuth` guard; auth is Basic Auth held in `sessionStorage` and injected via a module-level ref. GraphQL operations are authored as `.graphql` files under `src/graphql/` (mutations/ and queries/) and compiled to typed hooks by graphql-codegen. `@/` aliases `src/`.

## Conventions

- Rust edition 2024 — `gen` is a reserved keyword.
- Entity IDs are UUID strings (v4/v5/v7 all in use; see the `uuid` features).
- `schema.graphql` at the repo root is the source of truth shared by the backend and frontend codegen — keep it in sync when changing `kent-domain` types.
- Design docs and PRDs live in `plans/`. `data/` is gitignored (holds `extracted-data.json` imports).
