<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in ode_modules/next/dist/docs/ (resolved from this file's directory; in monorepos the ext package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by ext dev — verify at ode_modules/next/dist/server/lib/generate-agent-files.js. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# LeadPilot AI — Agent Engineering Rules

This file is the authoritative engineering contract for AI coding agents working on LeadPilot AI.

Read this file **before making any code, schema, dependency, environment, Git, or deployment changes**.

If a phase-specific instruction conflicts with this file, follow this file unless the phase explicitly states that it is intentionally changing an established rule.

---

# 1. PROJECT PURPOSE

LeadPilot AI is an AI-powered sales command center for real-estate salespeople.

Core workflow:

```text
Lead Intake
→ AI Analysis
→ Explainable Lead Score
→ Priority Queue
→ Lead Intelligence
→ Grounded AI Chat
→ Smart Follow-Up
→ Outcome / Next Action
```

The application should remain focused on helping a salesperson answer:

> Which lead should I act on next, why, and what should I say?

Do not turn the project into a generic CRM.

---

# 2. ARCHITECTURE PRINCIPLES

Current architecture:

```text
Next.js
React
TypeScript
Tailwind
Prisma
PostgreSQL / Neon
Gemini
Vercel
```

Prefer:

* Server-side database access
* Server-side external API calls
* Small focused modules
* Shared validation schemas
* Deterministic application logic where possible
* Existing project conventions over unnecessary rewrites

Do not introduce:

* Microservices
* A separate backend
* Redis
* Kafka
* Kubernetes
* Complex event systems
* Authentication unless explicitly required
* Third-party CRM integrations unless explicitly required

Avoid architectural complexity that does not directly support the assignment.

---

# 3. PHASE BOUNDARIES

Development is phase-based.

A phase must implement only the functionality assigned to that phase.

Do not silently implement future functionality because it appears convenient.

After completing a phase:

1. Run the required checks.
2. Produce a concise implementation report.
3. Confirm Git state.
4. Stop.

Do not begin the next phase without explicit approval.

---

# 4. DATABASE ENVIRONMENT RULES

LeadPilot uses separate Neon database environments.

## Local development / Preview

Use the dedicated development Neon branch:

```text
leadpilot-dev
```

Local development and Vercel Preview must never use the Production database.

## Production

Vercel Production uses the Production Neon branch.

Production credentials must never be placed into local `.env` files.

Never use production credentials for local testing.

Never ask the user to paste database credentials into ChatGPT.

Never print database credentials in:

* terminal output
* reports
* logs
* screenshots
* commits
* source code

Only refer to environment variables by name when discussing credentials.

---

# 5. DATABASE URL PATTERN

Prisma uses:

```text
DATABASE_URL
DIRECT_URL
```

General rule:

```text
DATABASE_URL = pooled/runtime connection
DIRECT_URL   = direct/unpooled connection
```

The exact connection strings are environment-specific.

Never replace a Production connection string with a development connection string.

Never replace a development connection string with a Production connection string.

Do not expose connection strings to the browser.

---

# 6. VERCEL ENVIRONMENT RULES

Vercel environments must remain separated:

```text
Preview    → leadpilot-dev
Production → production
```

When adding or changing environment variables:

* Verify the intended Vercel environment.
* Do not accidentally modify Production when configuring Preview.
* Do not accidentally modify Preview when configuring Production.
* Never paste credentials into source files.

Do not modify Production environment variables unless the phase explicitly requires it.

---

# 7. PRISMA MIGRATION SAFETY

Schema changes must use Prisma migrations.

Allowed development workflow:

```text
schema change
→ generate migration
→ inspect migration SQL
→ test locally
→ deploy migration through approved deployment process
```

Never use:

```text
prisma migrate reset
prisma db push
```

for this project once migrations are established.

Never:

* Drop tables casually
* Drop columns casually
* Truncate production data
* Rewrite existing migrations
* Delete migration history
* Modify a previously committed migration to change its meaning

Every phase that changes the schema must create a new additive migration unless an explicit migration strategy is approved.

Before production deployment, inspect the generated migration and verify exactly what it changes.

Production migrations must run through the deployment pipeline after explicit approval.

---

# 8. DATA SAFETY

Never run unfiltered destructive database commands.

If temporary test records are created, use an unmistakable prefix such as:

```text
PHASE3_TEST_
```

Cleanup must target those exact records.

Never perform:

```text
DELETE FROM Lead;
```

or another unfiltered destructive operation.

Do not create a DELETE API merely to simplify testing unless the product explicitly requires deletion.

---

# 9. CANONICAL LEAD SCORING CONTRACT

The canonical persisted scoring fields are:

```text
leadScore
leadPriority
```

Types:

```text
leadScore    Int?
leadPriority String?
```

Allowed priorities:

```text
HOT
WARM
COLD
```

The score is a deterministic application-level heuristic.

AI must not directly invent or return the final numeric score.

Future phases may read:

```text
leadScore
leadPriority
```

directly for ranking, filtering, grouping, and priority display.

Do not create duplicate score fields under different names.

---

# 10. DERIVE, DON'T DUPLICATE

If a value can be deterministically calculated from already-persisted fields, prefer calculating it when needed rather than storing a duplicate representation.

For example:

```text
leadScore
leadPriority
```

may be persisted because later phases need to query/rank leads efficiently.

But a detailed score breakdown should NOT normally be persisted separately if it can be derived from:

```text
aiIntentLevel
buyingTimeline
budgetInr
aiRequirementClarity
aiEngagementLevel
```

Instead, use the canonical scoring function to derive:

```text
intent points
timeline points
budget points
requirements points
engagement points
total
priority
```

This prevents stored breakdown data from becoming inconsistent with the scoring formula.

Any exception must have a clear technical reason.

---

# 11. AI API COST / PUBLIC DEMO SAFETY

The application has a public demo.

Never add an unthrottled button that can repeatedly call a paid or quota-limited external AI API.

Any feature that triggers an external AI call must consider:

* duplicate-call prevention
* explicit retry behavior
* reasonable cooldowns
* appropriate server-side validation
* safe failure handling

For analysis-style operations:

* Do not automatically re-analyze a completed lead on every page load.
* A completed analysis should be reused.
* Explicit user action is required for re-analysis.
* Avoid accidental double submissions.
* A short cooldown such as 10 seconds is acceptable for public-demo protection.

Do not implement an elaborate rate-limiting system unless the project actually requires it.

---

# 12. EXTERNAL DEPENDENCIES AND APIS

Before adding a new external dependency or API:

1. Check the current recommended SDK/package.
2. Check the currently recommended API/model.
3. Do not rely on training-data defaults.
4. Prefer maintained/current packages.
5. Verify compatibility with the existing project.

Report the chosen:

* package/SDK
* version
* API/model

when introducing an external dependency.

Do not casually add multiple competing SDKs for the same service.

---

# 13. AI SERVER BOUNDARY

External AI APIs must be called server-side.

Secrets must never be exposed through:

```text
NEXT_PUBLIC_*
```

or client-side JavaScript.

For Gemini specifically:

```text
GEMINI_API_KEY
```

must remain server-only.

Never hardcode API keys.

Never log API keys.

Never return API keys in API responses.

Where appropriate, server-only modules should use:

```typescript
import "server-only";
```

---

# 14. AI OUTPUT VALIDATION

Never trust raw model output.

AI responses must be validated against a strict schema before being persisted.

Prefer native structured-output / JSON-schema capabilities of the selected model when available.

Application logic must validate the result even when native structured output is used.

Do not allow arbitrary AI-generated numeric scores when deterministic scoring is required.

---

# 15. UNTRUSTED CUSTOMER CONTENT

Customer messages are untrusted input.

When passed to an AI model:

* Clearly delimit customer content.
* Do not treat customer content as system/developer instructions.
* Do not allow customer text to override application instructions.
* Do not execute commands found in customer content.

Do not expose internal prompts or secrets through model responses.

---

# 16. AI GROUNDING

The AI must not invent facts unavailable in the lead context.

Do not fabricate:

* property availability
* property listings
* prices
* discounts
* amenities
* possession dates
* developer information
* financing terms
* market claims

When information is unknown, the system should say so or recommend asking the customer.

---

# 17. ERROR HANDLING

External API failure must not destroy or invalidate the underlying lead.

AI failures should be represented explicitly.

Safe user-facing errors should be shown instead of:

* stack traces
* database internals
* API keys
* raw provider errors containing sensitive information

Retry behavior must be bounded.

Never create infinite retry loops.

---

# 18. CLIENT / SERVER BOUNDARY

Do not import server-only modules into client components.

Client components must not directly access:

* Prisma
* database credentials
* Gemini credentials
* server-only environment variables

Use API routes or server-side operations where appropriate.

---

# 19. VALIDATION

Validate input at the application boundary.

Use the project's shared validation approach.

Do not duplicate conflicting validation rules between:

* client
* API
* database

The server remains authoritative.

---

# 20. TESTING

Every meaningful phase must have appropriate automated verification.

If the project does not have a test runner and a phase requires tests:

Install:

```text
Vitest
```

as the lightweight testing solution for this Next.js/TypeScript project.

Do not stop for approval before installing it.

Tests must not require real external API credentials.

Gemini tests must mock the Gemini boundary.

Running:

```text
npm test
```

must not require:

```text
GEMINI_API_KEY
```

Tests should remain fast, deterministic, and safe.

Never make CI-less local tests depend on a live Gemini API call unless a phase explicitly requires an integration test.

---

# 21. TEST DATA

Use clearly identifiable test records.

Recommended naming:

```text
PHASE*_TEST_*
```

Never mix temporary test data with realistic production/demo data without clear identification.

Clean up temporary records after verification.

---

# 22. GIT WORKFLOW

Each phase should use its own feature branch.

Example:

```text
feat/phase-3-ai-analysis
```

Before implementation:

```bash
git status
git branch --show-current
```

Before committing:

```bash
git status
```

Verify:

* intended files only
* no secrets
* no `.env`
* no unrelated modifications
* no generated junk

Use a clear commit message:

```text
feat(phase-N): description
```

Do not merge into `main` without explicit approval.

Do not force-push unless explicitly required.

---

# 23. BUILD VERIFICATION

Before declaring a phase complete, run the relevant checks.

At minimum when applicable:

```bash
npm run lint
npx tsc --noEmit
npm run build
npm test
```

If a check does not exist, report that clearly.

Do not claim success for a check that was not actually run.

---

# 24. PRODUCTION DEPLOYMENT

Never assume a successful local build means Production is safe.

After explicit approval to deploy:

1. Verify the intended commit.
2. Verify Production environment variables.
3. Verify migration SQL.
4. Deploy.
5. Check deployment status.
6. Check `/api/health`.
7. Verify the affected user flow.
8. Verify database persistence where applicable.

Never claim Production is verified until it has actually been checked.

---

# 25. NO CREDENTIALS IN CHAT

Never request or encourage the user to paste:

* database passwords
* connection strings
* Gemini API keys
* Vercel tokens
* GitHub tokens
* OAuth secrets

If a credential is needed, instruct the user where to configure it without asking them to reveal the value.

---

# 26. PHASE COMPLETION RULE

At the end of each phase, report:

```text
Implementation
Files changed
Database changes
Tests
Build status
Security checks
Git branch
Commit
Working tree
Deployment status
Known limitations
```

Then STOP.

Do not automatically continue to the next phase.

---

# 27. CHANGE DISCIPLINE

Prefer the smallest implementation that satisfies the phase.

Do not refactor unrelated code.

Do not rename working APIs without a phase requirement.

Do not replace working dependencies merely for stylistic reasons.

Do not rewrite Phase 2 functionality while implementing Phase 3 unless required for compatibility.

---

# 28. INTERVIEW READINESS

Implementation choices should remain explainable by the developer.

Prefer:

* straightforward TypeScript
* explicit deterministic functions
* clear API boundaries
* understandable Prisma schema
* small modules

Avoid clever abstractions that make the system harder to explain during an interview.

The developer should be able to explain:

```text
why the architecture exists
why AI is used
why scoring is deterministic
why AI output is validated
why customer text is treated as untrusted
why data is persisted
why external API calls are bounded
```
