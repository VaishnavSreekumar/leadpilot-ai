# LEADPILOT AI — INTERVIEW REVISION CHEATSHEET

Quick-reference revision guide for technical and DevOps engineering interviews. Grounded in actual repository code and verified execution facts.

---

## 1. 60–90 SECOND PROJECT ELEVATOR PITCH

> "LeadPilot AI is an AI-powered sales command center built specifically for real-estate salespeople to solve one critical problem: *'Which lead should I act on next, why, and what should I say?'*
> 
> Unlike a generic CRM, LeadPilot AI converts unstructured inbound customer inquiries into an explainable, prioritized sales queue. We use Next.js 16 with the App Router, React 19, TypeScript, PostgreSQL hosted on Neon, Prisma ORM, and Google Gemini 3.5 Flash Lite.
> 
> The core architectural highlight is our **strict separation of AI extraction from deterministic scoring**. Gemini comprehends the customer message and extracts qualitative signals like buyer intent, requirement clarity, and engagement level using native JSON Schema structured outputs. But the actual 100-point lead score is computed deterministically in pure TypeScript using a canonical mathematical formula. This guarantees 100% reproducible rankings, eliminates LLM numerical hallucination, and lets agents explain exactly why a lead is HOT, WARM, or COLD.
> 
> We also built a grounded Sales Assistant chat interface that uses XML security boundaries to resist prompt injection, and a Smart Follow-Up system that pairs deterministic cadence timing with AI-drafted outreach."

---

## 2. TECHNOLOGY INVENTORY CHEATSHEET

| Layer | Exact Technology | Role in Production |
| :--- | :--- | :--- |
| **Framework** | Next.js `16.3.6` (App Router, Turbopack) | Dynamic Server Components, Route Handlers, static intake |
| **UI Library** | React `19.2.8` | Component rendering, client-side hydration, hooks |
| **Language** | TypeScript `5.x` | Strict types, Zod inference, build-time compilation |
| **Database** | PostgreSQL on Neon Serverless | Relational persistence, connection pooling (`ap-southeast-1`) |
| **ORM** | Prisma Client & CLI `6.19.3` | Schema definition, migrations, typed queries, singleton |
| **AI SDK** | `@google/genai` `^2.24.0` | Official Google GenAI SDK interfacing with Gemini |
| **AI Model** | `gemini-3.5-flash-lite` | Qualitative attribute extraction, chat, follow-up |
| **Validation** | Zod `^4.6.5` | Shared intake validation, runtime AI output validation |
| **Testing** | Vitest `^5.0.2` | 146 unit & integration tests across 12 suites |
| **Styling** | Tailwind CSS `^4.0` | Utility CSS, Masal / Warm Neutral theme |
| **Hosting** | Vercel Serverless | Serverless edge & lambda hosting |

---

## 3. CANONICAL 100-POINT SCORING BREAKDOWN

$$\text{Total Score} = \text{Intent (30)} + \text{Timeline (25)} + \text{Budget (15)} + \text{Clarity (15)} + \text{Engagement (15)}$$

| Dimension | Values & Points | Max |
| :--- | :--- | :--- |
| **1. Intent Level** | `HIGH` (+30) &bull; `MEDIUM` (+20) &bull; `LOW` / default (+10) | **30 pts** |
| **2. Buying Timeline** | `0-3 months` (+25) &bull; `3-6 months` (+15) &bull; `6-12 months` (+10) &bull; `exploring` (+5) | **25 pts** |
| **3. Stated Budget** | Valid finite number $> 0$ (+15) &bull; Missing or $\le 0$ (+0) | **15 pts** |
| **4. Requirement Clarity**| `CLEAR` (+15) &bull; `PARTIAL` (+10) &bull; `UNCLEAR` / default (+5) | **15 pts** |
| **5. Engagement Level** | `HIGH` (+15) &bull; `MEDIUM` (+10) &bull; `LOW` / default (+5) | **15 pts** |
| **TOTALS** | Minimum Score = **25** &bull; Maximum Score = **100** | **100 pts** |

**Priority Classification Tiers:**
- **`HOT`**: Score $\ge 75$ (Immediate outreach required)
- **`WARM`**: Score $50 - 74$ (Active nurturing)
- **`COLD`**: Score $25 - 49$ (Low priority / exploratory)

**Queue Sorting SQL:**
```sql
ORDER BY "leadScore" DESC NULLS LAST, "createdAt" DESC;
```

---

## 4. FIVE KEY ARCHITECTURAL DECISIONS

1. **Deterministic Scoring vs AI Hallucination:** AI extracts qualitative labels; pure TypeScript computes the numeric score. Prevents model score drift and ensures 100% auditability.
2. **Derive, Don't Duplicate:** Only `leadScore` and `leadPriority` are stored in PostgreSQL. Score breakdowns and "Why this lead?" sentences are dynamically derived on render to prevent database desynchronization.
3. **Serverless-Safe DB Cooldowns:** Rather than volatile in-memory Maps that fail across serverless lambdas, cooldown timestamps are written directly to PostgreSQL columns (`lastChatRequestAt`, `aiAnalyzedAt`, `followUpGeneratedAt`).
4. **Dual Connection String Strategy:** `DATABASE_URL` connects to Neon's PgBouncer pooler for serverless queries; `DIRECT_URL` connects directly to PostgreSQL for DDL migrations.
5. **Prompt Injection Defense via XML Delimiters:** Customer messages and salesperson inputs are strictly encapsulated in `<customer_message>` and `<prior_conversation>` tags with immutable system instructions to treat content within tags strictly as untrusted data.

---

## 5. IMPORTANT FILE PATHS TO REMEMBER

| Module / Responsibility | File Path | Key Functions / Constants |
| :--- | :--- | :--- |
| **Deterministic Scoring** | `lib/scoring/lead-score.ts` | `calculateLeadScore()`, `getLeadExplanation()` |
| **AI Lead Analysis** | `lib/ai/lead-analysis.ts` | `analyzeLeadWithGemini()`, `buildAnalysisPrompt()`, `GEMINI_MODEL` |
| **AI Sales Assistant** | `lib/ai/sales-assistant.ts` | `chatWithSalesAssistant()`, `buildChatPrompt()`, `chatRequestSchema` |
| **Smart Follow-Up** | `lib/ai/follow-up.ts` | `getFollowUpDays()`, `getFollowUpDate()`, `generateFollowUpAi()` |
| **Intake & Zod Schema** | `lib/validations/lead.ts` | `leadInputSchema`, `formatBudgetDisplay()`, `MAX_BUDGET_INR` |
| **Database Client** | `lib/db/prisma.ts` | `prisma` singleton on `globalThis` |
| **Prisma Schema** | `prisma/schema.prisma` | `model Lead` (single model, 5 migrations) |
| **Analysis Route Handler** | `app/api/leads/[id]/analyze/route.ts` | `POST` handler, cache guard, 10s cooldown |
| **Chat Route Handler** | `app/api/leads/[id]/chat/route.ts` | `POST` handler, 5s DB cooldown, stateless chat |
| **Follow-Up Route Handler**| `app/api/leads/[id]/follow-up/route.ts`| `POST` handler, 30s DB cooldown, snapshot fallback |

---

## 6. TESTING FACTS & EXACT METRICS

- **Test Runner:** Vitest `5.0.2` (`npx vitest run`)
- **Total Test Suites:** 12 files
- **Total Tests:** 146 tests
- **Passing Tests:** 145 tests
- **Failing Tests:** 1 test (`test/grounding.test.ts:40:20`)
- **Test Speed:** ~3.78 seconds
- **TypeScript Check:** `npx tsc --noEmit` &rarr; Exit Code **0** (0 errors)
- **ESLint Check:** `npm run lint` &rarr; Exit Code **0** (0 errors)
- **Production Build:** `npm run build` &rarr; Exit Code **0** (10 routes generated)

---

## 7. HOW TO EXPLAIN THE 1 FAILING TEST IN AN INTERVIEW

- **The Question:** *"Why does `test/grounding.test.ts` fail?"*
- **The Confident DevOps Answer:**  
  "It's a prompt assertion drift issue from commit `1785784`. The developer updated the prompt text in `lib/ai/lead-analysis.ts` to improve instructions for grounding questions, changing the wording to:
  *'Suggested questions must contain ONLY information explicitly stated in the selected lead...'*.  
  However, the test in `test/grounding.test.ts` was asserting for the older phrase:  
  *'Every suggestion MUST be traceable ONLY to the authoritative lead record and customer message'*.  
  The underlying security boundary and schema validation are fully functional. In a real-world pipeline, we would update the test expectation to match the approved prompt specification."

---

## 8. FIVE LIKELY DEVOPS INTERVIEW CHALLENGES & ANSWERS

### 1. "Why is `prisma migrate deploy` in `package.json`'s build script a production risk?"
**Answer:** It couples static compilation to database availability. If Neon times out or is suspended during a Vercel build, the build fails. Furthermore, preview branch builds execute migrations against the shared development database. Migrations should be decoupled into a pre-deployment CI/CD pipeline step.

### 2. "Why use Neon Serverless with Prisma?"
**Answer:** Neon provides instant database branching for ephemeral preview environments and autoscaling compute. Pairing Prisma with Neon requires dual connection strings: `DATABASE_URL` (pooled PgBouncer on port 6543) for runtime queries, and `DIRECT_URL` (direct unpooled on port 5432) for DDL migrations.

### 3. "How do you handle rate-limiting across serverless lambdas?"
**Answer:** In-memory rate limiting does not work in serverless environments because containers do not share memory. We store timestamps directly in PostgreSQL columns (`lastChatRequestAt`, `aiAnalyzedAt`, `followUpGeneratedAt`). For edge-level protection, we would add Upstash Redis in Next.js `middleware.ts`.

### 4. "How do you roll back a bad deployment?"
**Answer:** Vercel allows instant 1-click rollback by promoting the previous deployment to production. Because our Prisma migrations are strictly additive (no destructive column drops), the previous application version runs cleanly against the current database schema.

### 5. "What happens when Gemini is down or returns invalid JSON?"
**Answer:** We implement bounded retries (max 2 attempts with a 500ms backoff). In analysis, if Gemini fails, previous completed analysis is preserved. In Smart Follow-Up, the route returns the previously generated recommendation with a non-blocking warning. User-facing responses return sanitized errors with status 500.

---

## 9. TOP 5 ENGINEERING GAPS TO MENTION PROACTIVELY

1. **No Authentication & Authorization:** All API endpoints are public; needs NextAuth / Clerk.
2. **Missing Database Composite Index:** Missing `(leadScore DESC NULLS LAST, createdAt DESC)` index on `Lead` table.
3. **Decouple Migrations from Build:** Move `prisma migrate deploy` from `package.json` to GitHub Actions.
4. **No Edge IP Rate Limiting:** Cooldowns are per-lead; needs Upstash Redis for IP-level protection.
5. **Lack of APM & LLM Tracing:** Needs Sentry for error tracking and OpenTelemetry/Langfuse for LLM token and cost observability.

