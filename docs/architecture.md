# Architecture

## Purpose and status

The Autonomous Engineering Platform (AEP) is intended to be a local
mini-enterprise environment that takes work from a local Jira simulator through
a controlled sequence of specialized agents and ultimately produces a GitHub
draft pull request.

This document describes the intended design, not behavior that has already
been implemented. The repository currently contains a scaffold. Components,
integrations, persistent workflows, and security controls still need to be
built and tested.

## Design principles

- **The host controls privileges:** credentials and external actions remain
  outside the agent container.
- **Least privilege:** each component receives only the access it needs for
  its task.
- **Persistent orchestration:** workflow state, attempts, approvals, and
  results must be recoverable after a process restart.
- **Explicit gates:** high-risk steps require policy checks and, where needed,
  human approval.
- **Auditability:** important decisions and actions are recorded and linked to
  a workflow and actor.
- **Local execution:** the Jira simulator, MCP server, AEP, and PostgreSQL run
  locally; model calls and the GitHub integration require internet access.

## Components and responsibilities

| Component | Responsibility |
|---|---|
| `Aep.Api` | ASP.NET Core HTTP entry point for webhooks and management or status requests. Validates requests and passes work to application use cases. |
| `Aep.Application` | Use cases, workflow coordination, policies, and contracts between the domain layer and adapters. |
| `Aep.Domain` | Workflow concepts, states, invariants, and business rules, independent of external integrations. |
| `Aep.Infrastructure` | PostgreSQL persistence through EF Core/Npgsql and implementations of external or technical adapters. |
| `Aep.AgentRunner` | Starts and monitors agent runs with GitHub Copilot CLI inside an isolated workspace. It receives no GitHub token or Docker socket. |
| `Aep.GitHub` | GitHub operations on behalf of the host, such as branch, commit, and draft PR actions. Manages GitHub credentials outside the agent container. |
| `Aep.Worker` | Background processing of accepted workflows and recoverable or retryable tasks. |
| Jira simulator | Local TypeScript application that manages tickets and can submit changes to the AEP via MCP and a webhook. |
| PostgreSQL | Persistent workflow state, agent runs, approvals, and audit data. |
| Docker workspace | Bounded, temporary working environment for agents and their repository checkout. |

These are logical boundaries; the final process layout and hosting
configuration will be determined during implementation.

## Main flows

### Ticket to workflow

1. A user creates a ticket in the local Jira simulator and moves it to
   **In Progress**.
2. The simulator sends a webhook to the AEP API. The API validates the request
   and records or schedules the workflow.
3. The worker loads the workflow and performs policy and risk checks.
4. The agent pipeline works in an isolated Docker workspace.
5. The host processes permitted GitHub actions and creates a feature branch and
   draft PR.
6. A person reviews the PR and decides whether to merge or take further action.

The exact webhook authentication, retry strategy, idempotency key, and
transitions must be defined before implementation. Duplicate webhook delivery
must not result in uncontrolled duplicate workflows.

### Agent pipeline

The default roles are:

1. **Analyst** — clarifies the request and defines acceptance criteria.
2. **Architect** — translates those criteria into a design or bounded approach.
3. **Implementer** — implements the approved change.
4. **Tester** — verifies behavior with focused tests.
5. **Reviewer** — independently reviews the change for defects and regressions.

Each agent receives only the context and tools required for its role. The
orchestrator records each step's output as a workflow result and checks it
before the next step begins. The concrete agent protocols and output formats
still need to be defined.

## Persistent workflow

The workflow engine will be a custom persisted state machine. The database is
the source of truth for workflow state; an agent's or worker's in-memory state
is not. A workflow must be able to reference at least:

- the external ticket identity and received event;
- the current state and step progress;
- agent runs, results, and attempts;
- risk assessment, policy decisions, and approval status;
- workspace and GitHub results;
- audit events and relevant timestamps.

This is a conceptual minimum, not a finalized database schema. Transaction
boundaries, concurrency control, retention, and recovery behavior must be
designed during implementation.

## Repository layout

- `src/Aep.Api/`, `src/Aep.Application/`, `src/Aep.Domain/`, and
  `src/Aep.Infrastructure/` form the .NET application core.
- `src/Aep.AgentRunner/`, `src/Aep.GitHub/`, and `src/Aep.Worker/` contain
  execution, integration, and background-processing components.
- `mcp/jira-simulator/` contains the local TypeScript Jira simulator and MCP
  server.
- `agents/` contains role descriptions for the agent pipeline.
- `policies/` contains initial policy configurations; they only take effect
  when enforced by the runtime.
- `infrastructure/` contains the planned Docker configuration.
- `tests/` contains the planned unit and integration tests.

## Open decisions

- Exact .NET project references, solution layout, and API contracts.
- Webhook authentication, deduplication, and retry/dead-letter behavior.
- Workflow states, recovery strategy, timeouts, and cancellation.
- Data model, migrations, audit retention, and backup strategy.
- Docker network policy, resource limits, and workspace cleanup.
- GitHub token management, allowed repositories, and branch/PR conventions.
- Agent output contracts, model/CLI versions, and observability.
