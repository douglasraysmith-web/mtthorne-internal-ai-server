# v0.5.0 Durable Queue, Trace Finalization, and Replayable Workflows

This release turns the internal AI server from a working orchestrator into a more reliable workflow engine.

## Added

- Durable queue lifecycle states: `queued`, `running`, `completed`, `blocked`, `failed`, `dead_letter`, `needs_owner_review`, and `replay_requested`.
- Replayable workflow support with `POST /queue/:id/replay`.
- Dead-letter visibility with `GET /queue/dead-letter`.
- Trace finalization with terminal statuses: `completed`, `failed`, `blocked`, `needs_owner_review`, `abandoned`, and `expired`.
- Stuck-trace repair with `POST /traces/repair`.
- Open-trace inspection with `GET /traces/open`.
- Failed job fields: `failed_at`, `failure_reason`, `repair_hint`, and `replay_safe`.

## Safety boundary

This release does not activate public chat, provider dispatch, customer-data access, payment/account access, or automatic import into `arche-backend`.
