# LEADPILOT AI — SYSTEM ARCHITECTURE SPECIFICATION

This document details the verified architectural topology, component responsibilities, data flow, and deployment model of **LeadPilot AI**. 

All diagrams and specifications reflect actual source code in this repository.

---

## 1. END-TO-END APPLICATION ARCHITECTURE

The diagram below illustrates the end-to-end architecture, from the client browser interface through Next.js serverless route handlers, the deterministic scoring engine, Neon PostgreSQL persistence, and Google Gemini API integration.

```mermaid
flowchart TB
    subgraph ClientLayer["Client Layer (Browser / React 19)"]
        UI_Dash["Dashboard (/)<br/>LeadTable.tsx"]
        UI_New["New Lead Form (/leads/new)<br/>LeadForm.tsx"]
        UI_Detail["Lead Detail (/leads/[id])<br/>LeadAnalysisWorkspace.tsx"]
        UI_Chat["Sales Assistant<br/>SalesAssistant.tsx"]
        UI_Follow["Smart Follow-Up<br/>SmartFollowUp.tsx"]
    end

    subgraph ServerLayer["Server Layer (Next.js 16 App Router / Turbopack)"]
        RSC_Home["app/page.tsx (RSC)"]
        RSC_Detail["app/leads/[id]/page.tsx (RSC)"]

        subgraph APIRoutes["API Route Handlers (app/api/)"]
            API_Health["GET /api/health<br/>Health Check"]
            API_Leads["GET, POST /api/leads<br/>Lead Intake & Query"]
            API_Analyze["POST /api/leads/[id]/analyze<br/>AI Analysis & Scoring"]
            API_Chat["POST /api/leads/[id]/chat<br/>Grounded Sales Assistant"]
            API_Follow["POST /api/leads/[id]/follow-up<br/>Smart Follow-Up Cadence"]
        end

        subgraph CoreModules["Core Modules (lib/)"]
            Validations["lib/validations/lead.ts<br/>Zod Schemas"]
            ScoringEngine["lib/scoring/lead-score.ts<br/>Deterministic 100-Pt Engine"]
            AI_Analysis["lib/ai/lead-analysis.ts<br/>Gemini Extraction & Prompts"]
            AI_Chat["lib/ai/sales-assistant.ts<br/>Grounded Chat Prompts"]
            AI_Follow["lib/ai/follow-up.ts<br/>Follow-Up Timing & Prompts"]
            PrismaSingleton["lib/db/prisma.ts<br/>Prisma Client Singleton"]
        end
    end

    subgraph DataLayer["Persistence Layer (Neon Serverless PostgreSQL)"]
        PgBouncer["Neon Connection Pooler (PgBouncer)<br/>DATABASE_URL (Port 6543)"]
        DirectPostgres["Neon Direct PostgreSQL<br/>DIRECT_URL (Port 5432)"]
        Table_Lead[("Lead Table<br/>PostgreSQL 16")]
    end

    subgraph ExternalServices["External Cloud Services"]
        GeminiAPI["Google Gemini 3.5 Flash Lite API<br/>(@google/genai SDK)"]
    end

    %% Client to Server bindings
    UI_Dash --> RSC_Home
    UI_New -->|POST JSON| API_Leads
    UI_Detail --> RSC_Detail
    UI_Detail -->|POST trigger| API_Analyze
    UI_Chat -->|POST message + history| API_Chat
    UI_Follow -->|POST force boolean| API_Follow

    %% Server Component to DB
    RSC_Home --> PrismaSingleton
    RSC_Detail --> PrismaSingleton

    %% API Routes to Core Modules
    API_Leads --> Validations
    API_Leads --> PrismaSingleton
    API_Analyze --> AI_Analysis
    API_Analyze --> ScoringEngine
    API_Analyze --> PrismaSingleton
    API_Chat --> AI_Chat
    API_Chat --> PrismaSingleton
    API_Follow --> AI_Follow
    API_Follow --> PrismaSingleton
    API_Health --> PrismaSingleton

    %% AI Modules to Gemini
    AI_Analysis -->|JSON Schema Prompt| GeminiAPI
    AI_Chat -->|Grounded XML Prompt| GeminiAPI
    AI_Follow -->|Cadence Prompt| GeminiAPI

    %% Prisma to Neon
    PrismaSingleton --> PgBouncer
    PgBouncer --> Table_Lead
    DirectPostgres -.->|Migrations Only| Table_Lead
```

---

## 2. COMPONENT RESPONSIBILITY MATRIX

| Component / File | Execution Boundary | Dependencies | Key Input / Output | Implementation State |
| :--- | :--- | :--- | :--- | :--- |
| `app/page.tsx` | Server (RSC) | `lib/db/prisma.ts`, `LeadTable.tsx` | In: HTTP Request<br/>Out: Server-rendered HTML with ranked leads | **Fully Implemented** |
| `app/leads/[id]/page.tsx` | Server (RSC) | `lib/db/prisma.ts`, `LeadAnalysisWorkspace.tsx` | In: Route `[id]`<br/>Out: Hydrated lead detail page or 404 | **Fully Implemented** |
| `components/LeadForm.tsx` | Client (`'use client'`) | `lib/validations/lead.ts`, Next Router | In: User form inputs<br/>Out: `POST /api/leads` payload, live preview | **Fully Implemented** |
| `components/LeadTable.tsx` | Client (`'use client'`) | `lib/scoring/lead-score.ts`, `types` | In: Server-hydrated leads array<br/>Out: Filtered UI tabs (`HOT`, `WARM`, `COLD`) | **Fully Implemented** |
| `components/SalesAssistant.tsx` | Client (`'use client'`) | Native `fetch`, React state | In: User text, lead context<br/>Out: Interactive chat stream & suggested questions | **Fully Implemented** |
| `components/SmartFollowUp.tsx` | Client (`'use client'`) | Native `fetch`, React state | In: Lead ID, follow-up state<br/>Out: Cadence card, reason, suggested message | **Fully Implemented** |
| `lib/scoring/lead-score.ts` | Server / Client | None (Pure TypeScript) | In: `ScoringInput` attributes<br/>Out: `ScoreResult` (Total, Priority, Breakdown) | **Fully Implemented** |
| `lib/ai/lead-analysis.ts` | Server-only | `@google/genai`, `zod`, `server-only` | In: `LeadContextForAnalysis`<br/>Out: `LeadAnalysisResult` (Zod validated) | **Fully Implemented** |
| `lib/ai/sales-assistant.ts` | Server-only | `@google/genai`, `zod`, `server-only` | In: Lead context, history, question<br/>Out: Grounded `ChatResponse` | **Fully Implemented** |
| `lib/ai/follow-up.ts` | Server-only | `@google/genai`, `zod`, `server-only` | In: Timeline, priority, lead context<br/>Out: `FollowUpAiResult`, timing days | **Fully Implemented** |
| `lib/db/prisma.ts` | Server-only | `@prisma/client`, `server-only` | In: Environment variables<br/>Out: `PrismaClient` singleton on `globalThis` | **Fully Implemented** |

---

## 3. LEAD PROCESSING & SCORING SEQUENCE

The sequence diagram below shows how an inbound lead is analyzed, scored deterministically, and persisted without allowing AI to influence the mathematical calculation.

```mermaid
sequenceDiagram
    autonumber
    actor SalesAgent as Sales Agent
    participant DetailPage as React UI (/leads/[id])
    participant AnalyzeRoute as POST /api/leads/[id]/analyze
    participant DB as PostgreSQL (Neon)
    participant Gemini as Google Gemini 3.5 Flash Lite
    participant Scorer as TypeScript Scoring Engine

    SalesAgent->>DetailPage: Click "Analyze Lead"
    DetailPage->>AnalyzeRoute: POST { force: false }
    AnalyzeRoute->>DB: prisma.lead.findUnique({ where: { id } })
    DB-->>AnalyzeRoute: Return Lead Record

    alt Already Completed & Not Forced
        AnalyzeRoute->>Scorer: calculateLeadScore(existingFields)
        Scorer-->>AnalyzeRoute: Return Derived Breakdown
        AnalyzeRoute-->>DetailPage: Return Cached Analysis & Breakdown (Status 200)
    else Needs Analysis
        AnalyzeRoute->>AnalyzeRoute: Check 10s Cooldown (Date.now() - aiAnalyzedAt)
        AnalyzeRoute->>DB: prisma.lead.update({ data: { aiAnalysisStatus: "PENDING" } })
        
        AnalyzeRoute->>Gemini: generateContent(model, prompt, jsonSchema)
        Note over AnalyzeRoute,Gemini: Attempt 1 (Bounded Retry max 2)
        
        alt Gemini Transient Error
            Gemini-->>AnalyzeRoute: Error / Invalid JSON
            AnalyzeRoute->>AnalyzeRoute: Wait 500ms
            AnalyzeRoute->>Gemini: generateContent(model, prompt, jsonSchema) (Attempt 2)
        end

        Gemini-->>AnalyzeRoute: Valid Structured JSON
        AnalyzeRoute->>AnalyzeRoute: leadAnalysisSchema.safeParse(json)
        
        AnalyzeRoute->>Scorer: calculateLeadScore({ intentLevel, timeline, budget, clarity, engagement })
        Note over Scorer: Pure Math: Intent(30) + Timeline(25) + Budget(15) + Clarity(15) + Engagement(15)
        Scorer-->>AnalyzeRoute: Return { score: 85, priority: "HOT", breakdown }

        AnalyzeRoute->>DB: prisma.lead.update({ data: { aiSummary, aiIntent, leadScore: 85, leadPriority: "HOT", ... } })
        DB-->>AnalyzeRoute: Updated Lead Record
        AnalyzeRoute-->>DetailPage: Return Updated Lead + Breakdown (Status 200)
        DetailPage->>SalesAgent: Render Score Badge (85/100 HOT) & Action Plan
    end
```

---

## 4. GROUNDED SALES ASSISTANT INTERACTION SEQUENCE

This sequence illustrates how prompt injection defense and authoritative database context isolate the Sales Assistant from untrusted user content.

```mermaid
sequenceDiagram
    autonumber
    actor SalesAgent as Sales Agent
    participant ChatUI as SalesAssistant.tsx
    participant ChatRoute as POST /api/leads/[id]/chat
    participant DB as PostgreSQL (Neon)
    participant Gemini as Google Gemini 3.5 Flash Lite

    SalesAgent->>ChatUI: Type question (e.g. "What objections did they mention?")
    ChatUI->>ChatRoute: POST { message, history (max 6 turns) }
    
    ChatRoute->>ChatRoute: chatRequestSchema.safeParse(body)
    ChatRoute->>DB: Fetch authoritative lead by route param [id]
    DB-->>ChatRoute: Authoritative Lead Record
    
    ChatRoute->>ChatRoute: Verify 5s Cooldown (Date.now() - lastChatRequestAt)
    ChatRoute->>DB: Update lastChatRequestAt = now()

    Note over ChatRoute: Construct Grounded Prompt:<br/>1. Immutable System Instructions<br/>2. Authoritative DB Context<br/>3. <customer_message> Untrusted XML<br/>4. <prior_conversation> Untrusted XML<br/>5. <current_salesperson_request> Untrusted XML

    ChatRoute->>Gemini: generateContent(prompt, chatResponseSchema)
    Gemini-->>ChatRoute: Structured Response { answer, suggestedQuestions }
    ChatRoute->>ChatRoute: chatResponseSchema.safeParse(response)
    
    ChatRoute-->>ChatUI: Return { answer, suggestedQuestions }
    ChatUI->>SalesAgent: Display Grounded Assistant Response
```

---

## 5. SMART FOLLOW-UP TIMING & CONTENT GENERATION FLOW

The flow diagram below demonstrates how deterministic business rules govern follow-up dates while Gemini provides contextual qualitative messaging.

```mermaid
flowchart TD
    Start(["Agent Triggers Follow-Up Generation"]) --> CheckCache{"Cached Recommendation<br/>Exists & force != true?"}
    
    CheckCache -->|Yes| ReturnCached["Return Persisted DB Follow-Up<br/>(Cached Status 200)"]
    
    CheckCache -->|No| CheckCooldown{"Regeneration Cooldown<br/>(Date.now() - followUpGeneratedAt < 30s)?"}
    CheckCooldown -->|Yes| Return429["Return HTTP 429<br/>Cooldown Active"]
    
    CheckCooldown -->|No| CalcTiming["Deterministic Application Logic<br/>getFollowUpDays(timeline, priority)"]
    
    subgraph DeterministicMatrix["Deterministic Timing Rules (lib/ai/follow-up.ts)"]
        R1["0-3 months &rarr; 2 days (HOT: 1 day)"]
        R2["3-6 months &rarr; 5 days (HOT: 2 days)"]
        R3["6-12 months &rarr; 10 days (HOT: 5 days)"]
        R4["exploring &rarr; 14 days (HOT: 7 days)"]
    end
    
    CalcTiming --> DeterministicMatrix
    DeterministicMatrix --> SetDate["Calculate followUpRecommendedAt = now() + days"]
    
    SetDate --> CallGemini["Call Gemini 3.5 Flash Lite<br/>Generate: reason, focusPoints, suggestedMessage"]
    
    CallGemini --> CheckSuccess{"Gemini Call<br/>Succeeded?"}
    
    CheckSuccess -->|Yes| PersistDB["Persist to PostgreSQL:<br/>followUpRecommendedAt, followUpReason,<br/>followUpFocusPoints, followUpMessage,<br/>followUpGeneratedAt"]
    PersistDB --> ReturnSuccess["Return Fresh Follow-Up Plan (Status 200)"]
    
    CheckSuccess -->|No| CheckSnapshot{"Previous Recommendation<br/>Existed in DB?"}
    CheckSnapshot -->|Yes| ReturnPreserved["Preserve & Return Previous Recommendation<br/>(Non-blocking Warning Status 200)"]
    CheckSnapshot -->|No| Return500["Return HTTP 500<br/>Service Temporarily Unavailable"]
```

---

## 6. PRODUCTION DEPLOYMENT TOPOLOGY (VERCEL & NEON)

The deployment diagram illustrates the separation between build-time compilation, runtime serverless execution, and multi-branch database environments.

```mermaid
flowchart TB
    subgraph DeveloperWorkspace["Developer Environment"]
        GitRepo["Git Repository (GitHub)<br/>Branches: main, feat/*, fix/*"]
        LocalDev["Local Machine<br/>.env (leadpilot-dev branch)"]
    end

    subgraph CI_CD["Vercel Deployment Pipeline"]
        VercelHook["Vercel GitHub Integration"]
        BuildStep["Build Step:<br/>1. prisma generate<br/>2. prisma migrate deploy<br/>3. next build (Turbopack)"]
    end

    subgraph VercelEdge["Vercel Edge & Serverless Runtime"]
        CDN["Vercel Global CDN<br/>Static Assets (/leads/new, JS, CSS)"]
        ServerlessLambda["Serverless Lambdas (Node.js)<br/>Dynamic Routes: /, /leads/[id], /api/*"]
    end

    subgraph NeonCloud["Neon Serverless PostgreSQL (AWS ap-southeast-1)"]
        subgraph DevBranch["Development Branch (leadpilot-dev)"]
            DevPooler["PgBouncer Pooler (Port 6543)"]
            DevDirect["Direct PostgreSQL (Port 5432)"]
            DevDB[("Development Database")]
        end

        subgraph ProdBranch["Production Branch (production)"]
            ProdPooler["PgBouncer Pooler (Port 6543)<br/>DATABASE_URL"]
            ProdDirect["Direct PostgreSQL (Port 5432)<br/>DIRECT_URL"]
            ProdDB[("Production Database")]
        end
    end

    subgraph GoogleCloud["Google Cloud Platform"]
        GeminiService["Gemini API Endpoint<br/>(gemini-3.5-flash-lite)"]
    end

    %% Git to Vercel
    GitRepo -->|Push to main| VercelHook
    VercelHook --> BuildStep
    BuildStep --> CDN
    BuildStep --> ServerlessLambda

    %% Build Step to Direct DB for migrations
    BuildStep -.->|DDL Migrations| ProdDirect

    %% Runtime connections
    ServerlessLambda -->|Pooled Queries| ProdPooler
    ProdPooler --> ProdDB
    ProdDirect --> ProdDB

    ServerlessLambda -->|HTTPS API Requests| GeminiService

    %% Dev environment
    LocalDev -.-> DevPooler
    DevPooler --> DevDB
    DevDirect --> DevDB
```

---

## 7. ARCHITECTURAL SUMMARY

LeadPilot AI adheres to clean enterprise software engineering principles:
1. **Separation of Concerns:** Statistical LLM capabilities are strictly confined to unstructured text understanding and natural language generation. All mathematical, ranking, timing, and rate-limiting policies are enforced by deterministic TypeScript and PostgreSQL.
2. **Resilience & Fault Tolerance:** Pre-call snapshotting, bounded retries (max 2 attempts), non-mutating failure handlers, and database-persisted cooldowns protect system stability against external API interruptions.
3. **Defense in Depth:** XML boundary encapsulation, schema-enforced prompt structures, and server-side secret boundaries (`server-only`) protect against injection attacks and credential leaks.

