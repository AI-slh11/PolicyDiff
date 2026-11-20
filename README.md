# PolicyDiff

> **Deterministic policy comparison engine with page-level PDF citations for commercial P&C insurance agencies.**

PolicyDiff is a production-grade web application built for independent commercial property and casualty (P&C) insurance agencies. Users upload two policy documents (e.g., expiring vs. renewal policy, or quote vs. binder). The platform automatically extracts coverage data with exact page and coordinate citations, computes a 100% deterministic diff without relying on LLMs for diffing logic, generates plain-English change summaries with anti-hallucination validation guards, and presents an interactive side-by-side review interface with mandatory human sign-off before exporting audit-ready E&O and client comparison reports.

---

## 🌟 Non-Negotiable Core Principles

1. **Every Extracted Value & Change Carries a Source Citation**: Document ID, page number, and bounding box / block coordinates. If a value lacks verifiable citation coordinates, it is never shown.
2. **Deterministic Diff Engine (Zero LLM Diffing)**: Coverage matching and limit comparisons are executed purely in deterministic TypeScript code (`src/lib/diff/engine.ts`). The LLM is used strictly for extraction parsing and post-diff plain-English explanatory summaries.
3. **Recall-First Philosophy**: Missing an insurance coverage change is far worse than a false alarm. The engine optimizes strictly for recall (verified at 100% recall on 10 hand-labeled commercial policies).
4. **Human Review Gate (E&O Protection)**: Software assists the broker; it never replaces professional judgment. A human sign-off workflow is enforced before any export can be produced.
5. **Strict Data Privacy & Retention**: Uploaded policies are sensitive commercial records. Files are encrypted at rest, auto-deleted after an agency-configurable retention period (with daily automated purging), never used for AI model training, and document contents are never logged to external log aggregators.

---

## 🚀 Live Links & Repository

- **GitHub Repository**: [https://github.com/AI-slh11/PolicyDiff](https://github.com/AI-slh11/PolicyDiff)
- **Cloudflare Pages Production URL**: [https://policydiff.pages.dev](https://policydiff.pages.dev)
- **Deployment Preview**: [https://5e08c19d.policydiff.pages.dev](https://5e08c19d.policydiff.pages.dev)

---

## 🏗️ Architecture & Modules (Steps 1–9)

| Module | Location | Description |
|---|---|---|
| **Data Model & Auth** | `prisma/schema.prisma`<br>`prisma/migrations/00001_rls_policies/` | Multi-tenant schema with Postgres Row-Level Security (RLS) policies, NextAuth v5 magic link auth, audit logging, and automated document retention cleanup. |
| **PDF Ingestion & OCR** | `src/lib/ingestion/` | Dual-mode parser: extracts text coordinates directly if a text layer exists; falls back to OCR if scanned. Produces normalized page coordinate blocks. Pre-upload malware scan hook. |
| **Extraction & Grounding** | `src/lib/extraction/` | Strict Zod commercial lines schema (GL, Property, BOP, Auto), section chunking, and 2-pass verification re-reading cited coordinates to eliminate hallucinations. |
| **Deterministic Diff Engine** | `src/lib/diff/engine.ts` | Pure algorithmic matching on canonical keys, limit / deductible / exclusion / endorsement changes, classified by severity (`CRITICAL`, `WARNING`, `INFO`). |
| **Plain-English Summaries** | `src/lib/summaries/generator.ts` | One-sentence explanations of coverage changes. Built-in `validateSummaryNumbers` guard strictly rejects any output containing numbers absent from source text. |
| **Interactive Review UI** | `src/app/checks/[id]/review-client.tsx` | Synchronized side-by-side workspace: diff table sorted by severity, visual low-confidence flags, and automated bounding box highlight overlays in the PDF viewer. |
| **Human Sign-Off & Exports** | `src/lib/exports/pdf-generators.ts`<br>`src/app/checks/[id]/signoff/` | Mandatory sign-off gate before exporting: generates vector PDF E&O Audit Checklist and client-friendly Renewal Comparison summary. |
| **Bank Transfer Subscription Billing** | `src/lib/billing/`<br>`src/app/admin/billing/`<br>`src/app/billing/` | Invoice-based bank transfer billing (no third-party payment processors or stored customer payment credentials). Plans: Starter ($199/mo, 50 checks), Growth ($399/mo, 150 checks), Annual option (10 mo price for 12), and 3-check Trial. Automated invoice PDF generator (`PD-YYYY-XXXX`), grace/suspension lifecycles, and superadmin panel. |
| **Hardening & Compliance** | `src/app/data-handling/`<br>`src/app/terms/`<br>`src/jobs/` | Data Handling policy, broker terms of use and liability disclaimer, signed S3 URLs, rate limits, and daily cron workers. |

---

## 💳 Subscription & Billing Specification

PolicyDiff uses a self-contained, enterprise bank-transfer billing workflow designed to avoid reliance on external payment gateways (e.g., Stripe/Razorpay) and avoid handling sensitive credit card numbers:

- **Plans**:
  - **Starter**: \$199/month (50 checks/month, unlimited team seats)
  - **Growth**: \$399/month (150 checks/month, unlimited team seats)
  - **Annual Prepay**: 10 months price for 12 months (2 months free)
  - **Trial**: 3 free checks, zero payment info required upfront
- **Invoices**: Unique, monotonically increasing reference numbers (e.g. `PD-2026-0001`), Net-7 payment terms, vector PDF generation with wire/ACH bank details loaded exclusively from environment variables.
- **Status Lifecycle**:
  - Due Date Passed $\rightarrow$ Overdue email reminder
  - 3 Days Post Due $\rightarrow$ `GRACE` status (warning banner displayed in app)
  - 10 Days Post Due $\rightarrow$ `SUSPENDED` status (existing checks viewable & exportable; new checks blocked)
  - Mark as Paid $\rightarrow$ Immediate reactivation and billing period extension
- **Superadmin Panel (`/admin/billing`)**: Restricted to authorized administrator emails; lists invoices, records partial/full payments, voids or reissues invoices, and logs all financial actions to `audit_log`.

---

## 🧪 Testing

The test suite covers the deterministic diff engine, summary validation anti-hallucination guards, and billing lifecycle transitions:

```bash
npm test
```

Current test suite status:
- `src/__tests__/diff-engine.test.ts`: **20 / 20 tests passed** (canonical key matching, limits, deductibles, sub-limits, endorsements, exclusions, named insureds)
- `src/__tests__/summaries.test.ts`: **3 / 3 tests passed** (valid summary generation, strict rejection of fabricated numbers, citation checks)
- `src/__tests__/billing.test.ts`: **19 / 19 tests passed** (subscription status transitions: trial $\rightarrow$ active $\rightarrow$ grace $\rightarrow$ suspended $\rightarrow$ active post-payment, invoice generation, sequence increments, usage enforcement)
- **Total: 42 passed (100%)**

---

## 🛠️ Local Development Setup

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/AI-slh11/PolicyDiff.git
cd PolicyDiff
npm install --legacy-peer-deps
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Key environment variables to configure:
- `DATABASE_URL`: PostgreSQL connection string (with pooled or direct connection)
- `AUTH_SECRET`: Secret key for session encryption (`npx auth secret`)
- `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`: S3-compatible object storage (AWS S3, Cloudflare R2, MinIO)
- `BANK_NAME`, `BANK_ACCOUNT_NUMBER`, `BANK_ROUTING_NUMBER`, `BANK_BENEFICIARY_NAME`, `BANK_SWIFT_BIC`: Bank wire/ACH details for manual invoice generation
- `SUPERADMIN_EMAILS`: Comma-separated list of admin emails authorized for `/admin/billing`

### 3. Initialize Database
```bash
npx prisma generate
npx prisma db push
# Or run migrations:
npx prisma migrate dev
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ☁️ Deployment

### Cloudflare Pages
PolicyDiff is configured for deployment with Cloudflare Pages:
```bash
# Build using Cloudflare Next-on-Pages adapter:
npm run pages:build

# Deploy to Cloudflare Pages:
npx wrangler pages deploy .vercel/output/static --project-name policydiff
```

### Scheduled Cron Jobs
Run retention and billing lifecycle crons via serverless triggers or Cloudflare Worker Cron Triggers:
- **Billing Lifecycle**: `src/jobs/billing-cron.ts` (`runBillingDailyJob()`)
- **Document Retention Cleanup**: `src/jobs/retention-cleanup.ts` (`runRetentionCleanup()`)

---

## 📜 License

MIT License. See [LICENSE](file:///LICENSE) for details.
