# Contributing

## Workspace agent

- In VS Code, use **Orchestrator** for repository work. It applies Analyst →
  Architect → UI/UX design → Developer → UI/UX review → Tester → Reviewer,
  passing each handoff to the next role.
- For frontend changes, UI/UX provides a design brief and reviews the result.
  Otherwise both stages explain why they are not applicable. All roles use
  WCAG 2.2 AA as the engineering target for user-facing interfaces, not as a
  claim of legal compliance.
- Every role reports its work and explains unnecessary work, such as tests for
  documentation-only changes. The role files in `aep/agents/` remain the
  source of truth; the workspace agent applies them as instructions rather
  than launching separate agents.

## Local startup

- Root `npm run start` starts all local applications and required services.
  Add new processes to that chain in the same change, directly or through an
  existing child script. Avoid duplicates, update setup documentation and
  verify startup and shutdown.
- Respect the security model and approval boundaries. Explicitly report services
  that cannot be started safely rather than silently omitting them.

The root command runs AEP, the simulator API, and the MCP server with
development watchers, and the frontend with Vite. Verify code changes are
reloaded when modifying these startup scripts. The standalone AEP `startup`,
simulator `api`, and MCP `start` scripts do not watch for changes.
Run `npm run test:dev` at the root for the AEP startup scripts and watcher tests
in `aep/tests/`. Run `npm run test:startup` in the simulator directory for its
watcher and startup failures, and `npm test` in the MCP server directory for
its watcher.

## Code readability and formatting

Keep API entrypoints focused and organize routes and related functionality into
readable modules or folders by responsibility. Preserve common security checks
at the shared request boundary and avoid unnecessary layers or indirection.

Write clear control flow with descriptive names and blank lines that separate
logical steps, validation, control flow and returns where helpful.
When creating or changing code, assess logical blocks for concise section
comments that clarify non-obvious purpose, boundaries or behavior, including
business rules and security constraints. Avoid comments that merely restate code.
Format every created or changed file, including tests, documentation and
configuration, using the applicable project or language formatter and run
its check. For non-text or unsupported files, review the format manually and
report the exception. Review code for meaningful whitespace separately:
automatic formatters do not decide where logical steps need separation.

The Jira Simulator uses Prettier for its `.ts` files, including its API,
tests, and configuration. Run `npm run format --prefix mcp/jira-simulator` to
format them and `npm run format:check --prefix mcp/jira-simulator` to verify
them. For other changed Prettier-supported files, pass their paths to
`npm run format:file --prefix mcp/jira-simulator -- <paths>` and
`npm run format:check:file --prefix mcp/jira-simulator -- <paths>`; paths are
relative to the simulator directory. This includes `.tsx`, JSON, CSS, HTML
and Markdown files.

## Commit messages

All commits must follow Conventional Commits:

```text
type(scope): short description
```

Examples:

```text
feat(api): accept Jira webhook events
docs: describe the local development workflow
```

The local Commitlint hook is installed by running `npm install` from the
repository root. The `conventional-commits.yml` GitHub Actions workflow checks
commits on branch pushes, commits in pull requests, and pull request titles.
Commit messages should include an implementation summary and the exact
validation performed in the body.

## Branches and pull requests

- Use a descriptive name for your working branch; no particular prefix is
  required.
- Changes to `develop` must be proposed through a pull request from a branch
  with any name.
- Changes to `main` must be proposed through a pull request from `develop`.
- Pull requests to `develop` are squash-merged. Pull requests to `main` use a
  merge commit so the commits already integrated into `develop` remain in
  `main`'s ancestry.
- Both protected branches require at least one human approval and all required
  status checks to pass. GitHub does not count approval from the pull request
  author. The repository owner can bypass the approval rule when merging a
  pull request; this is not recorded as an approval and is not limited to
  owner-authored pull requests.
- Direct human updates, force pushes, and branch deletion are blocked for
  `main` and `develop`.
- Merged pull request source branches are automatically deleted. Protected
  branches such as `develop` and `main` are retained.
- The `pr-source-branch-policy.yml` workflow enforces the rule that pull
  requests to `main` must come from `develop`.

Repository rulesets enforce these requirements. Do not rely on local hooks
alone; hooks can be bypassed on a developer machine.

## Creating a pull request

In the VS Code Orchestrator chat, ask **"Maak een PR"** to run the standard
workflow for the current open changes. The `/create-pr` skill is also
available. It reviews the changes, creates a descriptive branch, runs relevant
validation, writes a Conventional Commit with implementation and validation
details, pushes the branch, and opens a draft PR to `develop`.

The workflow stages only reviewed, relevant files. It never includes `.env`
files, secrets, or unrelated work. If the branch contains commits not already
in `develop`, or the changes cannot safely be separated, it pauses for
clarification rather than creating a misleading PR.
