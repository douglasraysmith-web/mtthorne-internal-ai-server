# v1.0.0 Stable Internal Sidecar + Existing Services Profile

This release bundles several safety and deployment upgrades at once. It keeps the system on the services already available: GitHub, Railway, Netlify, R2, OpenAI, and Anthropic. Redis, Qdrant, and a new managed database remain optional future upgrades, not requirements.

## Added
- Provider/cost wording cleanup.
- Owner approval gate.
- Provider dispatch log endpoint.
- Existing-services profile endpoint.
- Railway environment plan endpoint.
- Netlify bridge contract endpoint.
- Stable sidecar check endpoint.

## Still inactive by design
- Public chat.
- Real provider network calls.
- Customer-data access.
- Payment/account access.
- Automatic ArchE backend import.
- Real R2 writes.
