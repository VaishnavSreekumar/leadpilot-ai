# LEADPILOT AI — PHASE 1 & 2 VERIFICATION GAPS & REMEDIATION REGISTER

This document tracks all security, concurrency, and reliability gaps identified during the independent audit, along with their resolution status following the Phase 1.1 remediation cycle.

---

## REMEDIATION SUMMARY TABLE

| Gap ID | Severity | Target Module | Description | Status |
|---|:---:|---|---|:---:|
| **GAP-01** | **HIGH** | `lib/security/rate-limit.ts` | Spoofed `X-Forwarded-For` bypasses rate limiter | **FIXED AND VERIFIED** |
| **GAP-02** | **HIGH** | `lib/auth/session.ts` | Plaintext session tokens stored in PostgreSQL | **FIXED AND VERIFIED** |
| **GAP-03** | **MEDIUM** | `lib/auth/authorize.ts`, `app/api/leads/route.ts` | Legacy unassigned leads (`userId === null`) accessible to any user | **FIXED AND VERIFIED** |
| **GAP-04** | **MEDIUM** | `lib/reliability/ai-request.ts` | `withTimeout` does not cancel underlying Gemini HTTP socket | **FIXED AND VERIFIED** |
| **GAP-05** | **MEDIUM** | `lib/reliability/cooldown.ts` | Cooldown release overwrites newer concurrent request timestamps | **FIXED AND VERIFIED** |
| **GAP-06** | **MEDIUM** | `app/api/leads/[id]/analyze/route.ts` | Missing fencing token permits stale analysis overwrite after reclaim | **FIXED AND VERIFIED** |
| **GAP-07** | **LOW** | `app/login/page.tsx` | Shared public demo credentials cause state pollution between visitors | **KNOWN LIMITATION** |
| **GAP-08** | **LOW** | `test/reliability-engineering.test.ts` | Unit-level mocking in cooldown tests disconnected from Neon row locks | **KNOWN LIMITATION** |

---

## GAP-01: Client IP Spoofing via Untrusted `X-Forwarded-For` Header

- **Severity:** **HIGH**
- **Status:** **FIXED AND VERIFIED**
- **File:** `lib/security/rate-limit.ts` (`getClientIp`, `isValidIp`)
- **Remediation Details:**
  1. Priority given to edge-authenticated headers (`x-real-ip` on Vercel, `cf-connecting-ip` on Cloudflare) which are injected by infrastructure and cannot be forged by downstream clients.
  2. For multi-hop `x-forwarded-for`, extracts the **rightmost** (last) proxy-added hop, ignoring spoofed client-supplied leftmost values.
  3. Validates IP syntax via `isValidIp()` for both IPv4 and IPv6, safely falling back to `'127.0.0.1'` for malformed headers or local development.
- **Verification Evidence:** `test/rate-limit.test.ts` and `test/verification-gaps.test.ts`.

---

## GAP-02: Plaintext Raw Session Tokens Stored in Database

- **Severity:** **HIGH**
- **Status:** **FIXED AND VERIFIED**
- **File:** `lib/auth/session.ts` (`createSession`, `validateSessionToken`, `destroySession`, `hashSessionToken`)
- **Remediation Details:**
  1. Generated raw 32-byte (64 hex characters) token is hashed with `SHA-256` before writing to `prisma.session.create`.
  2. Database stores only the SHA-256 digest (`tokenHash`).
  3. When validating or destroying a session, the incoming raw token is hashed before querying `prisma.session.findUnique({ where: { token: tokenHash } })`.
  4. Raw tokens are never stored in PostgreSQL.
- **Verification Evidence:** `test/security-foundation.test.ts` (Test: `stores SHA-256 digest in database, never the raw token`).

---

## GAP-03: Legacy Lead Data Isolation & Quarantine

- **Severity:** **MEDIUM**
- **Status:** **FIXED AND VERIFIED**
- **Files:** `lib/auth/authorize.ts`, `app/api/leads/route.ts`
- **Remediation Details:**
  1. `assertLeadAccess` strictly requires `lead.userId === userId`. If `lead.userId === null` (unassigned legacy lead), access is denied with HTTP 404.
  2. `GET /api/leads` strictly filters by `where: { userId: user.id }`.
  3. Legacy unassigned leads are safely preserved in the database (never deleted), but quarantined from unauthorized access.
- **Verification Evidence:** `test/security-foundation.test.ts` and `test/verification-gaps.test.ts` (Test: `quarantines unassigned leads (userId === null) and blocks unowned user access`).

---

## GAP-04: Actual AI Request Cancellation via AbortSignal

- **Severity:** **MEDIUM**
- **Status:** **FIXED AND VERIFIED**
- **Files:** `lib/reliability/ai-request.ts`, `lib/ai/lead-analysis.ts`, `lib/ai/sales-assistant.ts`, `lib/ai/follow-up.ts`
- **Remediation Details:**
  1. `withTimeout()` creates an `AbortController` and passes `controller.signal` into `@google/genai` via `config.abortSignal`.
  2. When the 15-second timeout fires, `controller.abort()` is invoked, terminating the underlying HTTP socket immediately.
- **Verification Evidence:** `test/reliability-engineering.test.ts` and `test/verification-gaps.test.ts`.

---

## GAP-05: Safe Cooldown Release via Compare-And-Swap (CAS)

- **Severity:** **MEDIUM**
- **Status:** **FIXED AND VERIFIED**
- **Files:** `lib/reliability/cooldown.ts`, `app/api/leads/[id]/chat/route.ts`, `app/api/leads/[id]/follow-up/route.ts`
- **Remediation Details:**
  1. `acquireLeadCooldown` records and returns `acquiredAt`.
  2. `releaseLeadCooldown` executes a conditional update (`where: { id: leadId, [field]: acquiredAt }`).
  3. If a newer concurrent request updated the field, the release no-ops and count is 0, leaving the newer timestamp intact.
- **Verification Evidence:** `test/reliability-engineering.test.ts` and `test/verification-gaps.test.ts`.

---

## GAP-06: Analysis Lock Fencing

- **Severity:** **MEDIUM**
- **Status:** **FIXED AND VERIFIED**
- **Files:** `lib/reliability/cooldown.ts`, `app/api/leads/[id]/analyze/route.ts`
- **Remediation Details:**
  1. `acquireAnalysisLock` returns an ownership token (`lockToken = acquiredAt`).
  2. Persistence verifies `where: { id, aiAnalysisStatus: 'PENDING', updatedAt: lockToken }`.
  3. If an analysis execution finishes after the 60-second lock was reclaimed by a newer request, the stale write is safely discarded.
- **Verification Evidence:** `test/reliability-engineering.test.ts` and `test/verification-gaps.test.ts`.

---

## REMAINING LIMITATIONS (LOW SEVERITY)

### GAP-07: Shared Public Demo Account
- **Severity:** **LOW / USABILITY**
- **Status:** **KNOWN LIMITATION**
- **Context:** The public demo button signs in as `sales.agent@leadpilot.ai`. Evaluators testing concurrently share the same account workspace. This is standard for quick evaluation demos, but ephemeral per-visitor accounts would be preferred in an enterprise multi-tenant release.

### GAP-08: Unit Concurrency Mocks vs Neon Row Locks
- **Severity:** **LOW / TEST FIDELITY**
- **Status:** **KNOWN LIMITATION**
- **Context:** Rate-limiting concurrency is verified against real Neon PostgreSQL (`test/rate-limit.test.ts`). Cooldown CAS is verified via application mocks (`test/reliability-engineering.test.ts`, `test/verification-gaps.test.ts`).
