# Autonomous Engineering Platform

A local mini-enterprise engineering environment where AI agents can perform
engineering work autonomously within explicit boundaries. The platform
coordinates the complete workflow from a Jira issue to a draft pull request,
with a focus on policies, security, auditability, and human approval.

## Purpose

This project demonstrates not only AI code generation, but also how to run agent
workflows in a controlled way. Agents receive only the permissions needed for
their tasks. People review and approve risky actions and changes that require
approval.

## Architecture

```text
Jira Simulator
        │ issue / webhook
        ▼
.NET AEP Orchestrator ───── PostgreSQL
        │                    workflow state,
        │                    agent runs, audit logs
        ├── Policy engine
        ├── Human approvals
        ├── Agent pipeline
        │   Analyst → Architect → UI/UX design → Developer
        │       → UI/UX review → Tester → Reviewer
        │   GitHub Copilot CLI, specialized agent definitions
        │
        ├── Isolated Docker workspace
        │
        └── GitHub integration ── feature branch → draft PR → human review
```

For frontend changes, UI/UX provides a design brief before development and
reviews the implementation afterward. Both UI/UX stages report not applicable
when no user-facing interface changes.

Jira Simulator runs locally with a Node.js API and SQLite persistence. Its
separate MCP server exposes bounded issue tools. AEP accepts authenticated
execution requests and records a durable queue, but does not run agents yet.
The AEP also runs locally. Only model calls and the GitHub integration require
internet access.

## Security boundaries

- The agent container receives no GitHub token, Docker socket, or access to
  personal files.
- The .NET host manages GitHub actions outside the agent container.
- Agent permissions, policies, and approval gates are explicitly constrained.
- Workflow state and agent actions are persistent and auditable.

## Technology stack

| Component       | Technology                                         |
| --------------- | -------------------------------------------------- |
| Orchestrator    | .NET 10 LTS                                        |
| API             | ASP.NET Core                                       |
| Workflow engine | Persisted queue; state machine planned             |
| Database        | PostgreSQL 17                                      |
| ORM             | EF Core + Npgsql                                   |
| Agent runtime   | GitHub Copilot CLI (planned)                       |
| MCP server      | TypeScript + Express + official MCP SDK            |
| Jira Simulator  | React + TypeScript, Node.js 24 + Express + SQLite  |
| Agent isolation | Docker (planned)                                   |
| Source control  | GitHub                                             |
| Logging         | ASP.NET Core logging                               |
| Tests           | xUnit (.NET), Vitest + Testing Library (simulator) |

## Workflow

1. An issue is created in Jira Simulator.
2. A user confirms **Execute** in its details; the simulator sends an execution
   request to the AEP Orchestrator via a webhook.
3. AEP authenticates the webhook, selects the configured repository and queues
   the seven planned steps without starting them.
4. In a future runtime, the orchestrator checks policies, risk and approvals.
   Specialized agents analyze and design the work. For interface changes,
   UI/UX provides a design handoff before development and reviews the completed
   interface before testing.
5. The .NET host manages the GitHub integration and creates a feature branch
   and draft PR.
6. A person reviews and approves the PR before changes proceed.

## Repository structure

- `aep/src/Aep/` — one .NET web project, organized into `Controllers/`, `Models/`,
  `Services/`, `Database/`, and `Integrations/`.
- `aep/src/Aep/Aep.sln` — solution for the .NET application and `aep/tests/Aep.Tests/`.
- `mcp/jira-simulator/` — standalone Jira Simulator UI and API.
- `mcp/jira-simulator-mcp-server/` — local Node.js MCP server for Jira issues.
- `aep/agents/` — role descriptions for the agent pipeline.
- `.github/agents/Orchestrator` — the VS Code workspace entry point that runs
  the full role sequence for every repository request.
- `.github/copilot-instructions.md` — repository-wide Copilot defaults,
  including the Orchestrator and required role handoffs.
- `aep/agents/developer.agent.md` — the implementation role; all role files
  describe security, legal, testing, and reporting responsibilities.
- `aep/policies/` — default, security, and risk policies.
- `infrastructure/` — Docker infrastructure.
- `aep/tests/` — .NET unit tests and the AEP startup watcher test.
- `docs/` — architecture, workflow, and security model.
- `docs/contributing.md` — commit message and branch contribution rules.
- `.github/` — GitHub agent and workflow configuration.

## Local database

Copy `.env.example` to `.env` in the repository root and set a unique
`POSTGRES_PASSWORD`, plus independent `AEP_WEBHOOK_SECRET` and
`AEP_DASHBOARD_TOKEN` values of at least 32 UTF-8 bytes each. The local `.env`
file is ignored by Git. Configure the required Jira project repository in the
project form; an issue can optionally override it. See
[Jira workflow setup](docs/jira-workflow-setup.md). Start PostgreSQL
from the repository root with `npm run db:up`; use `npm run db:logs` to follow
its logs and `npm run db:down` to stop it. PostgreSQL listens only on
`127.0.0.1:5432`.

The webhook and dashboard values in `.env.example` are deliberately short
placeholders, not usable secrets. Generate two different random values locally,
for example with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`
run twice; put one in each field without sharing or committing them. Restart the
local services after changing either value.

The EF Core model is in `aep/src/Aep/Models/`; its PostgreSQL context and migrations
are in `aep/src/Aep/Database/`. Non-secret PostgreSQL connection settings (host,
port, database, and username) are in `aep/src/Aep/appsettings.json`. The `startup`
and `db:migrate` package scripts load the password from the root `.env`; the
.NET application combines it with those settings.
You can override the resulting connection string with `ConnectionStrings__Aep`.
Agent prompts, outputs, and tool results belong in a future artifact store;
the current database keeps workflow and event history metadata. Event history
is append-only through the EF Core context.

Install dependencies with `npm install` in the repository root,
`mcp/jira-simulator/`, and `mcp/jira-simulator-mcp-server/`.

- `npm run start` starts PostgreSQL, AEP, the simulator API and frontend, and
  the MCP server. The simulator's child command already starts its API; do not
  start a second one.
- Open the simulator at `http://127.0.0.1:5173/`, MCP at
  `http://127.0.0.1:3002/mcp`, or the authenticated dashboard at
  `http://localhost:5062/`.
- Ctrl+C stops the applications; `npm run db:down` stops PostgreSQL.
- AEP applies checked-in migrations before accepting requests. `npm run startup`
  starts only AEP and requires PostgreSQL; `npm run db:migrate` starts PostgreSQL
  if needed and applies migrations explicitly.

Create future migrations with:

```sh
(cd aep && npx dotenv -e ../.env -- dotnet ef migrations add <MigrationName> --project src/Aep/Aep.csproj --startup-project src/Aep/Aep.csproj)
```

- The root command watches application code: changes restart AEP and the
  affected Node.js server; Vite updates the frontend. Restart an already
  running stack once to enable watchers.
- `npm run startup`, the simulator's `npm run api`, and the MCP server's
  `npm run start` are single-run commands.
- A watched server crash stops the other applications. Correct the error and
  rerun the root command.
- Include new required processes in the root startup chain and documentation;
  see [Contributing](docs/contributing.md#local-startup).

## Jira simulator

Jira Simulator is a React app and Node.js API in `mcp/jira-simulator/`.
It requires Node.js 24 or newer. The API uses Node's TypeScript type stripping;
`npm run build` type-checks both API and frontend.

### Projects, issues and subtasks

- Create, edit and delete projects and issues; search and filter issues in
  board or list view. Issue details can edit all fields available at creation.
- The board column's plus button creates an issue in that status; the main
  Create issue button and the API's optional `status` default to To Do. Move
  issues using the labeled column drop areas or the status control in details.
- Stories can have Task-only subtasks. Board cards start collapsed and expand
  to show them; subtask details link to the parent in the heading and breadcrumb.
- To make a subtask standalone, use its details action or drag it to a column
  drop area. Confirm the destination, initially the current or dropped status.
- Drop an issue or subtask on another issue, or use issue details, to propose a
  Task subtask. Confirmation converts the target to a Story if needed and
  identifies a previous parent; both statuses remain unchanged. Changing a
  Story with subtasks to another type detaches those subtasks as standalone
  Tasks; the confirmation for making a Story a subtask warns about this.
- Subtasks count as project issues and appear as list rows, not separate board
  cards. Search and status filters expand matching subtasks under their Story,
  even if the Story does not match. Only matches are shown, contextual parents
  are labeled, and counts distinguish cards from matching subtasks. Clearing
  filters closes automatic expansions but preserves manual ones. The list
  shows a Subtask of column when the project has subtasks.
- Issue prefixes come from the project's first word; renaming updates issue IDs
  and subtask references. Numbers are not reused within an existing project.
- Deleting a project permanently deletes its issues; deleting a Story deletes
  its subtasks, while deleting a subtask leaves its parent and siblings intact.
  Confirmations state the impact. If related issues change before confirmation,
  deletion is rejected: refresh and review again.

### Simulator storage and startup

- The default SQLite database is `mcp/jira-simulator/api/database/jira.sqlite`;
  a new database starts empty. Data persists across refreshes and restarts.
- The old `mcp/jira-simulator/api/jira.sqlite` is not detected automatically.
  Set `JIRA_DB_PATH` to it or move it before startup, otherwise a new empty
  database is created. To move it, stop the simulator and all database clients,
  make a verified backup, then move the database and matching `-wal`, `-shm`,
  or `-journal` files together without overwriting existing files. To start
  fresh without deleting data, stop the simulator and set `JIRA_DB_PATH` to a
  new file.
- The API binds to `127.0.0.1:3001`; Vite proxies `/api` from
  `127.0.0.1:5173` or preview/test port `4173`. Both ports must be available.
  Set `JIRA_API_PORT` for both API and Vite to change the API port.
- To run the simulator separately, use `npm run start` in its directory and
  open the address printed by Vite. It starts the API and Vite with watchers;
  arguments after `--` go to Vite. Stopping either stops the other. For
  preview, start `npm run api` separately; it runs without a watcher. Node's
  built-in SQLite module may emit an experimental-feature warning.
- The API is unauthenticated and unsuitable for networks or untrusted local
  users. It validates input, bounds requests, checks host and browser origin,
  and restricts permissions on new database files; these are not authentication.
- Data is unencrypted. Protect and back up the database, and copy it only with
  the API and all database clients stopped. Database and SQLite sidecar files
  are ignored by Git. Deletions are permanent; restore from backup if needed.

### Execution and evidence

- **Execute** is available for any issue, regardless of status. AEP returns an
  existing queued, active or paused workflow; a new request can create another
  after completion, failure or cancellation. Acceptance means queued, not
  started. On uncertain delivery, check AEP before retrying; the simulator
  neither retries automatically nor changes issue status.
- Each confirmation sends one JSON `POST`, with a new UUID, issue key and
  selected repository, to `http://127.0.0.1:5062/api/webhooks/jira` by default.
  `JIRA_EXECUTION_WEBHOOK_URL` accepts only credential-free HTTP URLs on
  `127.0.0.1` without queries or fragments; redirects are not followed.
  HMAC-SHA256 signs the exact body using `AEP_WEBHOOK_SECRET`; AEP verifies it
  and reads the issue from the simulator. Agent execution, policy enforcement,
  approvals and GitHub actions are not implemented. See
  [Jira workflow setup](docs/jira-workflow-setup.md).
- Labels appear in **Details**; **Evidence** is separate from the description.
  Empty or whitespace-only evidence without images shows **Add evidence**;
  otherwise it shows **Edit evidence**. Existing issues need no evidence.
- The editor supports bold, italic, bullets and up to three embedded static
  PNG, JPEG or WebP images, each at most 512,000 bytes and 4096 × 4096 pixels.
  **Insert Image** accepts an optional description, recommended for screen
  readers. Tab to an image and press Delete or Backspace to remove it. Pasted
  text is plain text; external image URLs are rejected.
- Concurrent evidence edits conflict: refresh and review before retrying.
  Evidence is stored unencrypted, so do not include secrets.

The React UI is organized into
reusable components under `src/components/common/`, `src/components/issues/`,
and `src/components/projects/`; example data is used only as test fixtures. Run its unit
tests and production build from the repository root:

```sh
npm run format:check --prefix mcp/jira-simulator
npm test --prefix mcp/jira-simulator
npm run test:api --prefix mcp/jira-simulator
npm run test:startup --prefix mcp/jira-simulator
npm run build --prefix mcp/jira-simulator
npm audit --prefix mcp/jira-simulator
```

Use `npm run format --prefix mcp/jira-simulator` to format its `.ts` files
with Prettier. See [Contributing](docs/contributing.md#code-readability-and-formatting).

For interactive browser review, VS Code can start the isolated Playwright MCP
server configured in `.mcp.json` after you approve it. Run the
repeatable browser suite with `npm run test:e2e --prefix mcp/jira-simulator`.
Browser review setup and commands are documented in
[Accessibility testing](docs/accessibility-testing.md).

The simulator targets WCAG 2.2 AA for its user-facing interface, including
keyboard-operable dialogs, visible focus, accessible status announcements, and
responsive reflow. Requirements, constraints, and acceptance criteria are
traced from Analyst through Architect, Developer, both UI/UX handoffs, and
Tester. Relevant user journeys and accessibility semantics are covered by
E2E tests, whose coverage UI/UX reviews. Automated checks alone do not
establish WCAG conformance.

## Jira Simulator MCP

The MCP server uses the official MCP SDK and stateless Streamable HTTP at
`http://127.0.0.1:3002/mcp`. VS Code can connect using `.mcp.json`; start the
root stack first. To start only this server, run
`npm run start --prefix mcp/jira-simulator-mcp-server` and start the simulator
API separately. Set `JIRA_MCP_PORT` to change the MCP port and `JIRA_API_PORT`
to the simulator API's port. If changing the MCP port, update the client URL
in `.mcp.json` as well.

- `list_issues` and `get_issue` read issues. `get_issue` returns the complete
  issue as JSON and evidence images as MCP image content.
- `update_evidence` replaces evidence using the previously read document as
  `expected` (`null` when absent). It rejects stale evidence and changes neither
  description nor other fields.
- `complete_issue` atomically permits only In Progress → Done. Creation,
  deletion, description editing and other status transitions are unavailable.
- Evidence documents use `doc`, `paragraph`, `bulletList`, `listItem`, `text`,
  `hardBreak` and `image` nodes with `bold` and `italic` marks. Image `attrs`
  contain `src` (base64 data URL) and optional `alt` (up to 200 characters,
  empty, null or omitted). The API and editor share image and text limits; the
  API also limits text to 20,000 characters and serialized documents to
  2,500,000 characters.
- Tool-handler results append a notice that simulator data, images and errors
  are untrusted. The original JSON or error remains the first text item and
  images remain separate items. The notice neither prevents prompt injection
  nor authorizes actions; clients enforce task, permission and approval
  boundaries. The generic tool runner delegates extra content to an extractor;
  its evidence extractor handles supported images only. Other file types need
  explicit validation and client compatibility.

The simulator API exposes:

- `GET /api/issues`, with optional `projectId`, and `GET /api/issues/:key`.
- `POST /api/issues/evidence`, with `key`, `expected` and `evidence`.
- `POST /api/issues/complete`, with `key`.

POST routes return the simulator snapshot, or only `{ issue }` with
`?response=issue`. MCP uses the issue-only response to avoid exposing
unrelated data.

The MCP server and simulator API are unauthenticated and bound to loopback;
host and browser-origin checks are not authentication. Any untrusted local
process can access them. Do not expose them to a network, multi-user machine
or untrusted agent. The MCP server runs locally; container access would require
a separately designed authenticated, least-privilege boundary.

Validate the new server from the repository root:

```sh
npm run format:check --prefix mcp/jira-simulator-mcp-server
npm run build --prefix mcp/jira-simulator-mcp-server
npm test --prefix mcp/jira-simulator-mcp-server
npm audit --prefix mcp/jira-simulator-mcp-server
```

Build the .NET solution from the repository root with
`dotnet build aep/src/Aep/Aep.sln`. Run the .NET unit tests from the repository
root with `(cd aep/tests/Aep.Tests && dotnet test)`.

## Commit conventions

Commit messages and pull request titles must follow
[Conventional Commits](https://www.conventionalcommits.org/), using the
Conventional Commits types configured by Commitlint. For example:

```text
feat(api): accept Jira webhook events
docs: describe the local development workflow
```

The local `commit-msg` hook is installed when you run `npm install` from the
repository root. The **Conventional commits** GitHub Actions workflow checks
commits on every branch push, all commits in a pull request, and the pull
request title. Repository rulesets require that status check on every branch.

Pull requests to `develop` may come from branches with any name and are
squash-merged. Pull requests to `main` must come from `develop` and use a merge
commit. Both branches require a human approval and passing status checks for
normal merges; the repository owner can bypass the approval rule, but that
does not count as an approval. Direct updates and force pushes are blocked.
Merged pull request source branches are automatically deleted, while protected
branches remain protected.
This keeps the `develop` history as an ancestor of `main`, so merging a fully
integrated `develop` into `main` does not introduce code changes already
present in `develop`. See [Contributing](docs/contributing.md) for details. Use
**Settings → Rules → Rulesets** to review the active rulesets.

## Status

The repository contains one .NET web project, workflow models, PostgreSQL
persistence, an initial schema migration, and a standalone Jira simulator UI.
The simulator MCP server is available locally; the complete
issue-to-pull-request workflow remains under development.
