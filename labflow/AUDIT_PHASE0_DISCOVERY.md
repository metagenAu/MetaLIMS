# AUDIT PHASE 0: DISCOVERY & INVENTORY

**Audit Date:** 2026-02-16
**Auditor:** Senior Software Architect & Security Auditor
**System:** MetaLIMS / LabFlow — Laboratory Information Management System
**Repository:** metagenAu/MetaLIMS

---

## 1. Project Structure

```
MetaLIMS/
├── LICENSE (MIT)
└── labflow/                              # Monorepo root
    ├── .env.example                      # Environment variable template
    ├── .gitignore
    ├── .github/workflows/
    │   ├── ci.yml                        # CI: install → lint → type-check → test → build
    │   └── deploy.yml                    # Deploy: build → migrate → deploy (stub)
    ├── docker-compose.yml                # Dev infra: Postgres, Redis, MinIO, Mailhog
    ├── package.json                      # Workspace root
    ├── tsconfig.json                     # Root TypeScript config
    ├── turbo.json                        # Turborepo pipeline
    ├── apps/
    │   ├── api/                          # Fastify REST API (port 4000)
    │   │   ├── src/
    │   │   │   ├── server.ts             # Main entry point
    │   │   │   ├── middleware/
    │   │   │   │   ├── auth.ts           # JWT verification, RBAC, role hierarchy
    │   │   │   │   ├── auditLog.ts       # Automatic audit trail on mutations
    │   │   │   │   └── rateLimiter.ts    # @fastify/rate-limit wrapper
    │   │   │   ├── plugins/
    │   │   │   │   ├── auth.ts           # @fastify/jwt registration
    │   │   │   │   └── cors.ts           # @fastify/cors configuration
    │   │   │   ├── routes/               # 19 route modules
    │   │   │   │   ├── audit/index.ts
    │   │   │   │   ├── auth/index.ts
    │   │   │   │   ├── clients/index.ts
    │   │   │   │   ├── dashboard/index.ts
    │   │   │   │   ├── instruments/index.ts
    │   │   │   │   ├── invoices/index.ts
    │   │   │   │   ├── notifications/index.ts
    │   │   │   │   ├── orders/index.ts
    │   │   │   │   ├── payments/index.ts
    │   │   │   │   ├── priceLists/index.ts
    │   │   │   │   ├── projects/index.ts
    │   │   │   │   ├── reports/index.ts
    │   │   │   │   ├── samples/index.ts
    │   │   │   │   ├── specifications/index.ts
    │   │   │   │   ├── storage/index.ts
    │   │   │   │   ├── testMethods/index.ts
    │   │   │   │   ├── tests/index.ts
    │   │   │   │   ├── users/index.ts
    │   │   │   │   └── webhooks/index.ts
    │   │   │   ├── services/             # 9 service modules
    │   │   │   │   ├── approvalService.ts
    │   │   │   │   ├── billingService.ts
    │   │   │   │   ├── notificationService.ts
    │   │   │   │   ├── pricingService.ts
    │   │   │   │   ├── reportService.ts
    │   │   │   │   ├── sampleService.ts
    │   │   │   │   ├── slaService.ts
    │   │   │   │   ├── stripeService.ts
    │   │   │   │   └── workflowEngine.ts
    │   │   │   └── utils/
    │   │   │       ├── errors.ts          # Custom error classes
    │   │   │       ├── logger.ts          # Pino logger with redaction
    │   │   │       └── pagination.ts      # Offset & cursor pagination
    │   │   ├── package.json
    │   │   └── tsconfig.json
    │   ├── web/                           # Internal staff Next.js app (port 3000)
    │   │   └── src/
    │   │       ├── app/                   # 30+ pages (App Router)
    │   │       ├── components/            # 25+ React components
    │   │       ├── hooks/                 # useApi, useRBAC, useSamples, etc.
    │   │       └── lib/                   # api client, auth (NextAuth), formatters
    │   ├── portal/                        # Client portal Next.js app (port 3001)
    │   │   └── src/
    │   │       ├── app/                   # 15+ pages
    │   │       ├── components/            # Portal-specific components
    │   │       └── hooks/                 # usePortalApi, usePortalAuth
    │   └── workers/                       # BullMQ background workers
    │       └── src/
    │           ├── index.ts               # Worker bootstrap
    │           ├── processors/            # 5 job processors
    │           │   ├── accountingSyncProcessor.ts
    │           │   ├── emailProcessor.ts
    │           │   ├── invoiceProcessor.ts
    │           │   ├── reportProcessor.ts
    │           │   └── slaProcessor.ts
    │           └── queues/                # 5 queue definitions
    │               ├── accountingSyncQueue.ts
    │               ├── emailQueue.ts
    │               ├── invoiceQueue.ts
    │               ├── reportQueue.ts
    │               └── slaQueue.ts
    ├── packages/
    │   ├── db/                            # Prisma ORM package
    │   │   ├── prisma/
    │   │   │   ├── schema.prisma          # 30+ models, sole schema source
    │   │   │   └── seed.ts                # Comprehensive demo data seed
    │   │   └── src/client.ts              # PrismaClient singleton
    │   ├── shared/                        # Shared types, constants, validation, utils
    │   │   └── src/
    │   │       ├── constants/             # Roles, sample/test/invoice statuses, transitions
    │   │       ├── types/                 # TypeScript interfaces for all domain entities
    │   │       ├── utils/                 # Calculations, ID generation, SLA helpers
    │   │       └── validation/            # Zod schemas for all inputs
    │   ├── email-templates/               # React Email templates (6 templates)
    │   └── report-engine/                 # React-PDF report renderer
    │       └── src/templates/             # CoA, Invoice, Chain of Custody, Sample Label
    └── scripts/
        ├── setup.sh                       # First-time dev setup script
        ├── migrate.ts                     # Migration wrapper
        └── seed.ts                        # Seed wrapper
```

---

## 2. Technology Stack

| Layer | Technology | Version |
|---|---|---|
| **Language** | TypeScript (strict mode) | ^5.5.0 |
| **Runtime** | Node.js | >= 20 |
| **Package Manager** | pnpm | 9.12.0 |
| **Monorepo** | Turborepo | ^2.1.0 |
| **API Framework** | Fastify | ^4.28.0 |
| **Frontend Framework** | Next.js (App Router) | 14.1.0 |
| **UI Library** | React | ^18.2.0 / ^18.3.1 |
| **ORM** | Prisma | ^5.19.0 |
| **Database** | PostgreSQL | 16 (Alpine Docker) |
| **Cache/Queue Broker** | Redis | 7 (Alpine Docker) |
| **Background Jobs** | BullMQ | ^5.12.0 |
| **Auth (API)** | @fastify/jwt (HS256) + bcryptjs | ^8.0.1 / ^2.4.3 |
| **Auth (Web)** | NextAuth.js (Credentials, JWT strategy) | ^4.24.5 |
| **Validation** | Zod | ^3.23.0 |
| **Payments** | Stripe | ^16.8.0 |
| **Email** | Nodemailer + Mailhog (dev) | ^6.9.14 |
| **Email Templates** | @react-email/components | ^0.0.22 |
| **PDF Generation** | @react-pdf/renderer | ^3.4.4 |
| **Barcode** | bwip-js | ^4.3.0 |
| **Object Storage** | MinIO (S3-compatible) | latest |
| **CSS** | Tailwind CSS | ^3.4.1 |
| **UI Primitives** | Radix UI | Various ^1.x/^2.x |
| **Data Fetching (FE)** | TanStack React Query | ^5.17.19 |
| **Forms** | react-hook-form + @hookform/resolvers | ^7.49.3 / ^3.3.4 |
| **Charts** | Recharts | ^2.12.0 |
| **Logging** | Pino + pino-pretty | ^9.3.0 / ^11.2.0 |
| **Test Framework** | Vitest (configured, no tests written) | ^2.0.0 |
| **CI/CD** | GitHub Actions | N/A |
| **Containerization** | Docker Compose (dev infra only) | v3.8 |

---

## 3. External Dependencies Audit

### Dependency Risk Assessment

| Package | Version | Risk | Notes |
|---|---|---|---|
| `@react-email/components` | ^0.0.22 | 🟠 **Pre-1.0** | Pre-release; API may break. Monitor for stability. |
| `bcryptjs` | ^2.4.3 | 🟡 | Pure JS bcrypt; adequate but slower than native `bcrypt`. Salt rounds need verification. |
| `next-auth` | ^4.24.5 | 🟡 | v4 is stable but Auth.js v5 is successor. Migration may be needed. |
| `next` | 14.1.0 | 🟡 | Next.js 14.1 is recent enough; App Router is stable. |
| `mailhog` | latest | 🔵 | Dev-only SMTP trap. No production concern. |
| `minio` | latest | 🔵 | Docker tag `latest` is non-deterministic. Should pin version. |
| All others | Various ^x.y | ✅ | Reasonable, actively maintained packages. No known CVEs at audit time. |

### Missing `pnpm-lock.yaml` at Root
- The root `labflow/` directory has no `pnpm-lock.yaml`. Only `packages/shared/pnpm-lock.yaml` exists.
- **Impact:** Non-reproducible builds in CI. `pnpm install --frozen-lockfile` in CI will fail or use unpinned versions.
- **Severity:** 🟠 HIGH

---

## 4. Data Model (Entity-Relationship Summary)

### Core Entities (30+ models)

```
Organization (tenant root)
  ├── User (12 roles, soft-delete, MFA fields)
  ├── Client (5 types, payment terms, Stripe customer)
  │   ├── ClientContact (portal users, notification subscriptions)
  │   ├── Project (default test methods)
  │   └── Order (11 statuses, rush, shipping)
  │       ├── Sample (unique barcode, aliquot hierarchy, CoC)
  │       │   ├── Test (3-level approval: analyst→reviewer→approver)
  │       │   │   ├── TestResult (raw/final/numeric, dilution, RPD, recovery)
  │       │   │   └── ApprovalAction (7 action types)
  │       │   └── ChainOfCustodyEntry (temperature, signature)
  │       └── InvoiceLineItem
  │           └── Invoice (10 statuses, Stripe/QB IDs)
  │               ├── Payment (7 methods, 7 statuses, Stripe)
  │               └── CreditNote
  ├── TestMethod (QC requirements, accreditation scope)
  │   ├── TestAnalyte (reporting limit, decimal places)
  │   └── Specification (regulatory body, effective dates)
  │       └── SpecificationLimit (5 limit types, warning bands)
  ├── PriceList (volume tiers, rush surcharge)
  │   └── PriceListItem (unit price, minimum charge)
  ├── Instrument (calibration tracking, 4 calibration statuses)
  ├── StorageLocation (hierarchical, temperature, capacity)
  ├── WorkflowConfig (JSON workflow steps)
  ├── ReportTemplate (header/footer HTML, JSON body)
  ├── Report (5 types, versioning, amendment tracking)
  ├── AuditLog (indexed by org+entity+type and org+date)
  └── Notification (multi-channel, read tracking)

Sequence (human-readable ID counters per org/entity-type/year)
```

### Key Relationships
- **Multi-tenant:** All major entities scoped to `organizationId`
- **Self-referential:** Sample→parentSample (aliquots), StorageLocation→parentLocation
- **Soft-delete:** User, Client (via `deletedAt`)
- **Three-level approval chain:** Test has analyst, reviewer, approver (separate User FKs)
- **Financial chain:** Order→InvoiceLineItem→Invoice→Payment, with CreditNote

### Decimal Precision
- **Financial:** `Decimal(12, 2)` for prices, totals, balances
- **Lab results:** `Decimal(15, 6)` for analyte values, spec limits
- **Percentages:** `Decimal(5, 2)` for surcharges, `Decimal(8, 4)` for recovery/RPD
- **Physical:** `Decimal(5, 2)` for temperature, `Decimal(10, 2)` for quantity

---

## 5. API Endpoints Inventory

### 🔴 CRITICAL: Routes Are NOT Registered

**The `server.ts` file has all route registrations commented out (lines 143-153).** The v1Routes function body contains only placeholder comments. This means **the API is completely non-functional** — no routes are reachable despite 19 fully-implemented route modules existing in the codebase.

### Route Modules (as implemented but not mounted)

| Module | Prefix | Methods | Auth Required | Key Operations |
|---|---|---|---|---|
| **auth** | `/auth` | POST x5 | Partial | login, refresh, logout, forgot-password, reset-password |
| **samples** | `/samples` | GET x4, POST x5, PATCH x1 | Yes | CRUD, receive, store, retrieve, dispose, aliquot, CoC, label, scan |
| **tests** | `/tests` | GET x2, POST x7, PATCH x2 | Yes | CRUD, start, results, complete, review, approve, reject, worklist, batch-assign |
| **orders** | `/orders` | GET x3, POST x4, PATCH x1 | Yes | CRUD, receive, submit, hold, cancel, timeline |
| **clients** | `/clients` | GET x5, POST x2, PATCH x2, DELETE x1 | Yes | CRUD, contacts, orders, invoices |
| **invoices** | `/invoices` | GET x4, POST x5, PATCH x1 | Yes | CRUD, auto-generate, approve, send, void, PDF, credit-note, aging, overdue |
| **payments** | `/payments` | GET x2, POST x3 | Yes | CRUD, refund, Stripe intent, Stripe webhook |
| **reports** | `/reports` | GET x3, POST x4 | Yes | list, generate, approve, send, amend, PDF |
| **users** | `/users` | GET x1, POST x2, PATCH x1 | Admin | CRUD, deactivate |
| **instruments** | `/instruments` | GET x2, POST x2, PATCH x1 | Yes | CRUD, calibrate, due-calibration |
| **specifications** | `/specs` | GET x2, POST x2, PATCH x1 | Admin | CRUD, limits |
| **testMethods** | `/test-methods` | GET x2, POST x2, PATCH x2 | Yes | CRUD, analytes |
| **storage** | `/storage` | GET x3, POST x1, PATCH x1 | Yes | CRUD, samples-at-location, map |
| **priceLists** | `/price-lists` | GET x3, POST x2, PATCH x1 | Yes | CRUD, items, calculate |
| **projects** | `/projects` | GET x1, POST x1, PATCH x1 | Yes | CRUD (nested under clients) |
| **dashboard** | `/dashboard` | GET x6 | Yes | KPIs, turnaround, volume, revenue, pending-actions, analyst-workload |
| **notifications** | `/notifications` | GET x1, PATCH x1, POST x1 | Yes | list, mark-read, mark-all-read |
| **audit** | `/audit` | GET x1 | Admin | search/filter audit logs |
| **webhooks** | `/webhooks` | POST x1 | No (Stripe sig) | Stripe webhook handler |

### Portal API (Referenced by Frontend but Missing from API)
The portal frontend (`apps/portal`) calls `/api/portal/*` endpoints that do not exist in the API codebase:
- `/api/portal/auth/login`
- `/api/portal/auth/register`
- `/api/portal/orders`, `/api/portal/samples`, `/api/portal/reports`
- `/api/portal/invoices`, `/api/portal/dashboard`
- `/api/portal/account/profile`, `/api/portal/account/team`
- `/api/portal/support`

**These portal-specific routes are completely unimplemented.**

---

## 6. Test Files Inventory

**🔴 CRITICAL: Zero test files exist.** Vitest 2.0 is declared as a devDependency and the CI pipeline runs `pnpm test`, but no `*.test.ts` or `*.spec.ts` files have been authored. The test infrastructure (CI service containers for Postgres and Redis) was configured but never used.

---

## 7. Seed Data

The seed file (`packages/db/prisma/seed.ts`, ~1,537 lines) creates:
- 1 Organization, 7 Users (all with password `password123`)
- 5 Instruments, 4 Storage Locations
- 10 Test Methods with ~37 Analytes
- 6 Specifications with limits
- 1 Price List with 10 items
- 5 Clients, 20 Orders, ~35 Samples, Tests with Results
- 10 Invoices with Payments
- 5 Sequence counters

---

## Summary of Phase 0 Findings

| # | Severity | Finding |
|---|----------|---------|
| P0-1 | 🔴 CRITICAL | All API routes are commented out in `server.ts` — API is non-functional |
| P0-2 | 🔴 CRITICAL | Zero test files exist despite test infrastructure being configured |
| P0-3 | 🔴 CRITICAL | Portal API endpoints (`/api/portal/*`) referenced by frontend are completely unimplemented |
| P0-4 | 🟠 HIGH | No `pnpm-lock.yaml` at workspace root — non-reproducible builds |
| P0-5 | 🟠 HIGH | No Prisma migration files — only `schema.prisma` with `db push` workflow |
| P0-6 | 🟡 MEDIUM | MinIO Docker image uses `latest` tag — non-deterministic |
| P0-7 | 🟡 MEDIUM | `@react-email/components` is pre-1.0 (0.0.22) — API stability risk |
