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

Jira Simulator runs locally with a Node.js API and SQLite persistence.
MCP and AEP integration are not implemented yet.
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
| Workflow engine | Custom persisted state machine                     |
| Database        | PostgreSQL 17                                      |
| ORM             | EF Core + Npgsql                                   |
| Agent runtime   | GitHub Copilot CLI                                 |
| MCP server      | TypeScript + official MCP SDK                      |
| Jira Simulator  | React + TypeScript, Node.js 24 + SQLite            |
| Agent isolation | Docker                                             |
| Source control  | GitHub                                             |
| Logging         | Serilog                                            |
| Tests           | xUnit (.NET), Vitest + Testing Library (simulator) |

## Workflow

1. An issue is created in Jira Simulator and moved to **In Progress**.
2. The simulator sends the issue to the AEP Orchestrator via a webhook.
3. The orchestrator checks policies, risk, and required approvals.
4. Specialized agents analyze and design the work. For interface changes,
   UI/UX provides a design handoff before development and reviews the completed
   interface before testing.
5. The .NET host manages the GitHub integration and creates a feature branch
   and draft PR.
6. A person reviews and approves the PR before changes proceed.

## Repository structure

- `src/Aep/` — one .NET web project, organized into `Controllers/`, `Models/`,
  `Services/`, `BackgroundServices/`, `Database/`, and
  `Integrations/`.
- `src/Aep/Aep.sln` — solution for the .NET application and `tests/Aep.Tests/`.
- `mcp/jira-simulator/` — standalone Jira Simulator UI; MCP integration is planned.
- `agents/` — role descriptions for the agent pipeline.
- `.github/agents/Orchestrator` — the VS Code workspace entry point that runs
  the full role sequence for every repository request.
- `.github/copilot-instructions.md` — repository-wide Copilot defaults,
  including the Orchestrator and required role handoffs.
- `agents/developer.agent.md` — the implementation role; all role files
  describe security, legal, testing, and reporting responsibilities.
- `policies/` — default, security, and risk policies.
- `infrastructure/` — Docker infrastructure.
- `tests/` — unit and integration tests.
- `docs/` — architecture, workflow, and security model.
- `docs/contributing.md` — commit message and branch contribution rules.
- `.github/` — GitHub agent and workflow configuration.

## Local database

Copy `.env.example` to `.env` in the repository root and set a unique
`POSTGRES_PASSWORD`. The local `.env` file is ignored by Git. Start PostgreSQL
from the repository root with `npm run db:up`; use `npm run db:logs` to follow
its logs and `npm run db:down` to stop it. PostgreSQL listens only on
`127.0.0.1:5432`.

The EF Core model is in `src/Aep/Models/`; its PostgreSQL context and migrations
are in `src/Aep/Database/`. Non-secret PostgreSQL connection settings (host,
port, database, and username) are in `src/Aep/appsettings.json`. The `startup`
and `db:migrate` package scripts load the password from the root `.env`; the
.NET application combines it with those settings.
You can override the resulting connection string with `ConnectionStrings__Aep`.
Agent prompts, outputs, and tool results belong in an artifact store; the
database model keeps bounded metadata, hashes, statuses, and artifact
references instead. Audit events are append-only through the EF Core context.

Run `npm run start` from the repository root to start PostgreSQL, the AEP,
the Jira Simulator Node.js API, and its Vite frontend together. The root
command starts the simulator's `npm run start`, which starts both the API and
frontend; do not start a second API separately. The simulator is available at
`http://127.0.0.1:5173/`; press Ctrl+C to stop the AEP and simulator. The app
applies checked-in EF Core migrations before accepting requests. `npm run startup`
starts only the AEP (PostgreSQL must already be running); `npm run db:migrate`
starts PostgreSQL if needed and applies migrations explicitly. Run
`npm run db:down` to stop PostgreSQL. Create future migrations with:

```sh
dotenv -e .env -- dotnet ef migrations add <MigrationName> --project src/Aep/Aep.csproj --startup-project src/Aep/Aep.csproj
```

The root start command is the standard entry point for all local application
projects and required runtime processes. New processes must be included in the
startup chain and its documentation when they are added; see
[Contributing](docs/contributing.md#local-startup).

## Jira simulator

Jira Simulator is the standalone React app and Node.js API in
`mcp/jira-simulator/`, both written in TypeScript. The API runs directly with
Node's built-in TypeScript type stripping; `npm run build` type-checks it as
well as the frontend. Install Node.js 24 or newer and run `npm install` in
that directory once, then use
`npm run start` there and open the local address printed by Vite. Projects can
be created, edited and deleted; issues belong to the selected project, can be searched
and filtered, viewed as a board or list, moved between statuses by dragging,
and created, updated or deleted. Issue details provide an edit form for all
fields available during creation. Changing a Story with subtasks into another
issue type detaches those subtasks as standalone Tasks. Stories can have
Task-only subtasks; these
remain project issues and are linked to their parent Story. On the board,
Story cards with subtasks can be expanded to show them; they start collapsed.
While dragging a top-level issue, a labeled drop area appears under each other
column's heading for moving it to that status. The status control in issue
details provides an alternative without dragging. An expanded Story's subtask
can be dragged to a drop area in any column to propose becoming a standalone
Task. The subtask details also offer a Make standalone task action. Both
actions open a confirmation where the destination column can be changed;
the drop column or current subtask status is preselected, respectively.
Dropping an issue or subtask onto a different issue proposes making it a Task
subtask of the target; confirmation converts the target to a Story if necessary.
For an existing subtask, the confirmation identifies its previous parent.
The same action is available without dragging from issue details. Both issues
retain their status. If the source Story has subtasks, the confirmation warns
that they will become standalone Tasks, as with other Story type changes.
Subtask details identify and link to their parent Story, both near the issue
heading and in the breadcrumb.
Subtasks do not appear as separate board cards, but remain available in the
list view and project totals. Search and status filters also match subtasks on
the board: matching subtasks expand under their parent Story in the Story's
column, even when the Story itself does not match. Only matching subtasks are
shown while filtering; contextual parents are labeled and counts distinguish
top-level cards from matching subtasks. Clearing filters closes automatically
expanded subtasks, but preserves those manually opened until manually closed.
In list view, subtasks appear as individual filtered rows. When the project
contains subtasks, a Subtask of column shows their parent issue IDs.
Issue-ID prefixes are derived from the first word of the project name, and renaming a project
updates issue IDs and subtask references.
Deleting a project also permanently deletes all of its issues. Deleting a Story
also permanently deletes its subtasks; deleting a subtask leaves its parent
and siblings intact. Each deletion requires confirmation and states its impact.
If the related issues changed since the confirmation opened, the API rejects
the deletion; refresh and review it again. Issue numbers are not reused within
an existing project after deletion.
The API stores data in `mcp/jira-simulator/api/jira.sqlite`. A new database
starts empty; create a project to begin. Existing databases and their contents
are not changed on upgrade, including any previously seeded demo data. To
start fresh without deleting existing data, stop the simulator and set
`JIRA_DB_PATH` to a new file before starting it again. Data survives refreshes
and restarts. The API binds to `127.0.0.1:3001`; Vite proxies `/api` from
`127.0.0.1:5173` (or `127.0.0.1:4173` for preview/tests). Both ports must be
available. `npm run start` starts the API and Vite together using the commands
in the simulator's `package.json`; extra arguments after `--` are passed to
Vite. Stopping either process also stops the other. To use `npm run preview`, start
`npm run api` separately. Set `JIRA_DB_PATH` to choose another database file,
or `JIRA_API_PORT` to choose another API port (set it for both API and Vite).
Node's built-in SQLite module may emit an experimental-feature warning.

The local API has no authentication and is not suitable for exposure to a
network or untrusted local users. It validates input, limits request size,
checks host and browser origin, and uses restrictive permissions for newly
created database files. Issue data is stored unencrypted; protect and back up
the database appropriately, and copy it only while the API is stopped. The
database and its SQLite sidecar files are ignored by Git. Deletions are
permanent; restore from a backup if deleted data is needed again.

The UI does not yet connect to MCP or the AEP. The React UI is organized into
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

Build the .NET solution from the repository root with
`dotnet build src/Aep/Aep.sln`. Run the .NET unit tests with
`dotnet test src/Aep/Aep.sln`.

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
The simulator's MCP server and the complete issue-to-pull-request workflow
are still under development.
