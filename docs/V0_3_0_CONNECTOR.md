# v0.3.0 — ArchĒ Sidecar Connector Prep

This upgrade adds a safe connector path between the internal-ai-server sidecar and the main `arche-backend` project without automatically merging runtime behavior.

## New endpoints

- `GET /bridge/arche/status`
- `GET /bridge/arche/status?ping=true`
- `POST /bridge/arche/export`
- `GET /bridge/outbox`
- `GET /bridge/outbox/:bridge_id`
- `POST /bridge/outbox/:bridge_id/mark-imported`
- `POST /bridge/arche/push`

## Safety rule

`POST /bridge/arche/push` is blocked unless `AI_ALLOW_ARCHE_PUSH=true` is set in the environment. If pushing is blocked, the server creates a manual outbox item instead.

## Default connection

- `ARCHE_BACKEND_URL=http://127.0.0.1:3000`
- `ARCHE_IMPORT_PATH=/internal/sidecar/import`

The main ArchĒ backend must later implement the import path before live push should be used.
