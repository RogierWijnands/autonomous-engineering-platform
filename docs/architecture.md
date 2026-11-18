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
Stories can have Task-only subtasks linked to their parent issue. A separate
local MCP server exposes issue reads, evidence updates and completion. The
simulator sends a signed user-confirmed execution webhook to AEP, which stores
a deduplicated workflow queue and offers an authenticated local dashboard.
The agent worker and most runtime security controls still need to be built
and tested. See [Jira workflow setup](jira-workflow-setup.md).
The `aep/tests/Aep.Tests/` xUnit project covers PostgreSQL configuration handling
and append-only event-history safeguards without requiring a running database.

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
- **Local execution:** Jira Simulator, its MCP server, the AEP, and PostgreSQL
  run locally. Model calls and the GitHub integration require
  internet access.

## Components and responsibilities

| Component        | Responsibility                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `Aep`            | One ASP.NET Core project. Its folders separate HTTP controllers, models, services, database access, and integrations.               |
| Jira Simulator   | React/TypeScript UI and local Node.js API with SQLite projects, issues and evidence; sends confirmed local execution webhooks.      |
| Jira MCP server  | Node.js Streamable HTTP MCP adapter for issue reads, evidence updates and In Progress → Done transitions through the simulator API. |
| PostgreSQL       | Persistent workflow queue, planned steps, webhook receipts and audit data.                                                          |
| Docker workspace | Bounded, temporary working environment for agents and their repository checkout.                                                    |

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
Evidence is a validated structured document stored with the issue; existing
issues without it remain valid. Optimistic evidence checks prevent overwriting
concurrent edits, while the completion transition is checked atomically.
The MCP server uses the simulator API rather than accessing SQLite directly.
It is loopback-only and unauthenticated, not an isolated-container or
multi-user authorization boundary.

Both local Node.js services use Express for HTTP routing and bounded JSON
parsing. The simulator API starts in `api/server.ts`, keeps shared request
checks in `api/app.ts`, groups issue, project and test routers in
`api/routes/`, database code and the default SQLite file in `api/database/`,
and Jira issue execution webhook delivery in `api/webhooks/executeJiraIssueWebhook.ts`.
The MCP server keeps its HTTP transport in `src/server.ts`, its
simulator client and schemas in `src/jira/`, and its tool registrations in
`src/tools/`, composed by `src/mcp.ts`. Both services apply their host and
origin checks before parsing requests or dispatching routes. Express is not
an authentication or authorization boundary.

## Main flows

### Issue to workflow

1. A user configures the required project repository, creates an issue in Jira
   Simulator and confirms **Execute** in its details.
2. The simulator sends a signed minimal execution-request webhook. AEP
   authenticates it, validates the simulator's project-default or issue-override
   repository selection and persists seven
   pending steps. The following steps are future work, not active execution.
3. The worker loads the workflow and performs policy and risk checks.
4. The agent pipeline works in an isolated Docker workspace.
5. The host processes permitted GitHub actions and creates a feature branch and
   draft PR.
6. A person reviews the PR and decides whether to merge or take further action.

Each confirmation sends a new event UUID once, without automatic retries.
PostgreSQL serializes requests by stable issue identity and prevents duplicate
active workflows; durable event receipts make redelivery idempotent.

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
7. **Reviewer** — reviews the change, including code quality, test evidence,
   and UI/UX handoffs, for defects and regressions.

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
- event history and relevant timestamps.

This is a conceptual minimum, not a finalized database schema. Intake
transactions and active-issue concurrency control are implemented; retention
and worker recovery remain open. The EF Core model is versioned through
migrations, which the application applies before accepting requests. The AEP
persists external Jira records as issues; the `RenameIssueSchema` migration
renames the earlier table and workflow reference without dropping existing
records.
The `RenameAuditEventToEventHistory` migration renames the audit-event table,
indexes and constraints without deleting existing events. Historical migrations
retain their original names.
The unused agent execution, approval, policy decision and pull request EF
models have been retired. Their legacy tables and any existing records remain
in PostgreSQL but are no longer managed by the current EF model. Before
introducing replacement models, explicitly reconcile those tables and their
data in a future migration; do not assume EF will recreate or remove them.

## Repository layout

- `aep/src/Aep/` is the single .NET web project. Its folders are organized by
  responsibility: `Controllers/`, `Models/`, `Services/`, `Database/`, and
  `Integrations/`. The agent runner and its service and integration folders
  will be introduced when that runtime is implemented.
- `aep/src/Aep/Aep.sln` is the entry point for building the application and its
  `aep/tests/Aep.Tests/` xUnit project.
- `aep/dotnet-tools.json` pins the local EF Core command-line tool.
- `mcp/jira-simulator/` contains Jira Simulator.
- `mcp/jira-simulator-mcp-server/` contains its local MCP server.
- `aep/agents/` contains role descriptions for the agent pipeline.
- `aep/policies/` contains initial policy configurations; they only take effect
  when enforced by the runtime.
- `infrastructure/` contains the planned Docker configuration.
- `aep/tests/Aep.Tests/` contains .NET unit tests and opt-in isolated PostgreSQL
  integration tests.

## Open decisions

- Future agent and GitHub API contracts.
- Webhook retry/dead-letter behavior.
- Workflow states, recovery strategy, timeouts, and cancellation.
- Audit retention and backup strategy.
- Docker network policy, resource limits, and workspace cleanup.
- GitHub token management, allowed repositories, and branch/PR conventions.
- Agent output contracts, model/CLI versions, and observability.
