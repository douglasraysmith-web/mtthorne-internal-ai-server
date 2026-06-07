# Architecture

## Seat model

The system has 11 operating seats:

- 4 primary AI systems
- 7 round-table lanes

ArchĒAngel is not counted as a separate primary AI. It is an escalation/orchestration mode under ArchĒ. WarLock is not counted as a separate primary AI. It is an escalation coordinator under V-Lock AI.

## Request flow

```text
Request
  -> Router Server
  -> Project Room Server
  -> Source Manifest Server
  -> Source-Lock Lane
  -> Security / Privacy Lane
  -> Primary AI
  -> Verifier Lane
  -> Error-Ledger Lane
  -> Quality Judge Lane
  -> Handoff
```

## Contamination control

A request must have a project room. Project rooms define allowed and forbidden sources. Source manifest entries are metadata-first and must match both project room and allowed AI.

## Public boundary

Public mode blocks owner-only payloads, raw prompts, API keys, provider payloads, customer records, payment records, owner records, private project rooms, and registry logs.

## Speed

Speed comes from classification, route selection, and future cache integration. The current scaffold labels decisions as:

- `instant_or_cached_answer`
- `quick_generated_answer`
- `deep_verified_answer`
- `round_table_reviewed_answer`

## Quality

Quality scoring is centralized in `src/servers/quality.js`. Public-facing or release-facing outputs should target 90+.


## v0.5.1 Reliability Additions

- Durable queue lifecycle states
- Dead-letter queue listing
- Replayable queue jobs
- Trace finalization and stuck-trace repair
- Failed job repair hints
