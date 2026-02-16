# AUDIT PHASE 3: CODE QUALITY & ROBUSTNESS AUDIT

**Audit Date:** 2026-02-16
**System:** MetaLIMS / LabFlow LIMS

---

## 3.1 Error Handling (Deep Dive)

### Assessment: 🟡 MEDIUM — Framework good, application inconsistent

| # | Severity | Finding | File(s) | Detail |
|---|----------|---------|---------|--------|
| 3.1-1 | 🟠 HIGH | **External service calls lack timeout/retry** | `routes/auth/index.ts`, `services/stripeService.ts`, `processors/*.ts` | Stripe API calls, email sending via nodemailer, and QuickBooks sync have no explicit timeout configuration. If Stripe's API hangs, the request will hang indefinitely. Worker processors have BullMQ retry configuration but individual HTTP calls don't set timeouts. |
| 3.1-2 | 🟡 MEDIUM | **Inconsistent error handling in route handlers** | Various routes | Some routes wrap all logic in try/catch and format errors, others let exceptions propagate to the global handler. Both work, but the inconsistency means error response shapes can differ. Example: `audit/index.ts` catches ZodError manually (line ~85), while `samples/index.ts` lets Zod errors propagate. |
| 3.1-3 | 🟡 MEDIUM | **Audit log write is fire-and-forget in onResponse** | `middleware/auditLog.ts:199-267` | The audit log is written in the `onResponse` hook, which runs after the response is sent. This is good for latency but means audit failures are silently swallowed (caught at line 259). If the database is down, mutations succeed but are not audited. |
| 3.1-4 | 🟡 MEDIUM | **No custom error types for domain errors** | `utils/errors.ts` | The error hierarchy covers HTTP semantics (404, 401, 403, 400, 409, 429, 500) but not domain errors. There's no `InvalidStateTransitionError`, `InsufficientInventoryError`, or `SpecificationViolationError`. Domain errors are mapped to generic `ConflictError` or `ValidationError`. |
| 3.1-5 | 🔵 LOW | **Logger context sometimes insufficient** | Various | Some error catches log only the error object without request context (user ID, entity ID, operation). The Pino logger adds request ID automatically, but service-layer errors don't have this context. |

---

## 3.2 Edge Cases

### Assessment: 🟠 HIGH — Many unhandled scenarios

| # | Severity | Finding | File(s) | Detail |
|---|----------|---------|---------|--------|
| 3.2-1 | 🔴 CRITICAL | **Race condition in sequence ID generation** | `packages/shared/src/utils/idGenerator.ts`, seed.ts | The `Sequence` table tracks current ID counters per entity type. The code that generates the next ID (read → increment → write) is not wrapped in a transaction with a row lock. Two concurrent sample registrations could get the same sample number. The `@@unique([organizationId, entityType, year])` constraint would catch a collision on the Sequence row itself, but the actual generated ID (e.g., "SMP-2025-0042") would not have a unique constraint violation until the entity is created. |
| 3.2-2 | 🟠 HIGH | **Concurrent state transitions not protected** | `workflowEngine.ts` | `executeTransition()` uses a Prisma transaction, but default Prisma transactions use `READ COMMITTED` isolation. Two concurrent requests to transition a sample from `RECEIVED` to `IN_PROGRESS` could both read the current status as `RECEIVED`, both validate the transition, and both attempt the update. Without `SELECT FOR UPDATE` (Prisma's interactive transactions with `$queryRaw` or `@prisma/extension-accelerate`), this is a race condition. |
| 3.2-3 | 🟠 HIGH | **Double-submission of results** | `routes/tests/index.ts` | The `POST /:id/results` endpoint creates test results without checking for duplicates. Submitting results twice for the same analyte on the same test would create duplicate records. There's no unique constraint on `(testId, analyteId)` in the `test_results` table. |
| 3.2-4 | 🟠 HIGH | **Invoice auto-generation race** | `routes/invoices/index.ts` | The `POST /auto-generate` endpoint finds approved tests and creates invoices. If triggered twice quickly (double-click), it could generate duplicate invoices for the same tests. No idempotency key or "already invoiced" flag. |
| 3.2-5 | 🟡 MEDIUM | **Empty results on test completion** | `routes/tests/index.ts` | The `POST /:id/complete` endpoint doesn't verify that results exist for all required analytes. A test can be "completed" with zero results entered, which would then pass through review and approval without any data. |
| 3.2-6 | 🟡 MEDIUM | **Aliquot quantity not validated** | `routes/samples/index.ts` | Creating aliquots doesn't verify that the sum of aliquot quantities doesn't exceed the parent sample's quantity. Creating 10 aliquots of 100mL from a 50mL parent sample would be accepted. |
| 3.2-7 | 🟡 MEDIUM | **Storage location capacity not enforced** | `routes/samples/index.ts`, `schema.prisma:680` | `StorageLocation.capacity` and `currentCount` exist but are never checked when storing a sample. A refrigerator with capacity 100 and currentCount 100 would still accept new samples. |
| 3.2-8 | 🟡 MEDIUM | **Null-safe handling inconsistent** | Various routes | Some routes check for nullable fields before accessing them, others don't. For example, `sample.createdBy?.firstName` vs `sample.createdBy.firstName` — the latter will throw if createdBy is null. |
| 3.2-9 | 🔵 LOW | **Extremely long strings not bounded** | `schema.prisma` | Most `String` fields have no length constraint in the schema. Prisma maps these to PostgreSQL `text` type (unlimited length). A malicious user could submit a 10MB "notes" field. Zod schemas in `@labflow/shared` do add `.max()` bounds, but these schemas aren't consistently used by routes. |

---

## 3.3 Data Integrity

### Assessment: 🟡 MEDIUM — Core calculations present, precision concerns

| # | Severity | Finding | File(s) | Detail |
|---|----------|---------|---------|--------|
| 3.3-1 | 🟡 MEDIUM | **JavaScript floating-point used for calculations** | `packages/shared/src/utils/calculations.ts` | `calculateRecovery`, `calculateRPD`, `calculateRSD`, `calculateMean`, `calculateStdDev` all use JavaScript `number` type (IEEE 754 float64). While the database stores values as `Decimal(15,6)`, calculations on the application side lose precision. Example: `0.1 + 0.2 !== 0.3` in JavaScript. The `roundToDecimalPlaces` function exists but is applied after the precision loss. |
| 3.3-2 | 🟡 MEDIUM | **Invoice calculation uses JavaScript arithmetic** | `packages/shared/src/utils/calculations.ts` | `calculateLineItemTotal` and `calculateInvoiceTotals` use `quantity * unitPrice - discount` with JavaScript floats. For financial calculations, a `Decimal` library (like `decimal.js` or `big.js`) should be used to avoid cent-rounding errors. |
| 3.3-3 | 🟡 MEDIUM | **Rounding rules not configurable** | `calculations.ts` | `roundToDecimalPlaces` uses `Math.round(value * factor) / factor` — standard "round half to even" is not used. Scientific rounding (banker's rounding) is required for some regulatory contexts. No configuration for rounding mode. |
| 3.3-4 | 🟡 MEDIUM | **Specification evaluation uses client-side logic** | `calculations.ts` | `evaluateSpecLimit` compares a numeric value against specification limits to determine PASS/FAIL/WARNING. This logic runs on the application server and is not enforced at the database level. A direct database modification could bypass spec checking. |
| 3.3-5 | 🔵 LOW | **No derived-field recomputation** | Various | If a test result is modified after initial entry, the test's `overallResult` is not automatically recomputed. If spec limits are changed after results are evaluated, existing pass/fail statuses are not recalculated. |
| 3.3-6 | 🟡 MEDIUM | **Missing `TestResult` uniqueness constraint** | `schema.prisma:494-522` | No `@@unique([testId, analyteId])` on `TestResult`. Multiple results for the same analyte on the same test can exist, leading to ambiguity about which is the "current" result. |

---

## 3.4 Performance Concerns

### Assessment: 🟡 MEDIUM — Several N+1 patterns

| # | Severity | Finding | File(s) | Detail |
|---|----------|---------|---------|--------|
| 3.4-1 | 🟠 HIGH | **N+1 query patterns in dashboard** | `routes/dashboard/index.ts` | Dashboard endpoints execute multiple independent queries sequentially. The `/kpis` endpoint runs ~6 separate Prisma `count()` and `aggregate()` calls. While parallel execution via `Promise.all` is used, each KPI query is a full table scan due to missing indexes. |
| 3.4-2 | 🟠 HIGH | **Missing indexes cause full table scans** | `schema.prisma` | Common query patterns scan without index: `tests WHERE sampleId = ?`, `samples WHERE orderId = ?`, `orders WHERE clientId = ? AND status = ?`, `invoices WHERE clientId = ? AND status = ?`. Every list endpoint will perform full table scans as data grows. |
| 3.4-3 | 🟡 MEDIUM | **Unbounded `include` in detail queries** | Various routes | Sample detail query includes `tests → testMethod → analytes`, `tests → results`, `chainOfCustody`. If a sample has hundreds of tests each with dozens of results, this becomes a very large response. No pagination on nested relations. |
| 3.4-4 | 🟡 MEDIUM | **Audit log distinct queries are expensive** | `routes/audit/index.ts` | The audit list endpoint runs two `findMany({ distinct: [...] })` queries to populate filter dropdowns on every request. These should be cached or computed separately. |
| 3.4-5 | 🟡 MEDIUM | **SLA processor scans all active orders** | `processors/slaProcessor.ts` | Every 15 minutes, the SLA cron job loads all orders with status `IN_PROGRESS`, `RECEIVED`, or `TESTING_COMPLETE` and calculates SLA for each. At scale (thousands of active orders), this becomes a significant load. |
| 3.4-6 | 🔵 LOW | **Batch label rendering is O(n) PDF generations** | `packages/report-engine/src/renderer.ts` | `renderBatchLabels` generates individual PDFs for each label and concatenates buffers. This doesn't produce a valid multi-page PDF — it produces corrupted output. At scale, it's also slow. |
| 3.4-7 | 🟡 MEDIUM | **Database connection pooling relies on defaults** | `packages/db/src/client.ts` | No explicit connection pool configuration. Prisma defaults to `connection_limit = num_cpus * 2 + 1`. Under load, this may be insufficient. No connection timeout configured. |

---

## 3.5 Code Hygiene

### Assessment: 🟡 MEDIUM — Mostly clean with notable gaps

| # | Severity | Finding | File(s) | Detail |
|---|----------|---------|---------|--------|
| 3.5-1 | 🟠 HIGH | **Dead code: all route registrations commented out** | `server.ts:143-153` | The most significant dead code in the codebase. 19 route modules are fully implemented but never loaded. |
| 3.5-2 | 🟡 MEDIUM | **TODO/placeholder patterns** | `server.ts:143`, `deploy.yml` | Server has "Placeholder" comments where routes should be registered. Deploy workflow has stub deployment steps with "Replace this step" comments. |
| 3.5-3 | 🟡 MEDIUM | **Duplicate logic between routes and services** | `routes/invoices/index.ts` vs `services/billingService.ts` | Invoice creation, line-item calculation, aging report, and overdue detection logic exists in both the route handler and the billing service. The two implementations may diverge over time. |
| 3.5-4 | 🟡 MEDIUM | **Inconsistent import patterns** | Various | Some files use `import { prisma } from '@labflow/db'`, others `import { prisma } from '../../packages/db'`, and some service files import Prisma types differently. |
| 3.5-5 | 🟡 MEDIUM | **No linting configuration** | Root directory | No `.eslintrc`, `.eslintignore`, or ESLint package in dependencies. The Turborepo pipeline has a `lint` task, but no linter is configured. `pnpm lint` would likely fail or do nothing. |
| 3.5-6 | 🔵 LOW | **Magic numbers** | Various | Rush surcharge percentages, SLA thresholds (50%, 75%, 90%, 100%), rate limit values, and pagination defaults are hardcoded in various files. Most are sensible but should be centralized as constants. |
| 3.5-7 | 🔵 LOW | **Consistent code style** | All files | Code style is remarkably consistent for zero-shot generation — consistent use of `async/await`, proper TypeScript typing, consistent naming conventions (camelCase for variables, PascalCase for types/interfaces). Prettier is configured at root. |

---

## Phase 3 Summary

| Rating | Count |
|--------|-------|
| 🔴 CRITICAL | 1 |
| 🟠 HIGH | 7 |
| 🟡 MEDIUM | 17 |
| 🔵 LOW | 5 |

**Most critical code quality issues:**
1. Race condition in sequence ID generation — potential duplicate IDs
2. Concurrent state transitions unprotected — data corruption risk
3. Double-submission creates duplicate test results and invoices
4. JavaScript floating-point arithmetic for financial and scientific calculations
5. Missing database indexes will cause severe performance degradation at scale
