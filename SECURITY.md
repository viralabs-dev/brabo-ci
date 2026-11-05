# Security policy

## Supported versions

| version | supported |
|---|---|
| 0.1.x | ✅ |
| < 0.1 | ❌ (pre-release) |

The project is in `0.x`: only the latest series gets fixes. There is no
backport to earlier versions.

## Reporting a vulnerability

**Do not open a public issue for a security flaw.**

Use GitHub's private channel: **[Report a vulnerability][pvr]**
(*Security → Advisories → Report a vulnerability*). It creates an advisory
visible only to the maintainers, without leaving the platform, and it is the
preferred path — the history of the discussion stays with the repository.

If you prefer email, or if the form fails:
**daneoliveira.s@gmail.com**, with a subject starting with `[SEGURANÇA]`.

What helps in a report: what you observed, how to reproduce it, and the impact
you see. A proof of concept is welcome; exploitation against someone else's
installation is not.

**Response time:** this is a project maintained in spare time. The honest
commitment is to acknowledge receipt; there is no fix SLA.

## Scope

What **is** this project's: the code in `apps/`, `packages/`, `docker/` and
`deploy/`, and the images built from it.

What is **not**: PostgreSQL, Ollama, MinIO and the other third-party components
that Brabo orchestrates — report to them directly. The development images
(`docker-compose.yml`) use default secrets **on purpose**, and this is
documented in
[ADR 0024](docs/adr/0024-fase5-imagens-producao-ci.md); it is not a
vulnerability.

## What the project already does

To calibrate your report, what exists today:

- **User secrets** (LLM keys, git tokens) under envelope
  encryption; never in plain text in the database or in logs. Master key
  rotation is documented in the [runbook](docs/runbook.md).
- **Audited HTTP surface**: the 118 api routes are classified in
  [`docs/security-surface.md`](docs/security-surface.md), and a table test
  fails any new route without a classification.
- **Every action with an external effect** goes through approval
  (`proposed_action` + `permissions.json`, `deny` beats `allow`).
- **CI** runs gitleaks on the tree, Trivy on the images (fixable
  `HIGH`/`CRITICAL` findings fail) and dependency auditing with a gate on critical.

[pvr]: https://github.com/viralabs-dev/brabo-ci/security/advisories/new
