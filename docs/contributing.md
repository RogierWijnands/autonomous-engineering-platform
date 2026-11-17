# Contributing

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
repository root. GitHub Actions checks commits on branch pushes, commits in
pull requests, and pull request titles.

## Branches and pull requests

- Name feature branches `feature/<short-description>`.
- Changes to `main` and `develop` must be proposed through a pull request from
  a `feature/*` branch.
- Direct updates, force pushes, and branch deletion are blocked for `main` and
  `develop`.
- Required status checks must pass before a pull request can be merged.

Repository rulesets enforce these requirements. Do not rely on local hooks
alone; hooks can be bypassed on a developer machine.
