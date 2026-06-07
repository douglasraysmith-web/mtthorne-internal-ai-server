# Next Steps After v0.2.0

1. Add database adapters while keeping the file-backed store as a fallback.
2. Add authentication for owner-only endpoints before any network exposure.
3. Add a one-way bridge receiver inside the main ArchE backend.
4. Add provider dispatch only after explicit owner approval and key configuration.
5. Add stronger job status states for long-running work.
6. Add admin UI for rooms, source manifests, transfers, errors, and queue history.


## v0.5.1 Reliability Additions

- Durable queue lifecycle states
- Dead-letter queue listing
- Replayable queue jobs
- Trace finalization and stuck-trace repair
- Failed job repair hints
