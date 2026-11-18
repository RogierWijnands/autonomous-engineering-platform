# Jira execution intake and dashboard

## What works now

The trigger is the explicit **Execute** confirmation, not dragging an issue
to In Progress. The simulator sends an authenticated local webhook; AEP checks
its signature and payload, reads the current issue through the local simulator
API, validates the repository selected by the simulator and commits a workflow, seven pending
steps, a queue event in the event history and an event receipt in PostgreSQL. Only after the
transaction commits does AEP respond with `202 Accepted`.
Reusable identifiers are defined in `aep/src/Aep/Constants/`; the queue event
keeps the persisted value `workflow.queued` for compatibility with existing history.
Workflow and step statuses use enums, while planned step names and the Jira
webhook event use reusable constants. Event actors remain the configured Jira
application name; Jira issue statuses remain externally supplied data.

The planned order is Analyst, Architect, UI/UX design, Developer, UI/UX
review, Tester and Reviewer. No worker consumes the queue in this version:
all steps remain Pending. No Copilot process, authentication, repository clone,
policy checks, approvals, GitHub actions or issue completion is performed.
The dashboard displays real persisted queue events, not agent output. Agent
logs and live execution require a future authenticated, isolated runtime.

## Configure the stack

1. Copy `.env.example` to the ignored root `.env`. Set a unique PostgreSQL
   password and **different**, unpredictable `AEP_WEBHOOK_SECRET` and
   `AEP_DASHBOARD_TOKEN` values, each at least 32 UTF-8 bytes. Keep them private;
   never commit them or paste them into issue content. The root `npm run start`
   loads the same webhook secret into both AEP and the simulator. Standalone
   starts must provide the same secret to both processes separately. The values
   in `.env.example` are nonfunctional placeholders; generate real values as
   described in the [README](../README.md#local-database). Restart the affected
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

The simulator stores repository selections in its local SQLite database. The
issue override takes precedence over the required project default. Existing
projects without a default remain readable, but must be updated in **Edit
project** before an issue can be executed, even if it has an override; the
simulator rejects the request with HTTP 409 without sending a webhook.
New or edited projects cannot be saved without a valid default. A new workflow
records the signed selection at the time
of confirmation; later edits do not change an existing workflow. Existing
`JiraRepositories` appsettings or environment mappings are no longer read;
re-enter those mappings in the simulator UI. No automatic import is performed.

The default webhook destination is
`http://127.0.0.1:5062/api/webhooks/jira`. The optional simulator environment
variable `JIRA_EXECUTION_WEBHOOK_URL` accepts only credential-free loopback
HTTP URLs. `JIRA_API_PORT` configures the loopback simulator API port used by
AEP (default 3001). Do not expose either service across networks or containers.
The AEP's `Jira:ApplicationName` setting (environment override
`Jira__ApplicationName`) defaults to `jira-simulator`. It must be 1–64
characters without control characters or surrounding whitespace. It identifies
the persisted issue source and queue audit actor, not just a display label.
Keep the existing value for existing databases: changing it creates a different
issue identity and can bypass active-workflow deduplication. Change it only as
part of a controlled database migration that reconciles existing issues and
active workflows; do not simply rename it on a live installation.
The Jira integration currently speaks the local simulator API contract; renaming
the adapter does not provide Jira Cloud compatibility.

## Duplicate requests and recovery

Each confirmation creates a new event UUID. AEP locks the issue's stable
project-ID/issue-number row in PostgreSQL and enforces a partial unique index:
at most one Received, Running or Paused workflow exists per issue. A new
confirmation while one exists returns its ID and `alreadyQueued: true`, without
adding another workflow. After Completed, Failed or Cancelled, a new event may
create a new workflow. The current version has no mechanism to advance to those
terminal states. The queue survives AEP restart.

An exact replay of the same event ID and body returns the original workflow
even after it reaches a terminal state; reuse of an event ID with a different
body returns 409. The simulator does not retry automatically. A timeout or
connection failure may occur after the database commit, so check the dashboard
before retrying. Existing databases with multiple active workflows for one
issue cannot accept the new unique index until an operator resolves the
conflict; the migration fails rather than deleting records.

## Security and operations

The signed body includes the selected repository as well as the issue key and
event ID. The HMAC covers the raw JSON body; the header is `X-Aep-Signature:
sha256=<hex>`. Missing/short secrets fail closed. The read-only dashboard API
requires `Authorization: Bearer <dashboard token>`; the API additionally
rejects non-loopback clients and non-local Host headers. The dashboard renders
issue fields as text and applies a content security policy. The simulator API
and MCP remain unauthenticated to local processes: this is not multi-user
isolation. Tokens are transmitted over loopback HTTP; do not use this setup on
an untrusted host or put it behind an untrusted proxy. The `.env` is ignored,
but its filesystem permissions, backup and rotation remain the
operator's responsibility. The simulator API has no local-user authentication:
other local processes can change repository selections. Format validation is
not authorization to access a repository; before real execution, enforce a
host-side repository allowlist, least-privilege GitHub credentials and approval.

The database contains issue summaries, repository names and workflow metadata.
Protect it and plan retention and backups. An issue may contain prompt
injection; storing it does not make it an instruction. Before actual agent
execution, implement and test the policy, least-privilege authorization,
isolation, approval, prompt-injection and logging controls described in
[the security model](security-model.md). This setup is not production-ready.

## Verification

Run `dotnet test` from `aep/tests/Aep.Tests/` for the unit tests. PostgreSQL
integration tests are explicitly skipped unless `AEP_TEST_POSTGRES` is set to a
connection string for a **dedicated disposable test database**. Those tests
apply migrations and write synthetic data; never point them at your normal
database. Run the simulator webhook tests with
`node --test mcp/jira-simulator/api/test/executeJiraIssueWebhook.test.ts` from
the repository root. Browser tests for both interfaces use the isolated
Playwright setup described in [accessibility testing](accessibility-testing.md).
