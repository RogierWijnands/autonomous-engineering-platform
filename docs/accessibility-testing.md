# Browser and accessibility testing

## Interactive browser review

- Start the workspace Playwright MCP server from `.mcp.json` in VS Code;
  approve it when prompted and reload the workspace if needed. Its exact
  package version is in the simulator's lockfile.
- The server uses an isolated, temporary browser profile, binds locally and is
  configured for simulator development and test origins only. It supports
  browser, keyboard and visual inspection.
- Do not enter credentials or navigate to external sites during simulator reviews.

The repeatable browser suite runs the simulator locally on port 4173 and an
isolated test API on port 4301 with an in-memory SQLite database. Each test
resets that database with test fixtures; the normal persisted database is never used:

```sh
npm run test:install-browsers --prefix mcp/jira-simulator
npm run test:e2e --prefix mcp/jira-simulator
```

The browser suite lives directly in `mcp/jira-simulator/e2e/`. Its spec files
group scenarios by feature: projects, issues and dialogs, the issue board and
list, issue status controls, and subtasks. Together they cover project creation
and renaming, issue creation and status changes, subtasks, filtering, board
drag-and-drop, deletion confirmations and dialog keyboard behavior, including relevant accessibility
semantics.

## Evidence and limits

- UI/UX and Tester record browser, operating system, tested flows and results
  against the Analyst and Architect requirement registers.
- For applicable interface changes, manually test the running interface with a
  screen reader when possible. Record the reader, browser, platform and
  observed output; otherwise report a blocked verification gap. Use the
  Guidepup VoiceOver Playwright suite when available; do not disable System
  Integrity Protection.
- E2E tests should cover relevant names, roles, states and keyboard interaction.
  Compare the rendered interface with DOM semantics, including relationships,
  reading and focus order, hidden content and live regions where relevant.
- Document evidence and limitations. DOM-based assessment estimates
  screen-reader accessibility; it does not establish actual reader behavior.
  Automated tests alone do not establish WCAG conformance. Report unavailable
  checks as verification gaps.
