# Architecture

## Purpose and status

The Autonomous Engineering Platform (AEP) is intended to be a local
mini-enterprise environment that takes work from Jira Simulator through
a controlled sequence of specialized agents and ultimately produces a GitHub
draft pull request.

This document describes the intended design and the current implementation.
One .NET web project contains the HTTP entry point, initial workflow model,
PostgreSQL persistence, and schema migration. Jira Simulator has a standalone
React UI backed by a local TypeScript Node.js API and SQLite database. Projects
can be created, edited and deleted, and issues can be moved between board statuses;
Stories can have Task-only subtasks linked to their parent issue. The MCP
server and AEP integration are not implemented. The
issue-processing flow and most runtime security controls still need to be
built and tested.
The `tests/Aep.Tests/` xUnit project covers PostgreSQL configuration handling
and append-only audit-event safeguards without requiring a running database.

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
- **Local execution:** Jira Simulator, the AEP, and PostgreSQL run locally;
  the MCP server is planned. Model calls and the GitHub integration require
  internet access.

## Components and responsibilities

| Component        | Responsibility                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `Aep`            | One ASP.NET Core project. Its folders separate HTTP controllers, models, services, background services, database access, and integrations. |
| Jira Simulator   | React/TypeScript UI and local Node.js API with SQLite projects and issues; MCP and webhook integration are planned.                        |
| PostgreSQL       | Persistent workflow state, agent runs, approvals, and audit data.                                                                          |
| Docker workspace | Bounded, temporary working environment for agents and their repository checkout.                                                           |

The folder boundaries are logical, not separate assemblies. Agent execution,
GitHub integration, and background processing will initially live inside this
project; a component can become a separate project if it later needs independent
deployment, scaling, or compile-time dependency boundaries.

The simulator API is the source of truth for project and issue changes.
Project renames, subtask conversions and deletions run in SQLite transactions,
including their related issue updates. Deleting a project deletes its issues;
deleting a Story deletes its subtasks. Deletions reject stale related-issue
lists, and per-project issue sequences prevent key reuse after deletion.
New databases start empty; existing databases are
preserved. The browser requests state through Vite's local proxy and
shows loading and error feedback. The API is local-only and unauthenticated;
it is not a production or multi-user security boundary.

## Main flows

### Issue to workflow

1. A user creates an issue in Jira Simulator and moves it to
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
3. **UI/UX (design)** — before implementation, turns the Analyst and Architect
   handoffs into a concrete interface design brief and WCAG 2.2 AA criteria.
   It reports not applicable when no user-facing interface will change.
4. **Developer** — implements the approved change and adds focused unit tests.
5. **UI/UX (review)** — after implementation, checks changed interfaces for
   visual quality, usability, responsiveness, and accessibility against the
   design brief. It reports not applicable when no user-facing interface
   changed.
6. **Tester** — verifies behavior with focused tests and checks both
   applicable UI/UX handoffs.
7. **Reviewer** — reviews the change, test evidence, and UI/UX handoffs for
   defects and regressions.

All roles use WCAG 2.2 AA as the engineering target when evaluating or changing
user-facing interfaces; this is not a claim of legal compliance.

Each agent receives only the context and tools required for its role. The
orchestrator records each step's output as a workflow result and checks it
before the next step begins. The concrete agent protocols and output formats
still need to be defined.

## Persistent workflow

The workflow engine will be a custom persisted state machine. The database is
the source of truth for workflow state; an agent's or worker's in-memory state
is not. A workflow must be able to reference at least:

- the external issue identity and received event;
- the current state and step progress;
- agent runs, results, and attempts;
- risk assessment, policy decisions, and approval status;
- workspace and GitHub results;
- audit events and relevant timestamps.

This is a conceptual minimum, not a finalized database schema. Transaction
boundaries, concurrency control, retention, and recovery behavior must be
designed during implementation. The current EF Core model is versioned through
migrations, which the application applies before accepting requests. The AEP
persists external Jira records as issues; the `RenameIssueSchema` migration
renames the earlier table and workflow reference without dropping existing
records.

## Repository layout

- `src/Aep/` is the single .NET web project. Its folders are organized by
  responsibility: `Controllers/`, `Models/`, `Services/`, `BackgroundServices/`,
  `Database/`, and `Integrations/`.
- `src/Aep/Aep.sln` is the entry point for building the application and its
  `tests/Aep.Tests/` xUnit project.
- `dotnet-tools.json` pins the local EF Core command-line tool.
- `mcp/jira-simulator/` contains Jira Simulator; its MCP server is planned.
- `agents/` contains role descriptions for the agent pipeline.
- `policies/` contains initial policy configurations; they only take effect
  when enforced by the runtime.
- `infrastructure/` contains the planned Docker configuration.
- `tests/Aep.Tests/` contains .NET unit tests; future integration tests remain
  to be designed.

## Open decisions

- API contracts.
- Webhook authentication, deduplication, and retry/dead-letter behavior.
- Workflow states, recovery strategy, timeouts, and cancellation.
- Audit retention and backup strategy.
- Docker network policy, resource limits, and workspace cleanup.
- GitHub token management, allowed repositories, and branch/PR conventions.
- Agent output contracts, model/CLI versions, and observability.
