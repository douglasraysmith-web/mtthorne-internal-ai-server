# v1.6.0 — ArchĒ Owner Knowledge Seed

This release populates the shared PostgreSQL database with verified ArchĒ knowledge from owner package commit `10413707310d46417654f22ebb770fb307c9176b`.

It registers canonical governance, runtime documentation, lessons, error-ledger records, and an indexed runtime-capability manifest. Executable source code is hashed and indexed as capability metadata but is not ingested as answerable knowledge.

## Commands

```bash
railway run -s mtthorne-internal-ai-server npm run seed:arche
railway run -s mtthorne-internal-ai-server npm run verify:arche-knowledge
```

## Owner HTTP controls

- `GET /knowledge/status` — public-safe counts only
- `GET /knowledge/search` — owner token required
- `POST /knowledge/seed/arche` — owner token required

All ArchĒ entries are restricted to `room_arche_site` and `ai_id=arche`.
