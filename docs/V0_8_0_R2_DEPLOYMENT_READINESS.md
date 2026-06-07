# v0.8.0 — R2 Adapter + Existing-Service Deployment Readiness

This upgrade corrects the architecture path around services already available:

- GitHub for source control and rollback
- Railway for backend hosting
- Netlify for mtthorne.com public frontend
- R2 Storage for object storage
- OpenAI and Anthropic keys for future gated provider dispatch

No Redis, Qdrant, or new managed database is required for this stage.

## New endpoints

```text
GET /r2/status
GET /r2/check
GET /r2/migration-plan
GET /deployment/readiness
GET /deployment/check
GET /deployment/plan
```

## Safety state

R2 is not connected by default. The active object storage driver is `local_manifest`.
Real R2 writes remain inactive until owner approval, credentials, bucket policy, lifecycle rules, and tests are verified.

Provider dispatch remains inactive. Public chat remains inactive. Customer data and payment/account access remain inactive.
