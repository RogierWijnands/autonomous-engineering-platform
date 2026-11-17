# Contributing

## Workspace agent

In VS Code, select **Orchestrator** from the chat agent picker for a
single entry point. It chooses the most relevant role description from
`agents/` based on your request. The role files remain the source of truth; the
workspace agent applies them as instructions rather than launching separate
agents.

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
