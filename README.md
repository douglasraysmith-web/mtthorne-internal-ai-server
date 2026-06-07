# MT Thorne Internal AI Server

Internal owner-only server for the MT Thorne AI operating table.

## Operating Table

Primary AIs:

1. ArchĒ
2. AV.AI
3. V-Lock AI
4. The Janitor

Round-table lanes:

1. Source-Lock
2. Builder
3. Verifier
4. Error-Ledger
5. Speed Router
6. Quality Judge
7. Security / Privacy

Total operating seats: 11.

ArchĒAngel is an escalation mode under ArchĒ. WarLock is an escalation coordinator under V-Lock AI. They are not counted as separate primary AIs.

## Run

```bash
npm install
npm test
npm start
```

Default local server:

```text
http://127.0.0.1:8787
```

## Core endpoints

```text
GET  /health
GET  /rooms
GET  /sources
GET  /errors
POST /decision
GET  /decision/history
POST /contamination
GET  /queue
POST /queue
GET  /queue/:id
POST /queue/:id/process
GET  /transfers
POST /transfers
POST /transfers/approve
POST /bridge/arche
```

## Example decision

```bash
curl -X POST http://127.0.0.1:8787/decision \
  -H "Content-Type: application/json" \
  -d '{"request":"A customer asks after hours about a publishing order problem and wants payment account help.","project_id":"room_janitor_client_reply"}'
```

## Example queue job

```bash
curl -X POST http://127.0.0.1:8787/queue \
  -H "Content-Type: application/json" \
  -d '{"request":"Prepare a deploy-worthy milestone without public chat activation.","project_id":"room_arche_site"}'
```

## Example contamination check

```bash
curl -X POST http://127.0.0.1:8787/contamination \
  -H "Content-Type: application/json" \
  -d '{"project_id":"room_vlock_images","sources":["redrawn_brand_marks"]}'
```

## Safety state

This package does not activate public chat, provider dispatch, payment handling, customer-data access, or live runtime behavior. It is file-backed and database-ready.


## v1.0.0 Sidecar Connector

The internal-ai-server remains a sidecar beside `arche-backend`; it does not replace the main backend. v0.5.1 adds bridge outbox and connector-prep endpoints. Push is blocked unless `AI_ALLOW_ARCHE_PUSH=true` is explicitly set.

New endpoints:

```text
GET  /bridge/arche/status
GET  /bridge/arche/status?ping=true
POST /bridge/arche/export
GET  /bridge/outbox
GET  /bridge/outbox/:bridge_id
POST /bridge/outbox/:bridge_id/mark-imported
POST /bridge/arche/push
```

Default behavior is manual outbox export, not runtime merge.

## v0.5.1 Upgrade

Adds typed message contracts, trace IDs, risk-tier routing, speed-mode routing, separated memory layers, and a release gate. This keeps the current 4 primary AIs + 7 round-table lanes structure while moving the sidecar closer to a production-grade internal engine.

New endpoints:

```text
POST /contract/validate
GET  /traces
GET  /traces/:trace_id
GET  /memory
GET  /memory/:layer
POST /memory/:layer
POST /release/check
```

Safety defaults remain unchanged: public chat inactive, provider dispatch inactive, ArchE push disabled, customer/payment access inactive, and owner approval required for release.


## v0.5.1 Reliability Additions

- Durable queue lifecycle states
- Dead-letter queue listing
- Replayable queue jobs
- Trace finalization and stuck-trace repair
- Failed job repair hints


## v0.8.0 R2 + Existing-Service Readiness

Adds a Cloudflare R2-compatible object-storage adapter boundary and deployment readiness checks for the services already in use: GitHub, Railway, Netlify, R2, OpenAI, and Anthropic.

New endpoints:

```text
GET /r2/status
GET /r2/check
GET /r2/migration-plan
GET /deployment/readiness
GET /deployment/check
GET /deployment/plan
```

Default behavior remains local and safe: R2 is not connected, provider dispatch is inactive, public chat is inactive, and no new services are required for this stage.

## v0.9.0 Provider Dispatch Gate + Cost Cap

Adds safe gates for the OpenAI and Anthropic API keys the owner already has. This version does not perform real provider network calls. It only verifies readiness, estimates cost, blocks unsafe dispatch, tracks cost-gate state, and provides an emergency shutoff.

New endpoints:

```text
GET  /providers/status
GET  /providers/check
POST /providers/estimate
POST /providers/dispatch
GET  /cost/status
POST /cost/limit
POST /cost/emergency-stop
```

Default state:

```text
Provider dispatch: inactive
Emergency stop: on
Daily provider limit: 0
Network calls: not performed
```

A provider dispatch request is blocked unless the environment allows dispatch, emergency stop is off, a daily limit exists, the estimate is under the cap, provider key presence is confirmed, the boundary check passes, and owner approval is present when the job is high-risk or public-facing.


## v1.0.0 Stable Existing-Services Sidecar

This version adds owner-approval gates, provider dispatch logging, existing-services profile endpoints, Railway env planning, Netlify bridge contract, and a stable sidecar check. It still does not activate public chat, provider network calls, customer-data access, payment access, automatic ArchE import, or real R2 writes.
