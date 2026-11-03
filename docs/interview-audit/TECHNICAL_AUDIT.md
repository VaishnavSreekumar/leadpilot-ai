# LEADPILOT AI — COMPREHENSIVE TECHNICAL AUDIT REPORT

**Date of Audit:** November 3, 2026  
**Repository:** `leadpilot-ai`  
**Current Working Branch:** `fix/unified-analysis-suggestions` (HEAD: `93039b5`)  
**Auditor Roles:** Senior Full-Stack Engineer, DevOps Engineer, Software Architect, Database Engineer, Technical Interviewer  
**Audit Scope:** Full codebase, dependencies, data pipeline, AI integrations, scoring algorithms, database schemas, serverless deployment, testing infrastructure, and security posture.

---

## 1. EXECUTIVE SUMMARY

**LeadPilot AI** is a specialized real-estate sales command center built with Next.js (App Router), React 19, TypeScript, PostgreSQL (hosted on Neon Serverless), Prisma ORM, and Google Gemini. Its dedicated purpose is solving one operational problem for real estate agents:

> *"Which lead should I act on next, why, and what should I say?"*

Unlike generic Customer Relationship Management (CRM) platforms, LeadPilot AI operates as an intelligent sales prioritization and decision-support pipeline. Unstructured inbound inquiries (customer name, budget in INR, target location, property specifications, timeline urgency, and raw inquiry notes) are ingested, validated via strict Zod schemas, stored in PostgreSQL, analyzed via Google Gemini (`gemini-3.5-flash-lite`), and scored using a deterministic, explainable 100-point canonical scoring algorithm written in pure TypeScript.

Crucially, **AI does not calculate or assign numerical scores**. Instead, the architecture establishes a strict separation of concerns: Gemini extracts qualitative semantic classifications (`aiIntentLevel`, `aiRequirementClarity`, `aiEngagementLevel`), and TypeScript deterministic logic computes the lead score and priority tier (`HOT`, `WARM`, `COLD`). Subsequent workflows include a grounded Sales Assistant chat interface and a deterministic + AI hybrid "Smart Follow-Up" cadence generator.

---

## 2. VERIFIED TECHNOLOGY STACK & INVENTORY

The table below reflects the exact packages, versions, and verified execution roles from `package.json`, `package-lock.json`, and source code inspection.

| Category | Technology / Dependency | Exact Version | Execution Location | Actual Production Responsibility |
| :--- | :--- | :--- | :--- | :--- |
| **Framework** | Next.js | `16.3.6` (Turbopack) | Server & Client | App Router, dynamic server rendering, API route handlers (`app/api/*`), React Server Components, client-side hydration. |
| **UI Library** | React / React DOM | `19.2.8` | Client & Server | Core component tree rendering, client state (`useState`, `useRef`, `useCallback`), server-side HTML streaming. |
| **Language** | TypeScript | `^5` (5.x) | Build-time | Strict type-safety, interface contracts (`types/index.ts`, `lib/scoring/lead-score.ts`), build validation (`npx tsc --noEmit`). |
| **Styling** | Tailwind CSS / PostCSS | `^4.0` (`@tailwindcss/postcss: ^4`) | Build-time | Utility styling, responsive layouts, theme styling with custom Warm Neutral / Masal palette (`#F1E4DC`, `#C84B45`). |
| **Database & ORM** | Prisma Client & CLI | `6.19.3` | Server-only & CLI | Object-Relational Mapping, schema migrations (`prisma/migrations`), PostgreSQL client singleton (`lib/db/prisma.ts`). |
| **Database Engine** | PostgreSQL (Neon) | PostgreSQL 16 (AWS `ap-southeast-1`) | Cloud Managed | Relational persistence, connection pooling via Neon PgBouncer (`DATABASE_URL`), direct DDL migrations (`DIRECT_URL`). |
| **AI SDK** | `@google/genai` | `^2.24.0` | Server-only | Official Google GenAI SDK interfacing with Gemini API via native JSON Schema structured output. |
| **AI Model** | Gemini 3.5 Flash Lite | `gemini-3.5-flash-lite` | Google Cloud API | Fast, low-latency qualitative feature extraction, grounded sales chat, follow-up reasoning. |
| **Schema Validation**| Zod | `^4.6.5` | Server & Client | Request payload parsing, form validation, and runtime validation of Gemini JSON outputs. |
| **Testing** | Vitest | `^5.0.2` | Test Harness (Node) | Unit testing, mock integration testing of AI schemas, prompt injection defense, and DB ranking verification. |
| **Node Types** | `@types/node` | `^22.20.4` | Build-time | Node runtime TypeScript definitions. |
| **Linter** | ESLint / config-next | `^9` / `16.3.6` | Development | Code quality and React hooks linting (`eslint app lib types components`). |
| **Environment Boundary** | `server-only` | `^0.0.1` | Server-only | Build-time poison pill ensuring server modules cannot be leaked or bundled into client components. |

---

## 3. APPLICATION REPOSITORY & DIRECTORY STRUCTURE

```text
leadpilot-ai/
├── app/
│   ├── api/
│   │   ├── health/
│   │   │   └── route.ts              # GET: DB connection ping (SELECT 1)
│   │   └── leads/
│   │       ├── route.ts              # GET: ranked lead queue; POST: create lead
│   │       └── [id]/
│   │           ├── route.ts          # GET: fetch single lead record
│   │           ├── analyze/
│   │           │   └── route.ts      # POST: trigger/reuse AI analysis + score
│   │           ├── chat/
│   │           │   └── route.ts      # POST: grounded sales assistant chat
│   │           └── follow-up/
│   │               └── route.ts      # POST: generate/regenerate smart follow-up
│   ├── leads/
│   │   ├── [id]/
│   │   │   ├── not-found.tsx         # 404 handler for missing lead record
│   │   │   └── page.tsx              # Dynamic lead detail workspace (RSC)
│   │   ├── new/
│   │   │   └── page.tsx              # Static intake form page
│   │   └── error.tsx                 # Error boundary for lead routes
│   ├── favicon.ico
│   ├── globals.css                   # Global styles & Tailwind 4 setup
│   ├── layout.tsx                    # Root layout with fonts & metadata
│   └── page.tsx                      # Dashboard root page (RSC: leads query)
├── components/
│   ├── LeadAnalysisSection.tsx       # Client: score card, AI summary, actions
│   ├── LeadAnalysisWorkspace.tsx     # Client: coordinator for detail page
│   ├── LeadForm.tsx                  # Client: intake form with live rupee preview
│   ├── LeadTable.tsx                 # Client: interactive filter tabs & table
│   ├── PhaseRoadmap.tsx              # Client: development roadmap tracker
│   ├── SalesAssistant.tsx            # Client: grounded chat interface
│   ├── SmartFollowUp.tsx             # Client: cadence timing & suggested draft
│   └── SystemStatus.tsx              # Client: status monitor
├── lib/
│   ├── ai/
│   │   ├── follow-up.ts              # Smart Follow-up prompt, timing & SDK
│   │   ├── lead-analysis.ts          # Lead analysis prompt, schema & SDK
│   │   └── sales-assistant.ts        # Grounded chat prompt, schema & SDK
│   ├── db/
│   │   ├── index.ts                  # Re-export of Prisma singleton
│   │   └── prisma.ts                 # PrismaClient singleton with globalThis cache
│   ├── scoring/
│   │   └── lead-score.ts             # Deterministic 100-point canonical scoring
│   └── validations/
│       └── lead.ts                   # Zod intake schema & currency helpers
├── prisma/
│   ├── migrations/                   # 5 migration directories with migration.sql
│   │   ├── 20260928180747_add_lead_model/
│   │   ├── 20260928195852_add_lead_ai_analysis/
│   │   ├── 20260929061949_phase5_chat_cooldown/
│   │   ├── 20260929075454_phase6_smart_follow_up/
│   │   └── 20260929163339_add_ai_suggested_questions/
│   └── schema.prisma                 # Authoritative single-model database schema
├── test/                             # 12 Vitest test suites (146 tests)
├── types/
│   └── index.ts                      # Shared TypeScript data models
├── .env.example                      # Sample configuration
├── AGENTS.md                         # Authoritative agent engineering contract
├── next.config.ts                    # Next.js configuration
├── package.json                      # Scripts & dependencies
├── tsconfig.json                     # TypeScript compiler configuration
└── vitest.config.mts                 # Vitest test runner configuration
```

---

## 4. END-TO-END LEAD LIFECYCLE & DATA FLOW

Every lead follows an explicit, verifiable lifecycle through seven stages:

```
[Customer Message] 
       │
       ▼
 1. INTAKE & VALIDATION ──────► Zod Schema `leadInputSchema`
       │
       ▼
 2. PERSISTENCE ──────────────► PostgreSQL `Lead` table (aiAnalysisStatus="PENDING")
       │
       ▼
 3. AI EXTRACTION ────────────► Gemini 3.5 Flash Lite (Low temp 0.2, Native Schema)
       │
       ▼
 4. VALIDATION & MAPPING ─────► Zod Schema `leadAnalysisSchema`
       │
       ▼
 5. DETERMINISTIC SCORING ────► Pure TypeScript `calculateLeadScore()` (100 pts)
       │
       ▼
 6. UPDATE PERSISTENCE ───────► Persist score, priority, extracted fields in DB
       │
       ▼
 7. SALES ACTIONS ────────────► Grounded Chat & Deterministic Smart Follow-Up
```

### Step 1: Intake & Client/Server Validation
1. An agent navigates to `/leads/new` and fills out `LeadForm.tsx`.
2. Input is validated on the client against `leadInputSchema` (`lib/validations/lead.ts`). The budget is rendered live with an Indian currency formatter (`formatBudgetDisplay()`, converting e.g. `12000000` to `₹1,20,00,000 · 1.2 Cr`).
3. Payload is dispatched via `POST /api/leads`. The server re-validates the payload authoritatively against the same Zod schema.
4. If valid, Prisma creates a record in PostgreSQL with default `aiAnalysisStatus = "PENDING"`, returning HTTP 201 with the created lead ID. The client redirects to `/leads/[id]`.

### Step 2: Dashboard Queue & Server Component Hydration
1. On `/` (`app/page.tsx`), a React Server Component directly queries Prisma:
   ```typescript
   const leads = await prisma.lead.findMany({
     orderBy: [
       { leadScore: { sort: 'desc', nulls: 'last' } },
       { createdAt: 'desc' },
     ],
   });
   ```
2. The server-rendered data is passed to `LeadTable.tsx` (Client Component), which offers tabbed presentation filters (`ALL`, `HOT`, `WARM`, `COLD`, `PENDING`) without re-querying the database or disrupting the canonical sort order.

### Step 3: AI Semantic Extraction
1. On the detail page `/leads/[id]`, the agent clicks "Analyze Lead" (or "Retry Analysis"), invoking `POST /api/leads/[id]/analyze`.
2. **Cost Guard & Cache Policy:** If `aiAnalysisStatus === "COMPLETED"` and `force !== true`, the route bypasses Gemini completely and returns the cached lead with dynamically derived score breakdowns.
3. **10-Second Cooldown:** If `lead.aiAnalyzedAt` is within 10 seconds, HTTP 429 is returned.
4. If eligible, status is updated to `"PENDING"`. The server extracts trusted context (`name`, `location`, `propertyRequirement`, `budgetInr`, `buyingTimeline`) and encapsulates `customerMessage` within `<customer_message>` XML tags.
5. `analyzeLeadWithGemini()` in `lib/ai/lead-analysis.ts` invokes Google Gemini using model `gemini-3.5-flash-lite` at `temperature: 0.2` with native JSON Schema output.
6. The raw JSON string is parsed and validated against `leadAnalysisSchema`. If Gemini fails or produces invalid JSON, a bounded retry mechanism executes **exactly once** after a 500ms delay (max 2 total attempts).

### Step 4: Deterministic 100-Point Scoring
1. Upon successful Zod validation, `calculateLeadScore()` in `lib/scoring/lead-score.ts` receives the extracted qualitative levels along with the stored intake parameters.
2. The score is calculated using pure mathematical rules (30 max for Intent, 25 max for Timeline, 15 max for Budget, 15 max for Requirement Clarity, 15 max for Engagement Level).
3. The resulting numeric score (`leadScore: 25..100`) and priority tier (`leadPriority: 'HOT' | 'WARM' | 'COLD'`) are returned.
4. **Derive, Don't Duplicate:** The breakdown points are NOT stored in separate columns. Only `leadScore` and `leadPriority` are written to PostgreSQL. Score breakdowns and "Why this lead?" explanations are deterministically recomputed on the fly when rendered.

### Step 5: Grounded Copilot & Cadence Generator
1. **Sales Assistant (`app/api/leads/[id]/chat/route.ts`):** 
   - Receives salesperson message and prior conversation turns (capped at 6).
   - Validates input using `chatRequestSchema`.
   - Fetches the authoritative lead context from PostgreSQL using the route `[id]`.
   - Enforces a 5-second DB-persisted cooldown (`lastChatRequestAt`).
   - Generates grounded answers strictly referencing lead context and refusing to fabricate properties or inventory.
2. **Smart Follow-Up (`app/api/leads/[id]/follow-up/route.ts`):**
   - Timing is calculated deterministically via `getFollowUpDays(buyingTimeline, leadPriority)` (e.g. 0-3 months = 2 days; halved to 1 day if `HOT`).
   - Gemini produces qualitative fields: `reason`, `focusPoints`, `suggestedMessage`.
   - Results are persisted to the `Lead` model (`followUpRecommendedAt`, `followUpReason`, etc.) and cached.
   - Enforces a 30-second DB-persisted regeneration cooldown (`followUpGeneratedAt`).

---

## 5. AI INTEGRATION & SCORING DEEP DIVE

### 5.1 Gemini Model & Execution Parameters

- **Exact Model Identifier:** `gemini-3.5-flash-lite`  
  *(Note: Updated from `gemini-2.5-flash` in commit `1785784`. Historical documentation in `README.md` still contains legacy references to 2.5 Flash).*
- **SDK:** `@google/genai` (v2.24.0) initialized server-side via `new GoogleGenAI({ apiKey })`.
- **Environment Isolation:** Guarded by `import 'server-only'`. Secrets are strictly accessed through `process.env.GEMINI_API_KEY`.
- **Inference Temperatures:**
  - Lead Analysis (`lib/ai/lead-analysis.ts`): `0.2` (minimizes variance, enforces strict factual extraction).
  - Smart Follow-Up (`lib/ai/follow-up.ts`): `0.3` (grounded reasoning with coherent message drafting).
  - Sales Assistant Chat (`lib/ai/sales-assistant.ts`): `0.4` (natural conversational tone while adhering to negative constraints).

### 5.2 Structured Output Schema & Zod Enforcement

The pipeline utilizes **Dual-Layer Validation**:
1. **Gemini Native Schema Mode:** Configured via `config: { responseMimeType: 'application/json', responseSchema: geminiResponseSchema }`.
2. **Authoritative Application Zod Schema:** Post-call validation via `leadAnalysisSchema.safeParse(parsedJson)`.

```typescript
// lib/ai/lead-analysis.ts
export const leadAnalysisSchema = z.object({
  summary: z.string().trim().min(1, 'Summary is required'),
  intent: z.string().trim().min(1, 'Intent is required'),
  keyRequirements: z.array(z.string().trim()).default([]),
  objections: z.array(z.string().trim()).default([]),
  recommendedNextAction: z.string().trim().min(1, 'Recommended next action is required'),
  suggestedResponse: z.string().trim().min(1, 'Suggested response is required'),
  suggestedQuestions: z.array(z.string().trim()).default([]),
  intentLevel: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  engagementLevel: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  requirementClarity: z.enum(['CLEAR', 'PARTIAL', 'UNCLEAR']),
});
```

### 5.3 Deterministic Canonical Scoring Formula

The canonical score is defined in `lib/scoring/lead-score.ts`:

$$\text{LeadScore} = \text{Intent} + \text{Timeline} + \text{Budget} + \text{Clarity} + \text{Engagement}$$

| Scoring Dimension | Extracted / Stored Signal | Points Awarded | Max Points |
| :--- | :--- | :--- | :--- |
| **1. Intent Level** | `HIGH`<br>`MEDIUM`<br>`LOW` / other / null | **30**<br>**20**<br>**10** | **30** |
| **2. Buying Timeline** | `0-3 months`<br>`3-6 months`<br>`6-12 months`<br>`exploring` / other | **25**<br>**15**<br>**10**<br>**5** | **25** |
| **3. Stated Budget** | Number is finite, valid, and $> 0$<br>Missing, $\le 0$, or invalid | **15**<br>**0** | **15** |
| **4. Requirement Clarity**| `CLEAR`<br>`PARTIAL`<br>`UNCLEAR` / other / null | **15**<br>**10**<br>**5** | **15** |
| **5. Engagement Level** | `HIGH`<br>`MEDIUM`<br>`LOW` / other / null | **15**<br>**10**<br>**5** | **15** |
| **TOTAL** | Minimum Score: **25** | Maximum Score: **100** | **100** |

#### Priority Tiers:
- **`HOT`**: Score $\ge 75$ (e.g. High intent + urgent timeline + valid budget)
- **`WARM`**: Score $50 - 74$
- **`COLD`**: Score $25 - 49$

#### Architectural Rationale for Separating AI from Scoring:
1. **Zero Hallucination of Numbers:** Large language models struggle with reliable numerical calibration and consistent mathematical arithmetic across invocations.
2. **Auditability & Compliance:** Real-estate teams must be able to explain *exactly* why a lead was marked HOT or COLD to avoid bias and maintain sales trust.
3. **Determinism:** Two identical customer profiles analyzed across different days will generate the identical lead score.
4. **Schema Resilience:** If business priorities shift (e.g., placing higher weight on immediate cash buyers), developers update the scoring weights in TypeScript without needing to re-prompt or fine-tune the model.

---

## 6. DATABASE & PRISMA ENGINEERING AUDIT

### 6.1 Database Schema & Entity Relationships

The PostgreSQL database (hosted on Neon Serverless) consists of a **single model**: `Lead`.

```prisma
// prisma/schema.prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model Lead {
  id                      String    @id @default(cuid())
  name                    String
  location                String
  propertyRequirement     String
  budgetInr               Int
  buyingTimeline          String
  customerMessage         String

  // AI Analysis fields
  aiSummary               String?
  aiIntent                String?
  aiKeyRequirements       String[]  @default([])
  aiObjections            String[]  @default([])
  aiRecommendedNextAction String?
  aiSuggestedResponse     String?
  aiIntentLevel           String?
  aiEngagementLevel       String?
  aiRequirementClarity    String?
  aiSuggestedQuestions    String[]  @default([])
  aiAnalyzedAt            DateTime?
  aiAnalysisStatus        String?   @default("PENDING")

  // Deterministic scoring fields
  leadScore               Int?
  leadPriority            String?

  // Serverless-safe cooldown timestamps
  lastChatRequestAt       DateTime?

  // Smart Follow-Up
  followUpRecommendedAt   DateTime?
  followUpReason          String?
  followUpFocusPoints     String[]  @default([])
  followUpMessage         String?
  followUpGeneratedAt     DateTime?

  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt
}
```

### 6.2 Migration History Analysis

Five additive migrations are recorded in `prisma/migrations/`:
1. `20260928180747_add_lead_model`: Created core `Lead` table.
2. `20260928195852_add_lead_ai_analysis`: Added AI qualitative columns and canonical scoring fields (`leadScore`, `leadPriority`).
3. `20260929061949_phase5_chat_cooldown`: Added `lastChatRequestAt` for persistent cooldowns.
4. `20260929075454_phase6_smart_follow_up`: Added smart follow-up recommendation fields.
5. `20260929163339_add_ai_suggested_questions`: Added `aiSuggestedQuestions` string array.

All migrations are forward-only and additive. Existing records are preserved across schema versions.

### 6.3 Connection Lifecycle & Neon Serverless Integration

- **Dual Connection Strings:**
  - `DATABASE_URL`: Configured to Neon's pooled connection proxy (PgBouncer) via port `6543` or pooler domain (`-pooler`), designed for high-concurrency serverless lambdas.
  - `DIRECT_URL`: Configured to Neon's unpooled direct endpoint (port `5432`), required for DDL schema migrations (`prisma migrate deploy`) that execute session-level locking and transaction commands unsupported by connection poolers.
- **Client Singleton (`lib/db/prisma.ts`):** Implements the standard `globalThis` pattern to prevent connection exhaustion during local development hot module reloading. In production, each serverless container instantiates a single Prisma Client.

---

## 7. VERCEL DEPLOYMENT & DEVOPS AUDIT

### 7.1 Build Pipeline & Execution Lifecycle

In `package.json`, the production build command is configured as:
```json
"scripts": {
  "build": "prisma generate && prisma migrate deploy && next build"
}
```

#### DevOps Risk Analysis of `prisma migrate deploy` in Build Command:
While convenient for automated migrations on Vercel preview branches, placing `prisma migrate deploy` directly in the Vercel build script introduces critical production risks:
1. **Build-Time Database Dependency:** Next.js static asset compilation (`next build`) becomes tightly coupled to live database reachability. If Neon has a network hiccup during deployment, the build fails before code is packaged.
2. **Migration on Preview Branches:** Every pull request preview deployment executes `prisma migrate deploy`. Unless Neon branch branching is configured per Vercel environment, preview deployments could inadvertently apply destructive or unvetted migrations against the shared development database.
3. **Database URL Access at Build Time:** Vercel build workers require access to `DIRECT_URL` during the build phase.

### 7.2 Route Classification (Turbopack Output)

Inspection of the build output (`npm run build`) verifies the routing topology:

```text
Route (app)                              Size     First Load JS
┌ ƒ /                                    182 B           108 kB
├ ○ /_not-found                          994 B           101 kB
├ ƒ /api/health                          156 B           100 kB
├ ƒ /api/leads                           156 B           100 kB
├ ƒ /api/leads/[id]                      156 B           100 kB
├ ƒ /api/leads/[id]/analyze              156 B           100 kB
├ ƒ /api/leads/[id]/chat                 156 B           100 kB
├ ƒ /api/leads/[id]/follow-up            156 B           100 kB
├ ƒ /leads/[id]                          182 B           108 kB
└ ○ /leads/new                           156 B           100 kB

○ (Static)   prerendered as static content
ƒ (Dynamic)  server-rendered on demand
```

- **Dynamic Routes (`ƒ`):** Root dashboard `/` and detail page `/leads/[id]` are dynamically rendered on every request to guarantee up-to-date lead scores, priority rankings, and cooldown timestamps.
- **Static Routes (`○`):** `/leads/new` is prerendered as pure static HTML/JS since the intake form does not require initial server-side data fetching.

---

## 8. SECURITY, RELIABILITY & PERFORMANCE AUDIT

### 8.1 Security Evaluation

- **API Key Storage:** `GEMINI_API_KEY` is completely isolated to server-side route handlers and `lib/ai/` helper modules. All AI modules declare `import 'server-only'`. Zero `NEXT_PUBLIC_` prefixes are attached to secrets.
- **Prompt Injection Defense:** 
  - Untrusted customer inputs (`lead.customerMessage`) and prior chat history are enclosed within explicit XML delimiters (`<customer_message>`, `<prior_conversation>`).
  - System instructions instruct the model to treat content within delimiters strictly as data to analyze rather than executable instructions.
  - Verified via automated test suite `test/prompt-injection.test.ts`.
- **SQL Injection Safety:** Prisma ORM automatically parameterizes all queries across `findMany`, `findUnique`, `create`, and `update`. The sole raw query (`SELECT 1` in `app/api/health/route.ts`) is a static string template literal.
- **Missing Controls (Gaps):**
  - **No Authentication / Authorization:** All endpoints (`/api/leads`, `/api/leads/[id]/*`) are completely public. Anyone with the URL can inspect leads, analyze leads, or send chat messages.
  - **No IP-Based Rate Limiting:** Cooldowns are per-lead in PostgreSQL, not per-client IP. A malicious actor could script requests across thousands of lead IDs simultaneously.

### 8.2 Reliability Controls

- **Serverless-Safe Cooldowns:** Rather than volatile in-memory Maps, cooldown timestamps are written directly to PostgreSQL:
  - Analysis cooldown: 10 seconds (`aiAnalyzedAt`).
  - Chat cooldown: 5 seconds (`lastChatRequestAt`).
  - Follow-up regeneration cooldown: 30 seconds (`followUpGeneratedAt`).
- **Snapshot Preservation on Failure:**
  - If a lead was previously `COMPLETED`, a subsequent failed re-analysis preserves the existing analysis and score rather than erasing it.
  - If Smart Follow-Up regeneration fails, the API returns the previous valid recommendation with a non-blocking warning notice.
- **Bounded Retries:** AI SDK invocations execute a bounded retry loop (exactly 2 attempts with a 500ms backoff) to handle transient Google API rate limits or network blips without creating infinite loops.

### 8.3 Performance & Indexing

- **Query Efficiency:** The main dashboard query sorts by:
  ```sql
  ORDER BY "leadScore" DESC NULLS LAST, "createdAt" DESC
  ```
  **Database Performance Risk:** The `Lead` table currently possesses **zero composite indexes** on `(leadScore DESC, createdAt DESC)`. At low volume (< 1,000 leads), this performs a fast sequential scan. At high volume (> 50,000 leads), this query will require an expensive in-memory sort on every dashboard page load.

---

## 9. TESTING & VERIFICATION SUMMARY

### 9.1 Vitest Automated Test Results

Command executed: `npx vitest run`  
**Vitest Version:** `5.0.2`  
**Test Suites:** 12 total files (11 passed, 1 failed)  
**Total Tests:** 146 tests (145 passed, 1 failed, 0 skipped)  
**Execution Duration:** ~3.78 seconds  
**Exit Code:** `1`

#### Test Suite Breakdown Table:

| Test File | Tests | Passed | Failed | Status | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `test/scoring.test.ts` | 21 | 21 | 0 | **PASS** | Tests deterministic 100-pt formula, score weights, boundary conditions (75, 74, 50, 49, 25). |
| `test/priority-ranking.test.ts` | 12 | 12 | 0 | **PASS** | Tests `nulls: 'last'` ordering, tie-breaking by `createdAt`, and priority filtering. |
| `test/sales-assistant.test.ts` | 33 | 33 | 0 | **PASS** | Tests sales assistant prompt construction, role boundaries, and cooldown logic. |
| `test/follow-up.test.ts` | 30 | 30 | 0 | **PASS** | Tests follow-up day calculation table, HOT priority halving, and prompt construction. |
| `test/bounded-retry.test.ts` | 10 | 10 | 0 | **PASS** | Tests bounded retry (max 2 attempts), backoff, empty responses, and non-JSON error handling. |
| `test/follow-up-gemini.test.ts` | 12 | 12 | 0 | **PASS** | Mocks Gemini SDK to verify retry on schema failure, snapshot preservation, and error safety. |
| `test/sales-assistant-gemini.test.ts`| 8 | 8 | 0 | **PASS** | Mocks Gemini SDK to verify chat failure handling, non-mutation of lead fields, and secret protection.|
| `test/analyze-api.test.ts` | 6 | 6 | 0 | **PASS** | Tests `/api/leads/[id]/analyze` route handler, caching, cooldowns, and error propagation. |
| `test/ai-schema.test.ts` | 6 | 6 | 0 | **PASS** | Validates Zod schema boundaries for `leadAnalysisSchema` and enum validation. |
| `test/db-ranking.test.ts` | 3 | 3 | 0 | **PASS** | Live dev DB integration test verifying PostgreSQL sorting and "Why this lead?" derivations. |
| `test/prompt-injection.test.ts` | 1 | 1 | 0 | **PASS** | Verifies prompt injection payload containment within XML tags. |
| `test/grounding.test.ts` | 4 | 3 | **1** | **FAIL** | Tests strict grounding prompt rules. **One assertion failure** (see details below). |

### 9.2 Exact Root Cause of Test Failure in `test/grounding.test.ts`

- **Failing Test:** `Strict Lead-Context Grounding Rules > buildAnalysisPrompt includes strict grounding rules prohibiting geographic expansion and fake listings`
- **Location:** `test/grounding.test.ts:40:20`
- **Assertion:**
  ```typescript
  expect(prompt).toContain('Every suggestion MUST be traceable ONLY to the authoritative lead record and customer message');
  ```
- **Root Cause Analysis:** In commit `1785784` (`feat(ai): unify lead analysis with strict grounded suggestions`), the developer updated the prompt rules in `lib/ai/lead-analysis.ts` to:
  ```text
  Suggested questions must contain ONLY information explicitly stated in the selected lead or directly derived from information explicitly stated in that lead's AI analysis.
  ```
  However, the test assertion was written expecting the phrasing:
  ```text
  Every suggestion MUST be traceable ONLY to the authoritative lead record and customer message
  ```
  This constitutes a **documentation/assertion drift** where the prompt implementation was updated without updating the test expectation. Per strict audit guidelines, the application code was left unmodified.

### 9.3 Build & Lint Verification

- **TypeScript Compilation:** `npx tsc --noEmit`  
  **Result:** Exited with code `0`. Zero type errors across entire codebase.
- **ESLint:** `npm run lint` (`eslint app lib types components`)  
  **Result:** Exited with code `0`. Zero lint errors.
- **Production Build:** `npm run build` (`prisma generate && prisma migrate deploy && next build`)  
  **Result:** Exited with code `0`. All 10 routes successfully generated with Turbopack.

---

## 10. AUDIT SUMMARY TABLE

| Dimension | Audit Status | Key Evidence |
| :--- | :--- | :--- |
| **Framework & Engine** | Modern / Stable | Next.js 16.3.6 App Router, React 19.2.8, TypeScript 5. |
| **Database & ORM** | Functional / Additive | Neon PostgreSQL with 5 clean Prisma migrations, Prisma 6.19.3. |
| **AI Integration** | High Rigor | `gemini-3.5-flash-lite`, low temperature (0.2), native JSON Schema + Zod dual validation. |
| **Lead Scoring** | Deterministic | Separated from AI; 100-pt formula executed purely in TypeScript. |
| **Rate Limiting** | Serverless-Safe | DB-persisted cooldowns (5s chat, 10s analysis, 30s follow-up). |
| **Security** | Strong AI isolation / No Auth | Robust prompt-injection defense; lacks user authentication and IP rate-limiting. |
| **Test Coverage** | Comprehensive | 146 tests across 12 suites; 145 passing, 1 known test assertion discrepancy. |
| **Build Health** | Verified Passing | `npm run build`, `npm run lint`, and `tsc --noEmit` all exit with code 0. |

