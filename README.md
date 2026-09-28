# LeadPilot AI

AI-powered real-estate sales lead prioritization and follow-up command center designed to answer one question for real estate agents: *"Which lead should I act on next, why, and what should I say?"*

## Current Status

**Phase 1 — Foundation + Database + Deployment Readiness**

Phase 1 establishes the production architecture, server-side database connectivity with PostgreSQL and Prisma, runtime health verification, environment variable isolation, and deployment readiness on Vercel.

> **Note**: Application features (Lead Intake, AI Scoring, Grounded Chat, Follow-Up reminders) are strictly scheduled for upcoming phases and are not yet implemented in Phase 1.

## Tech Stack

* **Framework**: Next.js 16 (App Router, Turbopack)
* **UI & Components**: React 19, TypeScript, Tailwind CSS v4
* **Database & ORM**: PostgreSQL, Prisma ORM 6.19 (Singleton client via globalThis)
* **Deployment Target**: Vercel

## System Architecture

```
Browser (Client Shell)
       │
       ▼
Next.js 16 App Router (Server-side API Routes)
       │
       ▼
Prisma ORM (Shared Singleton Client via globalThis)
       │
       ▼
PostgreSQL Database (Pooled runtime / Direct migration)
```

## Local Setup

### 1. Prerequisites
* Node.js 20+ (Node v22.17.1 recommended)
* npm 10+
* PostgreSQL instance running locally or via a cloud provider (e.g., Neon, Supabase)

### 2. Install Dependencies
```bash
npm install
```
This triggers `postinstall` which automatically runs `prisma generate`.

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Update `.env` with your PostgreSQL database credentials:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/leadpilot?schema=public"
DIRECT_URL="postgresql://user:password@localhost:5432/leadpilot?schema=public"
GEMINI_API_KEY=""
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Verify Health Check
Visit the live database health endpoint:
```bash
curl http://localhost:3000/api/health
```
Expected response:
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "..."
}
```

## Environment Variables

| Variable | Description | Runtime Scope | Required in Phase 1 |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection URL (pooled for serverless runtime) | Server-side only | **Yes** |
| `DIRECT_URL` | Direct unpooled PostgreSQL connection URL (used for migrations) | Server-side only | Optional / Recommended |
| `GEMINI_API_KEY` | Google Gemini API Key | Server-side only | No (Reserved for Phase 3) |

> **Security Rule**: No secrets are exposed to the client bundle. Never prefix secret variables with `NEXT_PUBLIC_`.

## Deployment Architecture

LeadPilot AI is architected for zero-configuration serverless deployment on **Vercel**:
* **Build Command**: `prisma generate && next build`
* **Output**: Standalone serverless Next.js bundle
* **Database Target**: Neon Serverless Postgres, Supabase, or any standard PostgreSQL instance
* **Health Monitoring**: `GET /api/health` queries `SELECT 1` to ensure live database connectivity on cold and warm serverless starts.
