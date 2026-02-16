# AUDIT PHASE 1: ARCHITECTURE & DESIGN AUDIT

**Audit Date:** 2026-02-16
**System:** MetaLIMS / LabFlow LIMS

---

## 1.1 Separation of Concerns

### Assessment: 🟡 MEDIUM — Partial layering with significant gaps

**Positive observations:**
- Monorepo structure cleanly separates concerns: `apps/api`, `apps/web`, `apps/portal`, `apps/workers`, `packages/db`, `packages/shared`
- Shared types, validation schemas, and constants are properly extracted into `@labflow/shared`
- Cross-cutting concerns are mostly abstracted: auth middleware, audit log plugin, rate limiter, error handler, logger with redaction

**Issues found:**

| # | Severity | Finding | File(s) |
|---|----------|---------|---------|
| 1.1-1 | 🟠 HIGH | **Business logic embedded in route handlers.** Route files in `apps/api/src/routes/` contain 300-940 lines of mixed controller + service logic. For example, `invoices/index.ts` (936 lines) contains invoice calculation logic, aging report logic, and auto-generation logic directly in route handlers instead of delegating to services. The `billingService.ts` exists but duplicates some of this logic. | `routes/invoices/index.ts`, `routes/tests/index.ts`, `routes/samples/index.ts` |
| 1.1-2 | 🟡 MEDIUM | **Inconsistent service layer usage.** Some domains use dedicated services (approvalService, workflowEngine, billingService) while others have all logic inline in routes (clients, instruments, storage, specifications, notifications). There's no clear pattern for when to use a service vs inline logic. | Various route files |
| 1.1-3 | 🟡 MEDIUM | **Dual auth implementations.** The auth route (`routes/auth/index.ts`) imports `jsonwebtoken` directly and uses hardcoded secret fallbacks, while the auth plugin (`plugins/auth.ts`) uses `@fastify/jwt`. Two parallel JWT implementations exist for signing tokens. | `routes/auth/index.ts`, `plugins/auth.ts` |
| 1.1-4 | 🟡 MEDIUM | **No repository/data-access layer.** Prisma is called directly from route handlers and services with no abstraction. This tightly couples business logic to Prisma's API and makes testing/mocking harder. | All route and service files |

---

## 1.2 Domain Modeling

### Assessment: 🟡 MEDIUM — Strong model, some gaps

**Positive observations:**
- The Prisma schema accurately models core LIMS concepts: samples, tests, results, batches, instruments, reagents (partially), chain of custody, specifications
- Proper use of Prisma enums for statuses (11 sample statuses, 9 test statuses, 11 order statuses, 10 invoice statuses, etc.)
- Decimal types with appropriate precision for financial data (`Decimal(12,2)`) and lab results (`Decimal(15,6)`)
- Self-referential relationships for aliquots (Sample→parentSample) and storage hierarchy
- Comprehensive specification/limit model with 5 limit types and warning bands

**Issues found:**

| # | Severity | Finding | File(s) |
|---|----------|---------|---------|
| 1.2-1 | 🟠 HIGH | **No reagent/consumable inventory tracking.** The data model has instruments but no reagents, chemicals, or consumable inventory. For a LIMS, tracking reagent lot numbers, expiry dates, and usage per test is essential for traceability. | `schema.prisma` |
| 1.2-2 | 🟡 MEDIUM | **Units of measurement not normalized.** Units are stored as free-text strings (`unit: String`) on TestAnalyte and TestResult. No unit validation, no unit conversion support. Lab results could have inconsistent units (e.g., "mg/L" vs "ppm" vs "mg/l"). | `schema.prisma:423,501` |
| 1.2-3 | 🟡 MEDIUM | **Significant figures not explicitly tracked.** While `decimalPlaces` exists on TestAnalyte, there's no enforcement at the result-entry level. The `roundToDecimalPlaces` utility exists in shared/utils but isn't consistently applied. | `schema.prisma:422`, `calculations.ts` |
| 1.2-4 | 🟡 MEDIUM | **QC requirements are unstructured JSON.** `TestMethod.qcRequirements` is `Json @default("{}")` with no schema validation. There's no model for QC samples (method blanks, duplicates, spikes, reference standards). | `schema.prisma:399` |
| 1.2-5 | 🔵 LOW | **`customFields` on Sample is unstructured.** `Json @default("{}")` with no validation or schema definition. This could accumulate arbitrary data with no type safety. | `schema.prisma:327` |
| 1.2-6 | 🟡 MEDIUM | **Missing instrument-method relationship.** No explicit link between instruments and the test methods they support. An ICP-MS shouldn't be assignable to a microbiology test, but there's no constraint. | `schema.prisma` |

---

## 1.3 Workflow / State Machine

### Assessment: 🟡 MEDIUM — Present but incomplete enforcement

**Positive observations:**
- `workflowEngine.ts` implements a proper state machine with `TransitionRule` arrays for SAMPLE, TEST, ORDER, and INVOICE
- `executeTransition()` performs validation, DB update, and audit log write in a single transaction
- `getAvailableTransitions()` filters by user role
- Shared constants (`SAMPLE_STATUS_TRANSITIONS`, `TEST_STATUS_TRANSITIONS`, etc.) define allowed transitions

**Issues found:**

| # | Severity | Finding | File(s) |
|---|----------|---------|---------|
| 1.3-1 | 🔴 CRITICAL | **Dual state machine definitions.** The `workflowEngine.ts` service defines its own transition rules, AND `@labflow/shared/src/constants/` defines separate `*_STATUS_TRANSITIONS` maps. These are **not synchronized** — they could diverge, leading to the frontend showing transitions the backend rejects or vice versa. | `workflowEngine.ts`, `sampleStatuses.ts`, `testStatuses.ts` |
| 1.3-2 | 🟠 HIGH | **Routes bypass the workflow engine.** Many route handlers update statuses directly via Prisma (`prisma.sample.update({ data: { status: ... } })`) instead of going through `executeTransition()`. For example, `samples/index.ts` receive/store/retrieve/dispose actions update status directly. The workflow engine is available but not consistently used. | `routes/samples/index.ts`, `routes/orders/index.ts`, `routes/tests/index.ts` |
| 1.3-3 | 🟠 HIGH | **No optimistic locking on state transitions.** The `executeTransition()` function reads the current status and then updates within a transaction, but doesn't use `SELECT FOR UPDATE` or a version field check. Two concurrent transitions from the same status could both succeed. Prisma's default transaction isolation may not prevent this. | `workflowEngine.ts` |
| 1.3-4 | 🟡 MEDIUM | **No four-eyes principle enforcement.** While the test model has `assignedToId`, `reviewedById`, and `approvedById` fields, and the `approvalService.ts` checks that reviewer !== analyst and approver !== analyst, there's no DB constraint preventing the same person from being both reviewer and approver. | `approvalService.ts`, `schema.prisma` |
| 1.3-5 | 🟡 MEDIUM | **ON_HOLD can transition to almost any state.** `ON_HOLD` → `RECEIVED`, `IN_STORAGE`, `IN_PROGRESS`, `TESTING_COMPLETE`, `CANCELLED` for samples. This is overly permissive — an on-hold sample could jump backward in the pipeline. | `sampleStatuses.ts` |

---

## 1.4 Configuration & Environment

### Assessment: 🟡 MEDIUM — Mostly externalized with critical fallback issues

**Positive observations:**
- Comprehensive `.env.example` with all required variables documented
- `docker-compose.yml` for local development infrastructure
- Config properly separated by environment (dev vs prod behaviors)
- `setup.sh` script for first-time setup

**Issues found:**

| # | Severity | Finding | File(s) |
|---|----------|---------|---------|
| 1.4-1 | 🔴 CRITICAL | **Hardcoded JWT secret fallbacks in auth route.** `const JWT_SECRET = process.env.JWT_SECRET \|\| 'change-me-in-production'` and `const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET \|\| 'change-me-refresh-in-production'`. If env vars are missing, the API starts with predictable secrets. | `routes/auth/index.ts:7-8` |
| 1.4-2 | 🟠 HIGH | **Cookie secret falls back to JWT_SECRET or hardcoded value.** `secret: process.env.COOKIE_SECRET \|\| process.env.JWT_SECRET \|\| 'labflow-dev-cookie-secret'`. Triple fallback chain can mask missing configuration. | `server.ts:50` |
| 1.4-3 | 🟠 HIGH | **`trustProxy` is always `true`** regardless of the `TRUST_PROXY` env var. `trustProxy: process.env.TRUST_PROXY === 'true' \|\| true` — the `\|\| true` makes the check meaningless. | `server.ts:31` |
| 1.4-4 | 🟡 MEDIUM | **CI uses hardcoded secrets.** `ci.yml` sets `JWT_SECRET: 'ci-test-jwt-secret'`. While acceptable for CI, these should be documented as test-only values. | `.github/workflows/ci.yml:12-14` |
| 1.4-5 | 🟡 MEDIUM | **No staging environment configuration.** `.env.example` exists but there's no `.env.staging` template or environment-specific documentation. The deploy workflow supports staging but doesn't guide configuration. | `.env.example` |

---

## 1.5 Error Handling Strategy

### Assessment: ✅ PASS (with minor issues)

**Positive observations:**
- Custom `AppError` hierarchy with 7 error classes mapping to specific HTTP status codes
- Global error handler in `server.ts` catches AppError, ZodError, Fastify validation errors, Prisma errors (P2002 unique constraint, P2025 not found), and rate limit errors
- Production mode suppresses stack traces and internal error details
- Structured error responses with `statusCode`, `error`, `code`, `message`, and optional `details`
- Audit log plugin silently catches its own errors to never fail the request

**Issues found:**

| # | Severity | Finding | File(s) |
|---|----------|---------|---------|
| 1.5-1 | 🟡 MEDIUM | **Stack trace leak in non-production.** `...(isProduction ? {} : { stack: error.stack })` exposes full stack traces in development/staging. While intentional for dev, staging environments should also suppress this. | `server.ts:255` |
| 1.5-2 | 🟡 MEDIUM | **Prisma error handler only covers P2002 and P2025.** Other common Prisma errors (P2003 foreign key constraint, P2014 relation violation, P2016 query interpretation) fall through to the generic 500 handler. | `server.ts:216-237` |
| 1.5-3 | 🔵 LOW | **Zod errors in route handlers caught inconsistently.** Some routes catch `z.ZodError` manually and format responses; others let it propagate to the global handler. Both paths work but produce slightly different error shapes. | Various route files |

---

## 1.6 Database Design

### Assessment: 🟡 MEDIUM — Solid schema with operational gaps

**Positive observations:**
- Proper use of UUIDs as primary keys
- Unique constraints on business keys (org+code for clients, org+orderNumber, org+sampleNumber, etc.)
- Composite indexes on audit log (`org+entityType+entityId`, `org+createdAt`)
- Index on notifications (`userId+isRead`)
- Foreign key constraints via Prisma relations
- Decimal types for financial and scientific precision
- Soft-delete on User and Client via `deletedAt`
- `@updatedAt` timestamp decorator on all mutable entities

**Issues found:**

| # | Severity | Finding | File(s) |
|---|----------|---------|---------|
| 1.6-1 | 🟠 HIGH | **No database migration files.** The project uses `prisma db push --accept-data-loss` in CI, which is destructive and not suitable for production. The deploy workflow runs `prisma migrate deploy` but no migration files exist. This will fail on first real deployment. | `packages/db/prisma/`, `ci.yml` |
| 1.6-2 | 🟠 HIGH | **Missing indexes on common query patterns.** No index on `samples.orderId`, `tests.sampleId`, `tests.assignedToId`, `tests.status`, `orders.clientId`, `orders.status`, `invoices.clientId`, `invoices.status`, `payments.invoiceId`. These will cause full table scans on common queries. | `schema.prisma` |
| 1.6-3 | 🟠 HIGH | **No soft-delete on regulatory data.** Samples, Tests, TestResults, Orders — these must never be physically deleted in a regulated lab. Only User and Client have soft-delete. The client route has a "delete" endpoint that sets `deletedAt`, but sample/test/order routes have no delete protection documented. | `schema.prisma` |
| 1.6-4 | 🟡 MEDIUM | **No optimistic locking fields.** No `version` or `updatedAt`-based concurrency check on any model. Concurrent edits will silently overwrite each other. | `schema.prisma` |
| 1.6-5 | 🟡 MEDIUM | **AuditLog has no immutability constraint.** While the model lacks `@updatedAt`, there's no database-level protection against UPDATE or DELETE on audit_logs. A compromised application could modify audit records. | `schema.prisma:945-963` |
| 1.6-6 | 🟡 MEDIUM | **Timestamps not explicitly UTC.** Prisma uses `@default(now())` which defaults to the database timezone. If the database isn't configured for UTC, timestamps will be in local time. No `@db.Timestamptz` annotation used. | `schema.prisma` |
| 1.6-7 | 🟡 MEDIUM | **`Sequence` table for ID generation uses no row-level locking.** Concurrent requests could generate duplicate IDs if the sequence read-increment-write isn't atomic. | `schema.prisma:14-22`, seed.ts |
| 1.6-8 | 🔵 LOW | **No cascading delete rules defined.** Prisma defaults to `Restrict` on foreign keys. Deleting an Order with Samples will throw a constraint error rather than cascading or blocking explicitly. Acceptable for LIMS but should be documented. | `schema.prisma` |

---

## Phase 1 Summary

| Rating | Count |
|--------|-------|
| 🔴 CRITICAL | 2 |
| 🟠 HIGH | 8 |
| 🟡 MEDIUM | 14 |
| 🔵 LOW | 3 |
| ✅ PASS | 1 (Error Handling) |

**Most critical architectural issues:**
1. Routes not registered in server.ts (from Phase 0)
2. Hardcoded JWT secret fallbacks
3. Dual state machine definitions that can diverge
4. No database migration files
5. Routes bypassing the workflow engine for state transitions
