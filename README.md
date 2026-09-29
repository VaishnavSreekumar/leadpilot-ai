# LeadPilot AI

> AI-powered sales command center for real-estate agents to prioritize inbound leads, understand buyer intent, ask grounded contextual questions, and execute deterministic follow-up plans.

LeadPilot AI answers one core operational question for real-estate sales agents: **"Which lead should I act on next, why, and what should I say?"**

- **Live Demo**: [https://leadpilot-a9o3dl9sm-vaish123-fullstcks-projects.vercel.app/](https://leadpilot-a9o3dl9sm-vaish123-fullstcks-projects.vercel.app/)
- **GitHub Repository**: [https://github.com/VaishnavSreekumar/leadpilot-ai](https://github.com/VaishnavSreekumar/leadpilot-ai)

---

## Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **UI & Styling** | React 19, TypeScript, Tailwind CSS v4 |
| **Database & ORM** | PostgreSQL (Neon Serverless), Prisma ORM 6.19 |
| **AI Provider & Model** | Google Gemini API (`gemini-3.5-flash-lite`) via `@google/genai` |
| **Validation Layer** | Zod 4.6.5 |
| **Testing** | Vitest 5.0.2 |
| **Deployment** | Vercel Serverless |

---

## Overview

Real-estate agents handle high volumes of unstructured inbound inquiries across web forms, emails, and messaging apps. Evaluating these inquiries manually creates delayed response times, poor prioritization, and lost commissions.

LeadPilot AI structures raw customer inquiries into actionable sales intelligence:
1. **Structures Unstructured Messages**: Extracts intent, budget flexibility, timeline urgency, key property requirements, and potential deal objections.
2. **Computes Deterministic Priority Scores**: Evaluates lead readiness using a transparent 100-point canonical scoring formula rather than opaque LLM numerical outputs.
3. **Provides Grounded Assistance**: Answers agent questions using strictly authoritative lead records and XML security boundaries.
4. **Recommends Smart Follow-Up Plans**: Combines deterministic follow-up schedules with AI-generated reasoning, focus points, and message drafts.

---

## Product Workflow

```mermaid
flowchart LR
    A["Inbound Customer Inquiry"] --> B["Zod Validated Intake Form"]
    B --> C[("PostgreSQL Database")]
    C --> D["Gemini Structured AI Analysis"]
    D --> E["Deterministic 100-Pt Scoring"]
    E --> F["Priority Queue (HOT / WARM / COLD)"]
    F --> G["Lead Detail Command Center"]
    G --> H["Grounded Sales Assistant"]
    G --> I["Smart Follow-Up Recommendation"]
```

---

## Architecture

LeadPilot AI uses a serverless architecture where browser clients interact with Next.js App Router API endpoints. All AI model API calls and database connections remain server-side to protect credentials and enforce data boundaries.

```mermaid
flowchart TB
    Client["Browser / React 19 UI"]

    subgraph Backend["Next.js App Router API Routes"]
        IntakeAPI["/api/leads"]
        AnalyzeAPI["/api/leads/[id]/analyze"]
        ChatAPI["/api/leads/[id]/chat"]
        FollowUpAPI["/api/leads/[id]/follow-up"]
    end

    DB[("Neon PostgreSQL")]
    Prisma["Prisma ORM Singleton"]
    Gemini["Google Gemini 2.5 Flash API"]

    Client --> IntakeAPI
    Client --> AnalyzeAPI
    Client --> ChatAPI
    Client --> FollowUpAPI

    IntakeAPI --> Prisma
    AnalyzeAPI --> Prisma
    AnalyzeAPI --> Gemini
    ChatAPI --> Prisma
    ChatAPI --> Gemini
    FollowUpAPI --> Prisma
    FollowUpAPI --> Gemini
    Prisma --> DB
```

---

## AI Architecture

The system uses Google Gemini (`gemini-3.5-flash-lite`) across three distinct backend workflows:

### 1. Lead Analysis & Extraction
When an agent requests analysis for a lead, the server passes the structured intake data and customer message to Gemini with a JSON Schema response requirement. Gemini extracts qualitative signals (`aiSummary`, `aiIntent`, `aiKeyRequirements`, `aiObjections`, `aiIntentLevel`, `aiEngagementLevel`, `aiRequirementClarity`).

```text
Lead Inbound Message
       │
       ▼
Gemini 2.5 Flash (JSON Schema Mode)
       │
       ▼
Zod Validation (safeParse)
       │
       ▼
Deterministic Scoring Function
       │
       ▼
Persisted DB Lead Record
```

### 2. Grounded Sales Assistant
Agents can ask follow-up questions about a specific lead (e.g., *"What is the primary constraint holding back this buyer?"*). The server retrieves the authoritative lead record from PostgreSQL, constructs a prompt using XML isolation delimiters (`<customer_message>`, `<salesperson_question>`), and streams a grounded answer.

```text
Salesperson Question + Lead ID
       │
       ▼
Server-Fetched DB Lead Context
       │
       ▼
XML Prompt Isolation & Security Delimiters
       │
       ▼
Gemini Grounded Response
```

### 3. Smart Follow-Up (Custom Feature)
Combines deterministic business timing logic with AI-generated communication content. The application calculates the exact follow-up date based on buying timeline and priority, while Gemini generates the qualitative reason, key focus points, and outreach draft.

```text
Lead Timeline + Priority
       │
       ▼
Deterministic App Logic ──► Canonical Follow-Up Date (DB)
       │
       ▼
Gemini Generation ────────► Reason + Focus Points + Outreach Message
```

---

## Lead Prioritization & Scoring

LeadPilot AI calculates a 100-point canonical lead score using a deterministic formula. AI extracts qualitative attributes, but the mathematical scoring rules are executed purely in TypeScript application code.

### Canonical Scoring Breakdown (Max 100 Points)

| Category | Signal Value | Points |
| :--- | :--- | :--- |
| **Buying Timeline** *(Max 30 pts)* | `0-3 months`<br>`3-6 months`<br>`6-12 months`<br>`exploring` / unknown | **30 pts**<br>**20 pts**<br>**10 pts**<br>**5 pts** |
| **Intent Level** *(Max 30 pts)* | `HIGH`<br>`MEDIUM`<br>`LOW`<br>Unanalyzed / Null | **30 pts**<br>**20 pts**<br>**10 pts**<br>**0 pts** |
| **Engagement Level** *(Max 20 pts)* | `HIGH`<br>`MEDIUM`<br>`LOW`<br>Unanalyzed / Null | **20 pts**<br>**12 pts**<br>**5 pts**<br>**0 pts** |
| **Requirement Clarity** *(Max 20 pts)* | `CLEAR`<br>`MODERATE`<br>`VAGUE`<br>Unanalyzed / Null | **20 pts**<br>**12 pts**<br>**5 pts**<br>**0 pts** |

### Priority Classification Tiers

- **`HOT`**: Score $\ge 75$ (Immediate outreach required)
- **`WARM`**: Score $50 - 74$ (Active nurturing queue)
- **`COLD`**: Score $< 50$ or Unanalyzed (Low urgency)

### Queue Ranking Order
The main dashboard query sorts leads by:
```sql
ORDER BY "leadScore" DESC NULLS LAST, "createdAt" DESC
```

---

## Why Deterministic Scoring?

Instead of asking the LLM to assign an arbitrary score (e.g. *"Give this customer a score from 0-100"*), LeadPilot AI separates attribute extraction from scoring logic:

1. **LLM Responsibility**: Extract structured signals (e.g. `aiIntentLevel: "HIGH"`, `aiRequirementClarity: "CLEAR"`).
2. **Application Responsibility**: Pass signals into a pure TypeScript function to return a reproducible score.

**Benefits**:
- **Reproducibility**: The same underlying lead attributes always yield the exact same score.
- **Explainability**: Sales agents can inspect the exact point breakdown (e.g., *"0-3 month timeline (+30), HIGH intent (+30), HIGH engagement (+20), CLEAR requirements (+20) = 100/100 HOT"*).
- **Auditability**: Prevents model non-determinism or temperature shifts from corrupting sales queue rankings.

---

## Grounded Sales Assistant

The Sales Assistant provides a lead-specific copilot interface. It prevents hallucinated property claims and prompt injection attacks through a server-side trust hierarchy:

```mermaid
sequenceDiagram
    autonumber
    actor Agent as Sales Agent
    participant UI as React Component
    participant Route as Next.js API Route
    participant DB as PostgreSQL DB
    participant LLM as Gemini API

    Agent->>UI: Submit question
    UI->>Route: POST /api/leads/[id]/chat
    Route->>DB: Fetch selected lead by route parameter [id]
    DB-->>Route: Authoritative DB Lead Record
    Route->>Route: Check DB 10s cooldown (lastChatRequestAt)
    Route->>LLM: System Security Prompt + DB Context + XML Delimited Input
    LLM-->>Route: Grounded Answer JSON
    Route->>DB: Update lastChatRequestAt timestamp
    Route-->>UI: Return Response
    UI-->>Agent: Render Answer
```

### Trust & Security Boundaries
- **System Instructions**: Highest authority; instructs model to remain in real-estate assistant role and reject override attempts.
- **Authoritative DB Lead**: Factual context retrieved from server database based on route `[id]`. Client context is ignored.
- **Untrusted User Inputs**: Inbound customer messages and agent inputs are enclosed in `<customer_message>` and `<salesperson_question>` tags, treated as data to analyze rather than system instructions.

---

## Smart Follow-Up (Custom Feature)

Smart Follow-Up solves the agent's problem of planning post-analysis customer touchpoints. It determines **when** to re-engage, **why**, and **what message draft to send**.

### Deterministic Follow-Up Timing Matrix

| Buying Timeline | Base Follow-Up Interval | HOT Priority Interval (Halved) |
| :--- | :--- | :--- |
| `0-3 months` | 2 days | **1 day** |
| `3-6 months` | 5 days | **2 days** |
| `6-12 months` | 10 days | **5 days** |
| `exploring` / unknown | 14 days | **7 days** |

### Smart Follow-Up Architecture

```mermaid
flowchart LR
    A["Lead Timeline + Priority"] --> B["Deterministic Application Logic"]
    B --> C[("Canonical Follow-Up Date in DB")]

    D["Selected Lead Context"] --> E["Gemini 2.5 Flash"]
    C --> E

    E --> F["Follow-Up Reason"]
    E --> G["Focus Points List"]
    E --> H["Suggested Message Draft"]

    F --> I[("Persisted to DB")]
    G --> I
    H --> I
```

### Execution & Caching Rules
- **Application Controls Timing**: `followUpRecommendedAt` date is computed by TypeScript logic (`Date.now() + days`). Gemini cannot override this date.
- **AI Content Generation**: Gemini generates 3 fields: `reason` (why this timing makes sense), `focusPoints` (2–4 key talking points), and `suggestedMessage` (draft outreach message).
- **Cached Lookups**: Subsequent page views read persisted recommendations from PostgreSQL without calling Gemini.
- **Explicit Regeneration**: Agents can click **Regenerate**, which enforces a 30-second DB-backed rate limit (`followUpGeneratedAt`).
- **Failure Preservation**: If AI regeneration fails, the API preserves the existing recommendation in DB rather than clearing data.

---

## Data Model

The PostgreSQL database uses a single `Lead` model managed via Prisma ORM:

| Field Group | Field Names | Types | Description |
| :--- | :--- | :--- | :--- |
| **Core Intake** | `id`, `name`, `location`, `propertyRequirement`, `budgetInr`, `buyingTimeline`, `customerMessage` | `String`, `Int` | Submitted by intake form |
| **AI Intelligence** | `aiSummary`, `aiIntent`, `aiKeyRequirements`, `aiObjections`, `aiRecommendedNextAction`, `aiSuggestedResponse` | `String?`, `String[]` | Extracted by Gemini analysis |
| **Classifications** | `aiIntentLevel`, `aiEngagementLevel`, `aiRequirementClarity`, `aiAnalysisStatus`, `aiAnalyzedAt` | `String?`, `DateTime?` | Structural AI metadata |
| **Prioritization** | `leadScore`, `leadPriority` | `Int?`, `String?` | Calculated by canonical scoring model |
| **Rate Limiting** | `lastChatRequestAt` | `DateTime?` | Chat cooldown timestamp |
| **Smart Follow-Up**| `followUpRecommendedAt`, `followUpReason`, `followUpFocusPoints`, `followUpMessage`, `followUpGeneratedAt` | `DateTime?`, `String?`, `String[]` | Smart follow-up recommendation state |
| **Audit Trails** | `createdAt`, `updatedAt` | `DateTime` | Automatic system timestamps |

---

## API Surface

| Method | Endpoint | Purpose | Cooldown / Caching |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Application & database connection health check | None |
| `POST` | `/api/leads` | Create a new lead record | Server Zod validation |
| `GET` | `/api/leads` | Fetch all leads (ranked by score DESC) | Database query |
| `GET` | `/api/leads/[id]` | Fetch single lead record | Database query |
| `POST` | `/api/leads/[id]/analyze` | Trigger or retry Gemini lead analysis & scoring | Cached; explicit force flag |
| `POST` | `/api/leads/[id]/chat` | Ask grounded Sales Assistant question | **10-second DB cooldown** (`lastChatRequestAt`) |
| `POST` | `/api/leads/[id]/follow-up` | Generate or regenerate Smart Follow-Up plan | Cached; **30-second DB cooldown** (`followUpGeneratedAt`) |

---

## Key Engineering Decisions

1. **Server-Side AI Invocation**: `GEMINI_API_KEY` is referenced strictly in server-side routes (`lib/ai/*.ts`). API keys are never bundled into client-side JavaScript.
2. **Native Gemini JSON Schema + Zod Dual Validation**: API calls enforce native model JSON schemas at the API layer, followed by strict Zod validation (`safeParse()`) before persisting to database.
3. **Deterministic Business Rules vs AI Content**: Business-critical decisions (score calculation, follow-up dates) are handled by pure application functions. Qualitative insights (summaries, objections, message drafts) are handled by LLM calls.
4. **Serverless-Safe DB Rate Limiting**: In-memory `Map` or process-level rate limiters do not persist across serverless lambdas. Cooldown timestamps (`lastChatRequestAt`, `followUpGeneratedAt`) are stored directly in PostgreSQL columns.
5. **Snapshot Failure Preservation**: When regenerating follow-ups or chat responses, the previous database state is snapshot before calling Gemini. If Gemini API fails or times out, the previous valid recommendation is preserved.
6. **Stateless Conversational Assistant**: Chat history is kept in component state during an active session rather than persisted as heavy database rows, keeping the database schema lightweight and performant.

---

## Reliability and Safety

- **Input Validation**: All form submissions and API payloads are sanitized and validated using Zod schemas (`lib/validations/lead.ts`).
- **Prompt Injection Defense**: Inbound customer content is enclosed in `<customer_message>` tags and treated explicitly as untrusted data to analyze.
- **Cross-Lead Isolation**: API endpoints fetch authoritative lead context from the database using server route parameters (`[id]`), preventing client-side parameter tampering.
- **Cost Protection**: Page loads do not trigger automated Gemini calls. Analysis and follow-ups are generated on-demand and cached in database columns.

---

## Local Development

### 1. Prerequisites
- **Node.js**: v20+ (v22.17+ recommended)
- **Database**: Local PostgreSQL or cloud instance (e.g. Neon PostgreSQL)
- **API Key**: Google Gemini API key ([Google AI Studio](https://aistudio.google.com/))

### 2. Installation & Setup

```bash
# Clone the repository
git clone https://github.com/VaishnavSreekumar/leadpilot-ai.git
cd leadpilot-ai

# Install dependencies (automatically runs prisma generate)
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/leadpilot?schema=public"
DIRECT_URL="postgresql://user:password@localhost:5432/leadpilot?schema=public"
GEMINI_API_KEY="your-gemini-api-key-here"
```

### 4. Run Migrations & Start App

```bash
# Apply Prisma database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Testing

The repository contains unit tests, prompt security assertions, mutation safety checks, and live Gemini API integration tests using Vitest.

```bash
# Run Vitest unit & integration test suite
npm test

# Run ESLint check
npm run lint

# Run TypeScript compilation check
npx tsc --noEmit

# Test production build locally
npm run build
```

**Test Coverage Summary**:
- **142 / 142** unit tests passing across 11 test suites.
- **13 / 13** live Gemini verification scenarios passing (`test/verify-gemini-live-phase5.mjs` and `test/verify-gemini-live-phase6.mjs`).

---

## Deployment

LeadPilot AI is deployed on Vercel with Neon Serverless Postgres:

- **Build Command**: `prisma generate && prisma migrate deploy && next build`
- **Node.js Version**: `20.x` / `22.x`
- **Environment Variables Required**: `DATABASE_URL`, `DIRECT_URL`, `GEMINI_API_KEY`

---

## Known Limitations

1. **Stateless Sales Assistant**: Conversation history persists only within active browser component state and resets on hard page refresh.
2. **Single-Agent Workspace**: Designed as an internal sales tool without multi-tenant user authentication or role-based access control (RBAC).
3. **No Live MLS / Property Inventory Sync**: The AI analyzes customer intent based on provided lead text; it cannot verify real-time market inventory availability or external MLS pricing.
4. **No Direct Calendar Integration**: Follow-up dates are calculated and recommended visually, but are not automatically posted to external Google Calendar or Outlook APIs.

---

## AI Usage Disclosure

AI tools were used throughout development as development assistants, primarily for prompt engineering, implementation planning, code generation, and verification.

- **ChatGPT and Claude** were used during the planning stage to refine implementation prompts, compare approaches, identify edge cases, and iteratively improve the development instructions before implementation.
- **Antigravity** was used as the primary agentic coding environment. The finalized prompts were provided to Antigravity to generate implementation plans and implement the application phases.
- **ChatGPT** was also used to review and verify the generated implementation plans, architecture, security boundaries, test coverage, and phase-specific changes before they were accepted.
- **Google Gemini 2.5 Flash** is the runtime AI model integrated into LeadPilot AI itself. It performs lead analysis, grounded sales assistance, and Smart Follow-Up content generation.

The final application logic, architecture, validation, deterministic scoring rules, database design, and integration decisions were reviewed throughout development rather than relying on AI-generated output without verification.

---

## Demo

Demo video: _To be added before submission._
