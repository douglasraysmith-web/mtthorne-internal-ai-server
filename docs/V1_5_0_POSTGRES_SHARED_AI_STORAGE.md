# v1.5.0 Shared PostgreSQL Storage

This release connects ArchE, AV.AI/AVA, V-Lock AI, and The Janitor to one shared PostgreSQL-backed storage adapter.

## Storage model

The database uses one versioned JSONB table:

- `ai_store_documents.collection_key`
- `ai_store_documents.document`
- `ai_store_documents.version`
- `ai_store_documents.updated_at`

Existing modules continue using `readJson` and `writeJson`; no AI, lane, queue, trace, memory, or release module needs database-specific calls.

## Railway variables

Set these on the `mtthorne-internal-ai-server` service:

- `DATABASE_URL=${{Postgres.DATABASE_URL}}` or the exact selected PostgreSQL service name
- `AI_STORAGE_DRIVER=postgres`
- `AI_POSTGRES_BOOTSTRAP_FROM_JSON=false`
- `AI_POSTGRES_REQUIRE_CONNECTION=false` for the first verification deployment
- `AI_DISABLE_LOCAL_STORAGE_BACKUP=false`

Railway reference variables use `${{SERVICE_NAME.VARIABLE_NAME}}`. Select the intended database service in the Railway Variables UI rather than hard-coding credentials.

## Import existing local JSON data

From the linked local repository, with Railway variables injected:

```bash
railway run -s mtthorne-internal-ai-server npm run storage:migrate
```

The migration does not overwrite existing database collections. To intentionally replace them:

```bash
railway run -s mtthorne-internal-ai-server npm run storage:migrate:overwrite
```

## Verification

```bash
curl https://mtthorne-internal-ai-server-production.up.railway.app/storage/status
curl https://mtthorne-internal-ai-server-production.up.railway.app/storage/database-check
curl https://mtthorne-internal-ai-server-production.up.railway.app/health
```

After successful migration and checks, set:

- `AI_POSTGRES_REQUIRE_CONNECTION=true`

This prevents silent fallback when PostgreSQL is unavailable.

## Safety

- Database credentials remain in Railway only.
- Local JSON stays as an atomic recovery copy unless disabled.
- The HTTP migration route requires the owner approval token.
- AVA session memory now uses the shared storage adapter and remains bounded to eight turns with a 30-minute TTL.

## Registry safety gate

The deployable package includes `.npmrc` pinned to `https://registry.npmjs.org/` and a `verify:registry` script. `npm run predeploy` fails if `package-lock.json` or `.npmrc` contains internal-only registry references.
