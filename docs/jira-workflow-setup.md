# Jira execution intake and dashboard

## What works now

- **Execute** confirmation triggers intake; dragging an issue to In Progress
  does not. AEP verifies the local webhook, reads the issue from the simulator
  API and validates the selected repository.
- A transaction persists the workflow, seven pending steps, a queue event and
  an event receipt in PostgreSQL. Only after commit does AEP return `202 Accepted`.
- The planned order is Analyst, Architect, UI/UX design, Developer, UI/UX
  review, Tester and Reviewer. No worker consumes the queue: every step stays
  Pending. Copilot execution and authentication, repository cloning, policy
  checks, approvals, GitHub actions and issue completion are not implemented.
  The dashboard shows persisted queue events, not agent output; live execution
  and logs require a future authenticated, isolated runtime.
- Reusable identifiers live in `aep/src/Aep/Constants/`; the queue event keeps
  `workflow.queued` for compatibility. Workflow and step statuses use enums;
  step names and the Jira webhook event use constants. Actors remain the
  configured Jira application name, and Jira issue statuses are external data.

## Configure the stack

1. Copy `.env.example` to the ignored root `.env`. Set a unique PostgreSQL
   password and **different**, unpredictable `AEP_WEBHOOK_SECRET` and
   `AEP_DASHBOARD_TOKEN` values, each at least 32 UTF-8 bytes. Keep them private;
   never commit them or paste them into issue content. The root `npm run start`
   loads the same webhook secret into both AEP and the simulator. Standalone
   starts must provide the same secret to both processes separately. The values
   in `.env.example` are nonfunctional placeholders; generate real values as
   described in the [README](../README.md#start-the-project). Restart the affected
   services after changing a secret.
2. Start the stack with `npm run start` from the repository root. In Jira
   Simulator at `http://127.0.0.1:5173/`, create a project or choose **Edit
   project** and enter its required **Default GitHub repository**.
3. Optionally enter a **GitHub repository override** when creating or editing
   an issue. The issue's Details section shows the effective repository and
   whether it comes from the project or the issue. Clear the override to use
   the project default again. Values must be GitHub `owner/repository` names,
   not URLs, `.git` paths or credentials.
4. Open an issue and confirm Execute.
   Open `http://localhost:5062/`, enter the dashboard token and connect. The
   dashboard polls every three seconds, displays the latest 100 workflows, and
   reports a lost connection and retries. Its token remains in browser memory
   until disconnect or page close; it is not saved in local storage.

### Repository and endpoint settings

- Repository selections are stored in the simulator's SQLite database. An
  issue override takes precedence over the required project default. Existing
  projects without a default remain readable, but execution returns HTTP 409
  without sending a webhook until **Edit project** supplies one, even if an
  issue has an override. New or edited projects require a valid default.
- A workflow records the signed selection at confirmation; later edits do not
  alter it. Old `JiraRepositories` appsettings or environment mappings are no
  longer read or imported: re-enter them in the simulator UI.
- The default webhook is `http://127.0.0.1:5062/api/webhooks/jira`.
  `JIRA_EXECUTION_WEBHOOK_URL` accepts only credential-free loopback HTTP URLs;
  `JIRA_API_PORT` sets the simulator API port used by AEP (default 3001).
  Do not expose either service across networks or containers.
- `Jira:ApplicationName` (environment override `Jira__ApplicationName`)
  defaults to `jira-simulator` and must contain 1–64 characters without control
  characters or surrounding whitespace. It identifies the persisted issue
  source and queue actor, not just a label. Changing it can bypass active
  workflow deduplication. Keep the existing value unless a controlled database
  migration reconciles existing issues and active workflows.
- The Jira integration uses the simulator API contract; renaming the adapter
  does not provide Jira Cloud compatibility.

## Duplicate requests and recovery

- Each confirmation creates a new event UUID. AEP locks the stable
  project-ID/issue-number row and uses a partial unique index to permit at most
  one Received, Running or Paused workflow per issue.
- A new confirmation for an active workflow returns its ID and
  `alreadyQueued: true`. After Completed, Failed or Cancelled, a new event may
  create another workflow, although no mechanism advances to those states yet.
  The queue survives AEP restart.
- An exact event ID and body replay returns the original workflow even after a
  terminal state; reusing the ID with a different body returns 409.
- The simulator does not retry automatically. A timeout or connection failure
  can happen after commit, so check the dashboard before retrying.
- Existing duplicate active workflows must be resolved by an operator before
  adding the unique index; the migration fails rather than deleting records.

## Security and operations

- The signed raw JSON contains the repository, issue key and event ID; the
  header is `X-Aep-Signature: sha256=<hex>`. Missing or short secrets fail closed.
- The read-only dashboard API requires `Authorization: Bearer <dashboard token>`
  and rejects non-loopback clients and non-local Host headers. The dashboard
  renders issue fields as text and applies a content security policy.
- Simulator API and MCP access is unauthenticated for local processes. Tokens
  travel over loopback HTTP; do not use this setup on an untrusted host or
  behind an untrusted proxy. Other local processes can change repository
  selections. The ignored `.env` still needs operator-managed permissions,
  backup and rotation.
- Repository format validation is not authorization. Before real execution,
  enforce a host-side allowlist, least-privilege GitHub credentials and approval.
- Protect the database, which contains issue summaries, repositories and
  workflow metadata; plan retention and backups. Treat issue content as
  untrusted, including possible prompt injection.
- Before agent execution, implement and test policy, authorization, isolation,
  approval, prompt-injection and logging controls in the
  [security model](security-model.md). This setup is not production-ready.

## Verification

Run `dotnet test` from `aep/tests/Aep.Tests/` for the unit tests. PostgreSQL
integration tests are explicitly skipped unless `AEP_TEST_POSTGRES` is set to a
connection string for a **dedicated disposable test database**. Those tests
apply migrations and write synthetic data; never point them at your normal
database. Run the simulator webhook tests with
`node --test mcp/jira-simulator/api/test/executeJiraIssueWebhook.test.ts` from
the repository root. Browser tests for both interfaces use the isolated
Playwright setup described in [accessibility testing](accessibility-testing.md).
