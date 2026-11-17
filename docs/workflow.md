# Workflow and Agent Pipeline

## Status

This document describes the intended end-to-end flow. The host, initial
database model, and schema migration are in place, but the workflow state
machine, MCP server, isolated agent execution, and GitHub integration are not
yet implemented.

## Overview

```text
Ticket created and moved to In Progress
        ↓ webhook
Receive, validate, and deduplicate
        ↓
Policy and risk evaluation
        ↓ if required
Human approval
        ↓
Analyst → Architect → Implementer → Tester → Reviewer
        ↓
Result and policy checks
        ↓ host-side GitHub actions
Feature branch → draft PR → human review
```

## Phases

### 1. Receive ticket

The Jira simulator manages local tickets and exposes them through MCP. When a
relevant status transition occurs, the simulator sends a webhook to the AEP
API. The API should authenticate the sender, validate the payload, and create
a durable workflow record. Redelivery of the same event should not cause an
unintended duplicate execution.

### 2. Establish scope and policy

The orchestrator associates the ticket with the configured GitHub repository,
checks scope, and determines the risk level. The policy engine decides which
actions and approvals are required. Ticket or repository text cannot change
the policy.

If scope, risk, or required input cannot be determined reliably, the workflow
is paused for human review rather than proceeding silently.

### 3. Approval before execution

A workflow that requires approval under policy remains blocked until an
authorized user approves the specific task and scope. The approval is bound to
that workflow and content; material changes require another review. Rejection
and timeout stop or pause the workflow according to explicit rules.

### 4. Agent execution

The host creates a bounded Docker workspace for the task. Agents perform the
analyst, architect, implementer, tester, and reviewer roles. Agent instructions
are in `agents/`; runtime inputs and output formats still need to be defined.

The agent container receives no GitHub token, Docker socket, or access to
personal files. Each step should have a bounded task, timeout, and resource
budget. The orchestrator records status and results so a process restart does
not make the workflow depend on volatile agent memory.

### 5. Quality and policy checks

Tests run in the isolated environment. The reviewer reports findings, and the
orchestrator checks that all required steps are complete and no policy block
remains. A failed test or critical finding must not automatically result in a
PR presented as successful.

### 6. GitHub publication and human review

The .NET host performs permitted GitHub actions using limited credentials:
creating a feature branch, commits, and a draft PR. The agent container does
not perform these actions itself. The PR references the original ticket and
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

- Exact state names and allowed transitions.
- Criteria for a valid Jira status transition and event deduplication.
- Approval interface, permissions, and expiration behavior.
- Agent contracts, context selection, and allowed CLI commands.
- Retry behavior per phase and handling of partial results.
- Test/review thresholds that block a draft PR.
- Workspace, log, and transcript retention.
