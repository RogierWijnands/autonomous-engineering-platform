# Workflow and Agent Pipeline

## Status

This document describes the intended end-to-end flow. The host, initial
database model, authenticated webhook intake, persistent queue and read-only
dashboard, simulator UI and API, and local issue MCP server are in place.
No worker, policy engine, isolated agent execution, or GitHub integration is
implemented. See [setup](jira-workflow-setup.md) for the actual current flow.

## Overview

```text
Issue created; user confirms Execute
        ↓ webhook
Receive, validate, and deduplicate
        ↓
Policy and risk evaluation
        ↓ if required
Human approval
        ↓
Analyst → Architect → UI/UX design → Developer → UI/UX review → Tester → Reviewer
        ↓
Result and policy checks
        ↓ host-side GitHub actions
Feature branch → draft PR → human review
```

## Phases

### 1. Receive issue

Jira Simulator manages local issues and exposes read, evidence-update and
completion tools through MCP. When a user confirms Execute, it sends a minimal
signed webhook to the configured local endpoint. AEP authenticates the
sender, validates the selected project-default or issue-override repository
from the simulator and creates a durable workflow record with seven
pending steps. A replay returns the original workflow; a new request for an
already queued, active or paused issue returns that same workflow. Terminal
workflows permit a new event to create a new workflow. No step is run yet.

### 2. Establish scope and policy

The orchestrator associates the issue with the configured GitHub repository,
checks scope, and determines the risk level. The policy engine decides which
actions and approvals are required. Issue or repository text cannot change
the policy.

If scope, risk, or required input cannot be determined reliably, the workflow
is paused for human review rather than proceeding silently.

### 3. Approval before execution

A workflow that requires approval under policy remains blocked until an
authorized user approves the specific task and scope. The approval is bound to
that workflow and content; material changes require another review. Rejection
and timeout stop or pause the workflow according to explicit rules.

### 4. Agent execution

The host creates a bounded Docker workspace for the task. Every repository
request follows Analyst → Architect → UI/UX design → Developer → UI/UX review
→ Tester → Reviewer, in that order. For user-facing frontend changes, UI/UX
first provides the design direction and WCAG 2.2 AA acceptance criteria to
Developer, then reviews the implementation. If no interface changes, both
UI/UX stages report not applicable and hand off to their next role. Every role
consumes the preceding handoff and records its own output for the next role.
Analyst assigns stable IDs to requirements, constraints, and acceptance
criteria, with risks and verification methods. Architect preserves every ID
in a traceability register mapping it to design decisions and validation, or
explaining why it is not applicable. Developer, both UI/UX stages, and Tester
consume the complete registers, account for every ID with evidence or a
justified not-applicable status, and carry evidence forward; no stage may
silently drop an item by summarizing it. Browser test tooling is documented
in `docs/accessibility-testing.md`.
For frontend changes, Developer adds or updates end-to-end tests for relevant
user journeys and accessibility semantics, UI/UX reviews their coverage and
results, and Tester verifies them. Assess screen-reader accessibility from the
rendered interface and relevant DOM semantics, and report it as an estimate,
not observed screen-reader behavior. Explain when E2E tests are not warranted.
All roles apply WCAG 2.2 AA as the engineering target when evaluating,
designing, implementing, testing, or reviewing user-facing interfaces; this
is not a claim of legal compliance. A stage with no other applicable work must
still report what it checked and why no action was needed; for example,
documentation-only work may not need code changes or unit tests. If
requirements are materially ambiguous, pause for user clarification. If
post-implementation UI/UX, testing, or review identifies an implementation
defect, return the work to Developer and repeat the affected UI/UX, testing,
and review stages. Instructions are in `aep/agents/` and
`.github/agents/orchestrator.agent.md`.

The agent container receives no GitHub token, Docker socket, or access to
personal files. Each step should have a bounded task, timeout, and resource
budget. The orchestrator records status and results so a process restart does
not make the workflow depend on volatile agent memory.

Development handoffs must include validation commands, unit-test results,
dependency and security-check results, and unresolved findings. Never include
secret values in agent context or handoffs.

### 5. Quality and policy checks

Tests run in the isolated environment. The reviewer checks changed code for
readability, maintainability, appropriate simplicity, and consistency with
repository patterns, alongside correctness, security, and test evidence.
Findings must describe concrete impact; subjective style preferences are not
actionable findings. The orchestrator checks that all required steps are
complete and no policy block remains. A failed test or critical finding must
not automatically result in a PR presented as successful.

### 6. GitHub publication and human review

The .NET host performs permitted GitHub actions using limited credentials:
creating a feature branch, commits, and a draft PR. The agent container does
not perform these actions itself. The PR references the original issue and
includes a summary, test results, and relevant risks.

A person reviews the draft PR. Creating a draft PR is not approval to merge or
deploy; those actions are outside the initial scope unless explicitly designed
later.

### 7. Completion and cleanup

The host records the final status and audit information. Temporary workspaces
and artifacts are removed according to a retention policy that still needs to
be defined. Failed or canceled tasks must be stopped safely, with partial
results remaining identifiable.

## Workflow requirements

- State transitions are explicit and validated by the orchestrator.
- Webhook, worker, and agent retries are idempotent where possible.
- Each step records its input, output, start/end time, and result status.
- Approvals are traceable to the scope and change set.
- Errors, timeouts, and cancellations are visible; failures are not presented
  as successes.
- A workflow can be paused, resumed, or canceled without bypassing policy
  checks.

## Open decisions

- Allowed workflow transitions and worker recovery.
- Criteria for future automatic Jira status transitions.
- Approval interface, permissions, and expiration behavior.
- Agent contracts, context selection, and allowed CLI commands.
- Retry behavior per phase and handling of partial results.
- Test/review thresholds that block a draft PR.
- Workspace, log, and transcript retention.
