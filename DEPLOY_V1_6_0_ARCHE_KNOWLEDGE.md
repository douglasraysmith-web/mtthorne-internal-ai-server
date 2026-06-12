# Deploy v1.6.0 — Populate ArchĒ from Latest Owner Source

This package is built from the working shared server and the verified ArchĒ owner archive:

- Repository: `douglasraysmith-web/arche-backend`
- Commit: `10413707310d46417654f22ebb770fb307c9176b`
- Owner archive SHA-256: `0cf5587b5725e6817a0c361da7b068c5145c93a7c5e55ab9e58e49a1848e6733`
- ArchĒAngel capability state: through v1.13.6

## Install and deploy

Copy this package over the existing `internal-ai-server` repository while preserving `.git` and `data`, then:

```bash
npm ci
npm test
git add .
git commit -m "Populate ArchE knowledge from latest owner source"
git push origin main
railway up --service mtthorne-internal-ai-server
```

## Seed ArchĒ into PostgreSQL

```bash
railway run -s mtthorne-internal-ai-server npm run seed:arche
railway run -s mtthorne-internal-ai-server npm run verify:arche-knowledge
```

Or use the owner-protected HTTP route:

```bash
curl -X POST https://mtthorne-internal-ai-server-production.up.railway.app/knowledge/seed/arche -H "Content-Type: application/json" -H "X-Owner-Approval-Token: $NEW_OWNER_TOKEN" -d '{"overwrite":true}'
```

## Verify

```bash
curl https://mtthorne-internal-ai-server-production.up.railway.app/knowledge/status
```

Expected ArchĒ result: 46 knowledge documents, commit `10413707310d...`, room `room_arche_site`, cross-room entries `0`.
