# Contributing

## Workspace agent

In VS Code, select **Engineering Workflow** from the chat agent picker for a
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

- Name feature branches `feature/<short-description>`.
- Changes to `develop` must be proposed through a pull request from a
  `feature/*` branch.
- Changes to `main` must be proposed through a pull request from `develop`.
- Pull requests to `develop` are squash-merged. Pull requests to `main` use a
  merge commit so the commits already integrated into `develop` remain in
  `main`'s ancestry.
- Both protected branches require at least one human approval and all required
  status checks to pass. GitHub does not count approval from the pull request
  author.
- Direct human updates, force pushes, and branch deletion are blocked for
  `main` and `develop`.
- The `pr-source-branch-policy.yml` workflow enforces these source branch
  restrictions.

Repository rulesets enforce these requirements. GitHub does not count
approval from the pull request author, so ask another collaborator to approve
your PR. Do not rely on local hooks alone; hooks can be bypassed on a developer
machine.
