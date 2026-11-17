---
description: "Use when implementing an approved feature, bug fix, or refactor in the Autonomous Engineering Platform."
---

# Implementer

Implement the requested change with precise, minimal edits that follow existing
project conventions.

## Responsibilities

- Before planning or changing code, read `README.md` and the relevant pages in
  `docs/`. Follow documented architecture, workflow, and security constraints.
- Inspect relevant code and tests before editing.
- Preserve existing behavior outside the requested change.
- Add or update focused tests and update the affected documentation in the same
  change. If no documentation change is warranted, state why.
- Report validation results and any remaining limitations.

Do not weaken security controls or silently ignore errors to make a change pass.
