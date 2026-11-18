# Security Model

## Status and scope

This document describes the intended security boundaries for the local AEP. It
is a design baseline, not a complete threat model and not evidence that
security controls have already been implemented. The JSON files in `aep/policies/`
are configuration starting points; they provide no protection until code
validates and enforces them.

## Assets

- GitHub repositories, branches, and pull requests.
- GitHub credentials and any model access.
- Issues and potentially confidential content in issues or repositories.
- Workflow state, agent results, and audit data in PostgreSQL.
- The development machine and the files stored on it.
- The integrity of code, tests, and artifacts produced by agents.

## Trust boundaries

1. **External/untrusted content:** issue descriptions, comments, repository
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

### Current local boundaries

- The simulator API and MCP server do not authenticate local processes.
  Loopback bindings and host/origin checks reduce exposure, but do not protect
  against untrusted local users or processes. MCP exposes only issue reads,
  conflict-checked evidence replacement and In Progress → Done; do not expose
  it across containers or networks without an authenticated, authorized boundary.
- Issue content and evidence are untrusted and may contain prompt injection.
  Evidence is unencrypted in SQLite; images must not contain secrets and are
  restricted to bounded, embedded PNG, JPEG or WebP data.
- The simulator uses parameterized SQLite queries and renders form text as
  React text, not HTML. It validates allowlisted evidence on writes and reads
  and before display or editing; invalid evidence is reported, not rendered.
  Only validated embedded images are accepted. The browser validates project
  and issue shapes; markup-like text remains text rather than being rejected.
  None of these controls authenticates the API or makes local processes trusted.
- MCP results append an untrusted-data notice while preserving the original
  JSON and images. This guides clients but is neither an enforced boundary nor
  a guarantee against prompt injection.
- The execution webhook sends the issue key, repository and a new event ID to a
  loopback HTTP endpoint without redirects. AEP validates the raw JSON's
  HMAC-SHA256 signature. Event receipts and a database uniqueness constraint
  prevent duplicate active requests; the read-only dashboard uses a separate
  bearer token. These are local development boundaries, not multi-user isolation.
- Repository selections are editable through the unauthenticated simulator API.
  HMAC protects transit, not source integrity or user authorization. Validate
  the name as data and require an independent host-side repository allowlist
  and approval before GitHub actions or agent execution; a valid
  `owner/repository` is not authorization.
- Do not enable actual agent execution until host authorization, isolation,
  approval and policy controls are implemented and tested.

## Threats and intended controls

| Threat                                                | Intended control                                                                                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Prompt injection through issues, code, or tool output | Treat external content as untrusted data; never allow it to change policy, permissions, or approval requirements.                                                        |
| Injection via forms or dynamic content                | Validate structured input at trust boundaries, render text with context-appropriate encoding, parameterize database queries, and never execute data as code or commands. |
| Unintended or harmful agent actions                   | Restrict agent tools and workspace; perform external side effects through controlled host-side adapters.                                                                 |
| Theft of GitHub credentials                           | Do not put GitHub tokens in the agent container, prompts, repository, or logs; allow only the host to use credentials.                                                   |
| Container escape or access to host files              | Do not mount the Docker socket or personal files; restrict capabilities, mounts, network, and resources. Exact Docker hardening still needs to be designed and tested.   |
| Unauthorized webhook or repeated delivery             | HMAC authentication, bounded input, event receipts and a PostgreSQL unique active-issue index; shared local secrets are not multi-user authorization.                    |
| Unwanted repository or PR changes                     | Restrict GitHub app/token permissions and allowed repository scope; require human PR review before merging.                                                              |
| Loss or tampering of workflow/audit data              | Use controlled database access, consistent writes, and appropriate backups; design retention and integrity controls before production use.                               |
| Secrets in logs or agent output                       | Redact sensitive values, restrict log access, and prevent secrets from being passed to agents.                                                                           |

## Authorization and approval

- Deny by default any action that is not explicitly allowed.
- Give agent roles only the minimum task-specific tools.
- Require human approval for production-impacting changes and external
  side-effects according to policy.
- Require approval for high-risk changes; the initial classification is in
  `aep/policies/risk-classification.json`.
- Record approvals with the actor, time, workflow, action, and change context.
  A change to the content under review invalidates the previous approval.
- Agents must not be able to lower their own risk or approval status.

The approver identity model, approval API, and behavior on rejection or timeout
still need to be designed.

## Legal, privacy, and dependency requirements

- Check applicable legal, privacy, and data-protection requirements when
  handling issue, repository, or user data; minimize data collection and
  exposure.
- Respect intellectual-property rights, open-source licenses, and third-party
  terms when selecting dependencies or using external content.
- Treat these guidelines as engineering constraints, not legal advice. Surface
  uncertainty for qualified review instead of making unsupported legal claims.
- For development changes, inspect direct and transitive dependencies for
  known vulnerabilities, review changed code for security weaknesses, and test
  relevant security boundaries. Report unresolved findings explicitly.
- Add focused unit tests by default for all newly built or changed behavior.
- Keep form and loaded data as data, not HTML, script, SQL, shell commands, or
  agent instructions. Validate structured content before it reaches a renderer
  or editor, encode output for its actual context, and use parameterized
  database queries. Avoid raw HTML and dynamic code execution; if a future
  feature needs rich HTML or external URLs, design and test a restrictive
  sanitization and URL policy before enabling it.
- Test malicious markup, unsafe URLs and SQL metacharacters as well as normal
  content through storage and retrieval. These controls do not replace
  authentication, authorization, dependency audits, or agent isolation.

## Prompt injection requirements

- Treat all issue and project fields, evidence images, repository files,
  MCP responses, tool output and errors as untrusted data. Do not let their
  instructions change the authorized task, permissions, policies or approvals.
- The future host must enforce tool and action authorization independently of
  model output, deny actions outside the explicitly approved scope by default,
  and require human review if scope or intent is ambiguous. It must not rely
  on a model, a notice, or a keyword filter as the security boundary.
- Label untrusted inputs when providing them to agents, minimize the content
  and permissions supplied, and test adversarial instructions in text, images
  and tool errors. Avoid copying secrets into agent context.
- These are requirements for the future agent runner, not implemented
  protections: do not enable real automated workflows until the host-side
  authorization, isolation, approval and audit controls are implemented and
  tested. No defense can guarantee detection of every prompt injection.

## Secrets and data

- Do not commit secrets to source control; commit only non-sensitive example
  configuration.
- Treat `.env` files, process environment variables, appsettings, CI variables,
  certificates, private keys, connection strings, tokens, and signing keys as
  sensitive configuration. Do not print or copy actual values into prompts,
  agent input, command lines, test fixtures, screenshots, or unredacted logs.
- Ensure secret-bearing local files are ignored by version control. Examples
  and test fixtures use fake placeholders only.
- Validate required configuration without echoing the supplied value in
  exceptions or logs. Use least-privilege credentials with narrow scope and
  lifetime, and define rotation or revocation procedures where applicable.
- Minimize access to adjacent sensitive information, including personal data,
  cookies, and customer identifiers.
- Choose an explicit secret store for local development and document setup
  outside version control.
- Restrict which issue and repository data is sent to model calls; define this
  per integration and data classification.
- Define retention periods and deletion procedures for issue content, agent
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
- [ ] Secret/configuration files are ignored; no real keys or sensitive
      environment values are present in source, tests, command output, or logs.
- [ ] Durable and auditable storage for policy decisions and approvals.
- [ ] Dependency vulnerability checks and security-focused code review/tests.
- [ ] Focused unit tests for all newly built or changed behavior.
- [ ] Tests for denied actions, prompt injection, and audit/policy storage failures.
- [ ] Host-enforced tool authorization and adversarial prompt-injection tests;
      untrusted-content notices alone are not sufficient.
- [ ] Context-aware output encoding, parameterized queries, dynamic-content
      validation, and injection regression tests at every applicable boundary.
- [ ] Defined cancellation, timeout, retry, and agent-run recovery behavior.
