# Security Model

## Status and scope

This document describes the intended security boundaries for the local AEP. It
is a design baseline, not a complete threat model and not evidence that
security controls have already been implemented. The JSON files in `policies/`
are configuration starting points; they provide no protection until code
validates and enforces them.

## Assets

- GitHub repositories, branches, and pull requests.
- GitHub credentials and any model access.
- Tickets and potentially confidential content in tickets or repositories.
- Workflow state, agent results, and audit data in PostgreSQL.
- The development machine and the files stored on it.
- The integrity of code, tests, and artifacts produced by agents.

## Trust boundaries

1. **External/untrusted content:** ticket descriptions, comments, repository
   files, model output, MCP responses, and tool output are data, not policy or
   instructions with elevated authority.
2. **Agent container:** code and commands in the workspace may be untrusted.
   The container is isolated and has no GitHub token, Docker socket, or access
   to personal files.
3. **AEP host:** the host performs policy checks and is the only component
   allowed to perform GitHub actions. The host itself remains a high-value
   security target.
4. **Local services:** the Jira simulator, MCP server, API, and database are
   separate trust boundaries. Only necessary connections should be allowed;
   local availability alone is not authentication.
5. **Human approval:** an approval is an explicit workflow decision and must
   be bound to the correct action and change set.

## Threats and intended controls

| Threat | Intended control |
|---|---|
| Prompt injection through tickets, code, or tool output | Treat external content as untrusted data; never allow it to change policy, permissions, or approval requirements. |
| Unintended or harmful agent actions | Restrict agent tools and workspace; perform external side effects through controlled host-side adapters. |
| Theft of GitHub credentials | Do not put GitHub tokens in the agent container, prompts, repository, or logs; allow only the host to use credentials. |
| Container escape or access to host files | Do not mount the Docker socket or personal files; restrict capabilities, mounts, network, and resources. Exact Docker hardening still needs to be designed and tested. |
| Unauthorized webhook or repeated delivery | Verify webhook authenticity, validate input, and make processing idempotent. The exact protocol and storage mechanism remain open decisions. |
| Unwanted repository or PR changes | Restrict GitHub app/token permissions and allowed repository scope; require human PR review before merging. |
| Loss or tampering of workflow/audit data | Use controlled database access, consistent writes, and appropriate backups; design retention and integrity controls before production use. |
| Secrets in logs or agent output | Redact sensitive values, restrict log access, and prevent secrets from being passed to agents. |

## Authorization and approval

- Deny by default any action that is not explicitly allowed.
- Give agent roles only the minimum task-specific tools.
- Require human approval for production-impacting changes and external
  side-effects according to policy.
- Require approval for high-risk changes; the initial classification is in
  `policies/risk-classification.json`.
- Record approvals with the actor, time, workflow, action, and change context.
  A change to the content under review invalidates the previous approval.
- Agents must not be able to lower their own risk or approval status.

The approver identity model, approval API, and behavior on rejection or timeout
still need to be designed.

## Secrets and data

- Do not commit secrets to source control; commit only non-sensitive example
  configuration.
- Do not put credentials in prompts, agent input, command lines, or unredacted
  logs.
- Choose an explicit secret store for local development and document setup
  outside version control.
- Restrict which ticket and repository data is sent to model calls; define this
  per integration and data classification.
- Define retention periods and deletion procedures for ticket content, agent
  transcripts, and audit data.

Secret storage, data classification, and retention have not yet been
implemented or finalized.

## Audit and incident response

Record at least workflow transitions, policy decisions, approvals, agent
start/end, relevant tool actions, and GitHub actions. Logs should contain
correlation IDs and avoid or redact sensitive content. Audit logging failures
must be visible; critical actions must not proceed silently if required audit
recording fails.

Before use beyond a local demo, also define an incident procedure, credential
rotation, backup recovery, and a process for stopping or canceling active agent
runs.

## Minimum security checklist before execution

- [ ] Webhook authentication, input validation, and idempotent processing.
- [ ] Least-privilege GitHub app/token with explicit repository scope.
- [ ] No GitHub token, Docker socket, or personal mounts in agent containers.
- [ ] Docker network, capability, resource, and workspace cleanup policies.
- [ ] Secure local secret management and tested log redaction.
- [ ] Durable and auditable storage for policy decisions and approvals.
- [ ] Tests for denied actions, prompt injection, and audit/policy storage failures.
- [ ] Defined cancellation, timeout, retry, and agent-run recovery behavior.
