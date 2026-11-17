# Autonomous Engineering Platform

A local mini-enterprise engineering environment where AI agents can perform
engineering work autonomously within explicit boundaries. The platform
coordinates the complete workflow from a Jira ticket to a draft pull request,
with a focus on policies, security, auditability, and human approval.

## Purpose

This project demonstrates not only AI code generation, but also how to run agent
workflows in a controlled way. Agents receive only the permissions needed for
their tasks. People review and approve risky actions and changes that require
approval.

## Architecture

```text
Local Jira simulator
        │ ticket / webhook
        ▼
.NET AEP Orchestrator ───── PostgreSQL
        │                    workflow state,
        │                    agent runs, audit logs
        ├── Policy engine
        ├── Human approvals
        ├── Agent pipeline
        │   Analyst → Architect → Implementer → Tester → Reviewer
        │   GitHub Copilot CLI, specialized agent definitions
        │
        ├── Isolated Docker workspace
        │
        └── GitHub integration ── feature branch → draft PR → human review
```

The Jira simulator and MCP server run locally. The AEP also runs locally.
Only model calls and the GitHub integration require internet access.

## Security boundaries

- The agent container receives no GitHub token, Docker socket, or access to
  personal files.
- The .NET host manages GitHub actions outside the agent container.
- Agent permissions, policies, and approval gates are explicitly constrained.
- Workflow state and agent actions are persistent and auditable.

## Technology stack

| Component | Technology |
|---|---|
| Orchestrator | .NET 10 LTS |
| API | ASP.NET Core |
| Workflow engine | Custom persisted state machine |
| Database | PostgreSQL 17 |
| ORM | EF Core + Npgsql |
| Agent runtime | GitHub Copilot CLI |
| MCP server | TypeScript + official MCP SDK |
| Jira simulator | Node.js + TypeScript |
| Agent isolation | Docker |
| Source control | GitHub |
| Logging | Serilog |
| Tests | xUnit |

## Workflow

1. A ticket is created in the local Jira simulator and moved to **In Progress**.
2. The simulator sends the ticket to the AEP Orchestrator via a webhook.
3. The orchestrator checks policies, risk, and required approvals.
4. Specialized agents analyze, design, implement, test, and review the work in
   an isolated Docker workspace.
5. The .NET host manages the GitHub integration and creates a feature branch
   and draft PR.
6. A person reviews and approves the PR before changes proceed.

## Repository structure

- `src/` — .NET components for the API, application, domain, infrastructure,
  agent runner, GitHub integration, and worker.
- `mcp/jira-simulator/` — local Jira simulator and MCP server.
- `agents/` — role descriptions for the agent pipeline.
- `policies/` — default, security, and risk policies.
- `infrastructure/` — Docker infrastructure.
- `tests/` — unit and integration tests.
- `docs/` — architecture, workflow, and security model.
- `docs/contributing.md` — commit message and branch contribution rules.
- `.github/` — GitHub agent and workflow configuration.

## Commit conventions

Commit messages and pull request titles must follow
[Conventional Commits](https://www.conventionalcommits.org/), using the
Conventional Commits types configured by Commitlint. For example:

```text
feat(api): accept Jira webhook events
docs: describe the local development workflow
```

The local `commit-msg` hook is installed when you run `npm install` from the
repository root. GitHub Actions checks commits on every branch push, all
commits in a pull request, and the pull request title. Repository rulesets
require the **Conventional commits** status check on every branch.

Pull requests targeting `main` or `develop` must come from a branch named
`feature/*`. Those branches require pull requests and the
**PR source branch policy** check; direct updates and force pushes are blocked.
Use **Settings → Rules → Rulesets** to review the active rulesets.

## Status

The repository currently contains the initial directory structure and baseline
documentation. The .NET projects, database, MCP server, and executable
workflows still need to be implemented.
