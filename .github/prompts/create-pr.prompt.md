---
mode: agent
description: Branch, commit, push, and open a draft PR to develop for the current reviewed changes.
---

Create a draft pull request to `develop` for the current open changes. Execute
the workflow; do not merely propose commands.

1. Read `README.md`, `docs/contributing.md`, and any other documentation
   relevant to the changed files.
2. Inspect the current branch and worktree, including staged, unstaged, and
   untracked changes. Review each file before staging it. Never stage `.env`
   files, secrets, credentials, or unrelated changes. If unrelated work cannot
   be safely separated, stop and ask.
3. Ensure the PR will contain only commits intended for `develop`. If the
   current branch has commits not already in `develop`, stop and clarify rather
   than creating a PR with unexpected history. Otherwise, create a new,
   readable kebab-case branch name based on the actual changes. Do not switch
   away from or discard the user's open changes.
4. Run the smallest relevant build, test, and validation commands. Fix
   change-related failures and rerun them. Do not claim validation that was not
   performed; if relevant validation still fails, stop and report it before
   pushing.
5. Stage only the reviewed files and inspect the staged diff. Create a
   Conventional Commit with a concise title and a body that records both the
   implementation and the exact validation results, for example:

   ```text
   feat(scope): concise change summary

   Implementation:
   - Describe the main changes.

   Validation:
   - `command` — passed.
   ```

6. Verify the commit, then push the new branch with upstream tracking. Never
   force-push, amend an existing commit, or commit directly to `develop`.
7. Check whether a PR already exists for the branch. If not, create a draft PR
   with `gh` targeting `develop`. Its title must follow Conventional Commits;
   its body must summarize the implementation and report the exact validation.
8. Verify the PR's base, head, draft status, title, and URL with `gh pr view`.
   Report the branch, commit, validation results, and PR link. If an operation
   fails, surface the error and do not claim success.
