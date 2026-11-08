# Portal-OS1

The operating environment and governed runtime substrate for the MAX Universe ecosystem.

Portal-OS1 provides the core execution layer for identity continuity, simulation and replay, cryptographic governance enforcement, provider abstraction, and audit-grade production readiness.

## Architectural Hierarchy

The system is organized into these layers:

1. **Portal mission control** — operator surfaces and mission workflows in `apps/portal-os1/`.
2. **Workflow governance** — automation and governance coordination in `icvs/`.
3. **Runtime foundation** — platform-neutral primitives in `max-core/`.
4. **Worker API** — transport, authentication middleware, and D1 ledger handlers in `apps/worker/`.
5. **Integration adapters** — external service boundaries in `adapters/`.
6. **Operational records** — architecture specifications, security standards, and playbooks in `docs/`.

## Core Operating Principles

- **GitHub-native automation:** CI/CD pipelines, TypeScript checks (`tsc --noEmit`), test suites (`npm test`), and Cloudflare Worker dry runs execute in `.github/workflows/`.
- **Explicit provider states:** External service adapters use the lifecycle states `CONNECTED`, `DEGRADED`, `STALE`, `BLOCKED`, `DISCONNECTED`, and `UNCONFIGURED`.
- **Deterministic simulation and replay:** Simulation runs use versioned inputs, provenance links, and auditable confidence rules.
- **Lineage and auditability:** Identity, policy, and cryptographic state changes preserve audit lineage in D1 SQLite ledgers.

## Required Environment and Secrets

Production deployment requires provisioned environment bindings and API secrets:

- `GOVERNOR_API_TOKEN` and `STAFF_CREDENTIALS` for staff access.
- `SOVEREIGN_PUBLIC_KEY`, a 32-byte raw Ed25519 public key encoded as hex.
- `OPENAI_API_KEY`, `GEMINI_API_KEY`, and `ANTHROPIC_API_KEY` for AI provider adapters.
- D1 database bindings: `DB` and `SOVEREIGN_LEDGER`.

Keep secret values out of source control and configure them through the deployment environment.

## Repository Layout

- `apps/portal-os1/` — Portal mission control and operator surfaces.
- `apps/worker/` — API transport, Ed25519 authentication middleware, and D1 ledger handlers.
- `icvs/` — Workflow automation and governance coordination layer.
- `max-core/` — Platform-neutral foundation and runtime primitives.
- `adapters/` — Explicit integration boundaries for external service adapters.
- `docs/` — Architecture specifications, security standards, and operational playbooks.

## Definition of Done

A change is production-ready only when:

1. GitHub-native documentation and architecture records match the implementation.
2. Cryptographic signature verification and atomic nonce protections remain intact.
3. TypeScript compilation (`tsc --noEmit`) and integration tests (`npm test`) pass.
4. Monitoring, D1 audit logging, and fail-closed error boundaries are verified.

---

*Observe. Understand. Decide. Govern. Evolve.*
