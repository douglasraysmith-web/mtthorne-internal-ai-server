# Internal AI Server v1.7.0 — AV.AI / AVA Owner Knowledge

## Purpose
Populate PostgreSQL with isolated AV.AI technical authority and AVA public-behavior knowledge from the verified AVAI owner source v7.8.4.

## Scope
- AI: av_ai
- Project room: room_av_ai
- AV.AI technical authority records
- AVA public behavior records
- ArchE remains governance/verification
- No executable source text ingested
- No private customer/payment data ingested

## Install
Copy this package over the existing internal-ai-server repository while preserving `.git` and `data`.

## Deploy
```bash
npm ci
npm test
git add .
git commit -m "Populate AVAI and AVA owner knowledge v1.7.0"
git push origin main
railway up --service mtthorne-internal-ai-server
```

## Seed through live owner route
```bash
OWNER_TOKEN="$(railway variable list -s mtthorne-internal-ai-server --kv | sed -n 's/^AI_OWNER_APPROVAL_TOKEN=//p')"
curl -X POST https://mtthorne-internal-ai-server-production.up.railway.app/knowledge/seed/avai -H "Content-Type: application/json" -H "X-Owner-Approval-Token: $OWNER_TOKEN" -d '{"overwrite":true}'
unset OWNER_TOKEN
```

## Verify
```bash
curl https://mtthorne-internal-ai-server-production.up.railway.app/knowledge/status
```
Expected total after ArchE + AVAI seeding: 100 entries (46 ArchE + 54 AVAI/AVA).
