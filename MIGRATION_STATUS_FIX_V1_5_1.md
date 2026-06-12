# Migration Status Persistence Fix

This patch persists `last_migration` in PostgreSQL (`ai_store_metadata`) rather than process memory.
`GET /storage/status` refreshes that metadata from PostgreSQL on every request.
The storage manifest now overlays live v1.5 values over any legacy JSON manifest.
