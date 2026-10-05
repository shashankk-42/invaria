# Invaria next milestones

The Week 1 vertical slice is implemented. Expand only after a measurable regression gate is in place.

| Phase | Work | Acceptance gate |
| --- | --- | --- |
| Week 2 | GitHub App, private repositories, authenticated workspaces, durable queue and isolated workers | Two users cannot read each other's scans; a killed job retries safely |
| Week 3 | Better imports, call-argument propagation, framework/ORM adapters and tenant models | Larger golden corpus with explicit unsupported cases and measured false positives |
| Week 4 | Dominance-aware authorization checks and multi-step business flows | Each state/authorization hypothesis has positive and negative fixture coverage; current work adds bounded helper propagation and sensitive-write policy coverage |
| Week 5 | External benchmark and evaluation dashboard | Publish precision/recall on held-out labeled cases; distinguish unsupported cases |
| Week 6 | Remediation proposals and sandboxed fix validation | Patch removes the target finding without breaking fixture behavior |
| Week 7 | Draft PR integration and incremental scans | Scans bind to exact commits, changed evidence invalidates stale results |
| Week 8 | Performance, deployment hardening and product polish | Security review, resource budgets and reproducible deployment checks pass |

Keep the model replaceable. Compare E4B and 12B using the same evidence bundles and measured review quality before choosing a larger default. Do not fine-tune until there is a useful labeled evaluation corpus. Introduce Neo4j or workflow frameworks only when a demonstrated query or orchestration need justifies them.
