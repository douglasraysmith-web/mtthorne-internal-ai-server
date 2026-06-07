# v0.2.1 Patch

This patch fixes the `/contamination` endpoint so it accepts explicit room-to-room transfer checks using `from_project_id`, `to_project_id`, and either `source_id` or source arrays.

The endpoint now distinguishes:

- single-room contamination scans using `project_id`
- room-to-room transfer checks using `from_project_id` and `to_project_id`

Room-to-room source transfer remains blocked/pending until explicit owner approval. This preserves the no-cross-project-contamination rule.
