# v0.7.0 Queue Adapter Layer

v0.7.0 adds a Redis-compatible queue adapter boundary while keeping the safe JSON-file queue as the only active driver.

## Active behavior

- Active queue driver: `json_file`
- Redis Streams: planned, not connected
- Provider dispatch: inactive unless explicitly enabled elsewhere
- Public chat: inactive
- Customer/payment data: inactive

## New endpoints

- `GET /queue/adapter/status`
- `GET /queue/adapter/check`
- `GET /queue/adapter/migration-plan`

## Why this exists

The multi-agent blueprint calls for Redis Streams/pub-sub later. This version prepares the queue contract and migration path without creating a hidden dependency, credential need, or deployment risk.

## Redis migration gates

Before switching from JSON queueing to Redis Streams:

1. Back up current data.
2. Run the full test suite.
3. Run `/storage/check`.
4. Run `/queue/adapter/check`.
5. Verify replay auto-processing.
6. Verify dead-letter visibility.
7. Verify trace finalization.
8. Verify release gate blocking.
9. Get explicit owner approval.

