# v0.2.0 Internal Work Queue + Bridge Prep

This upgrade moves the internal AI server beyond a scaffold and adds operational rails for speed, quality, and contamination control.

## Added

- `/queue` work queue endpoint with immediate processing.
- `/queue/:id` status endpoint.
- `/decision/history` decision history storage.
- `/contamination` project/source contamination check endpoint.
- `/transfers` room-to-room transfer request system.
- `/transfers/approve` explicit owner approval path.
- `/bridge/arche` bridge-ready handoff payload for the existing ArchE backend.
- Quality report attached to every decision.
- Explicit support for the `request` field used in curl/browser testing.

## Still inactive by design

- Public chat activation.
- Provider dispatch.
- Customer-data access.
- Payment/account access.
- Automatic import into the live ArchE backend.

## Rule

Four primary AIs remain primary. Seven lanes remain support seats. ArchEAngel and WarLock remain escalation structures, not separate primary AIs.
