# Deploy v1.5.0 Shared PostgreSQL Storage

## 1. Preserve local state

Do not delete the existing `.git` or `data` folders in your working repository.
Extract this package over the existing `internal-ai-server` source tree.

## 2. Install and verify

```bash
cd ~/Downloads/internal-ai-server
npm install
npm test
```

Expected: 93 passed, 0 failed.

## 3. Commit and deploy code

```bash
git add .
git commit -m "Add shared PostgreSQL storage for all four AI systems"
git push origin main
railway up --service mtthorne-internal-ai-server
```

## 4. Connect the Railway database

The intended shared database service is `Postgres-3HwM` unless you deliberately select the other Postgres service.

Set these variables on `mtthorne-internal-ai-server`:

```text
DATABASE_URL=${{Postgres-3HwM.DATABASE_URL}}
AI_STORAGE_DRIVER=postgres
AI_POSTGRES_BOOTSTRAP_FROM_JSON=false
AI_POSTGRES_REQUIRE_CONNECTION=false
AI_POSTGRES_SEED_DEFAULTS=true
AI_DISABLE_LOCAL_STORAGE_BACKUP=false
```

The database value is a Railway reference variable, not a copied password.

## 5. Import existing local shared records

From the linked repository:

```bash
railway run -s mtthorne-internal-ai-server npm run storage:migrate
```

This imports only collections not already present. To intentionally replace database collections with the local JSON versions:

```bash
railway run -s mtthorne-internal-ai-server npm run storage:migrate:overwrite
```

## 6. Verify live persistence

```bash
curl https://mtthorne-internal-ai-server-production.up.railway.app/storage/status
curl https://mtthorne-internal-ai-server-production.up.railway.app/storage/database-check
curl https://mtthorne-internal-ai-server-production.up.railway.app/health
```

Expected storage status:

```text
active_driver: postgres
database_connected: true
shared_ai_scope: arche, av_ai, vlock_ai, janitor
```

## 7. Make database availability mandatory

After all checks pass:

```bash
railway variable set -s mtthorne-internal-ai-server AI_POSTGRES_REQUIRE_CONNECTION=true
```
