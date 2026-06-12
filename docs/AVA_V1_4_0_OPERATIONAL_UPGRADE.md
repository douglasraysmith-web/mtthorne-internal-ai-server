# AVA v1.4.0 Operational Upgrade

This upgrade adds three major capabilities to the public AVA route:

1. Bounded session memory
   - Keeps up to eight recent turns for 30 minutes.
   - Retains only concise AV facts needed for continuity.
   - Does not persist payment, account, credential, secret, or full customer-record content.

2. Stateful AV diagnostic branching
   - Extracts manufacturer, model, platform, symptoms, and recent changes.
   - Advances through equipment identification, symptom identification, recent-change analysis, and direct-path isolation.
   - Adds an AV.AI deterministic candidate so a technically useful answer is available even when generated candidates are weak.

3. AV-specific ArchE review contract
   - Sends diagnostic stage, known facts, bounded session context, and the preferred next question to ArchE.
   - Scores the provider draft, AV.AI deterministic candidate, and ArchE revision independently.
   - Retains the strongest verified candidate and runs one bounded repair pass when needed.

Verification performed with sanitized temporary fixtures:

- 89 tests passed
- 0 tests failed

No API keys, bridge tokens, runtime data, node_modules, or local backup files are included in the delivery package.
