# v0.6.0 Storage Adapter Layer

v0.6.0 keeps JSON files as the default storage engine, but moves the system behind a clean storage boundary so a real database can be connected later without rewriting AI routes, lanes, queue, memory, traces, source manifests, or release gates.

## New endpoints

- `GET /storage/status`
- `GET /storage/check`
- `GET /storage/migration-plan`

## Current driver

- Active: `json_file`
- Atomic writes: yes
- Database connected: no
- Database-ready boundary: yes

## Safety state

Public chat, provider dispatch, customer-data access, payment/account access, and automatic ArchE import remain inactive unless explicitly approved later.

## Database switch rule

Do not switch storage drivers until:

1. Current data folder is backed up.
2. `npm test` passes.
3. `/storage/check` passes.
4. Queue and replay pass.
5. Release gate still blocks unsafe release.
6. Owner explicitly approves the persistent production data switch.
