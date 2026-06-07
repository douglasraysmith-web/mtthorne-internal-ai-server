# v0.4.0 — Typed Contracts, Trace IDs, Memory Layers, and Release Gate

This upgrade applies the high-performance multi-agent blueprint without adding heavyweight infrastructure yet.

## Added

- Typed message contract layer: `typed_message_contract_v0_4_0`
- Trace log layer: `trace_log_v0_4_0`
- Memory layer split: `working_memory`, `episodic_memory`, `semantic_memory_manifest`, `verified_sources`
- Risk-tier routing: low, medium, high, release, blocked
- Speed-mode routing: fast, balanced, deep, round_table
- Release gate endpoint: `/release/check`
- Contract validation endpoint: `/contract/validate`
- Trace endpoints: `/traces`, `/traces/:trace_id`
- Memory endpoints: `/memory`, `/memory/:layer`

## Safety state

- Public chat remains inactive until explicit approval.
- Provider dispatch remains inactive unless explicitly enabled.
- ArchE push remains blocked unless explicitly enabled.
- Long-term memory writes require validation.
- Release checks require owner approval before public/runtime activation.

## New endpoints

```text
POST /contract/validate
GET  /traces
GET  /traces/:trace_id
GET  /memory
GET  /memory/:layer
POST /memory/:layer
POST /release/check
```

## Install

Replace only the `internal-ai-server` sidecar folder, not `arche-backend`.

```bash
cd ~/Downloads
mv internal-ai-server internal-ai-server-v0_3_0-backup
unzip internal-ai-server-v0_4_0.zip
cd internal-ai-server
npm install
npm test
npm start
```

## Test targets

```text
http://127.0.0.1:8787/health
http://127.0.0.1:8787/memory
http://127.0.0.1:8787/traces
```
