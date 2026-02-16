# AUDIT FINAL REPORT: MetaLIMS / LabFlow LIMS

**Audit Date:** 2026-02-16
**Auditor:** Senior Software Architect & Security Auditor
**System:** MetaLIMS / LabFlow — Laboratory Information Management System
**Generation Method:** Zero-shot (single session)

---

## Executive Summary

### Overall System Maturity Rating: 3/10

This LIMS codebase demonstrates impressive architectural ambition and domain knowledge for a zero-shot implementation. The data model is well-designed, the code is consistently styled, and the choice of technologies is appropriate. However, the system has **critical structural defects** that prevent it from functioning as an application, let alone as a production LIMS.

### Findings by Severity

| Severity | Count | Description |
|----------|-------|-------------|
| 🔴 CRITICAL | **12** | System-breaking or security-critical issues |
| 🟠 HIGH | **31** | Significant issues that must be fixed before any use |
| 🟡 MEDIUM | **55** | Important issues for production readiness |
| 🔵 LOW | **12** | Minor improvements and best practices |
| ✅ PASS | **7** | Areas meeting or exceeding expectations |

### Top 5 Risks (Must Address Before ANY Use)

1. **🔴 API is non-functional** — All 19 route modules are implemented but never registered in `server.ts`. The API returns 404 on every route.
2. **🔴 Zero test coverage** — Not a single test file exists. No confidence in any behavior.
3. **🔴 Hardcoded JWT secrets** — Fallback values (`'change-me-in-production'`) enable token forgery if env vars are missing.
4. **🔴 Frontend RBAC is broken** — Role names in `useRBAC.ts` don't match backend role names. Authorization UI is non-functional.
5. **🔴 Regulatory non-compliance** — Audit trail is deletable, no electronic signatures per 21 CFR Part 11, no change control.

### Overall Assessment

**Is this system safe to use for managing real laboratory data?**

**No.** In its current state, the system cannot start, cannot authenticate users, cannot process requests, has no tests, and does not meet regulatory requirements. It is a well-architected prototype that requires substantial completion before it can manage real laboratory data.

---

## Findings Table

| # | Phase | Severity | Finding | File(s) | Recommendation | Effort |
|---|-------|----------|---------|---------|----------------|--------|
| 1 | P0 | 🔴 CRITICAL | All API routes commented out — API non-functional | `server.ts:143-153` | Uncomment and register all route modules | 30min |
| 2 | P0 | 🔴 CRITICAL | Zero test files exist | Entire codebase | Write comprehensive test suite (see Phase 4) | 2-4 weeks |
| 3 | P0 | 🔴 CRITICAL | Portal API endpoints unimplemented | N/A | Implement `/api/portal/*` routes or separate portal API | 1-2 weeks |
| 4 | P1 | 🔴 CRITICAL | Dual state machine definitions can diverge | `workflowEngine.ts`, `shared/constants/*.ts` | Single source of truth — shared constants imported by workflow engine | 4hr |
| 5 | P1 | 🔴 CRITICAL | Hardcoded JWT secret fallbacks | `routes/auth/index.ts:7-8` | Remove fallbacks, throw on missing env vars (like `plugins/auth.ts` does) | 15min |
| 6 | P2 | 🔴 CRITICAL | Dual JWT implementations with different claim formats | `routes/auth/index.ts`, `plugins/auth.ts` | Consolidate to single JWT implementation using `@fastify/jwt` | 2hr |
| 7 | P2 | 🔴 CRITICAL | Frontend RBAC uses wrong role names | `apps/web/src/hooks/useRBAC.ts` | Import role definitions from `@labflow/shared/constants/roles` | 1hr |
| 8 | P2 | 🔴 CRITICAL | Audit trail records can be deleted/modified | `schema.prisma:945-963` | Add DB trigger to prevent UPDATE/DELETE on audit_logs | 2hr |
| 9 | P2 | 🔴 CRITICAL | No electronic signatures per 21 CFR Part 11 | `schema.prisma`, `approvalService.ts` | Implement re-auth at signing, mandatory meaning, non-repudiation | 1 week |
| 10 | P2 | 🔴 CRITICAL | Audit trail incomplete — no old/new values in most cases | `middleware/auditLog.ts` | All route handlers must set `request.auditContext` with before/after state | 1 week |
| 11 | P5 | 🔴 CRITICAL | No production Dockerfile | N/A | Create multi-stage Dockerfile for API, web, portal, workers | 4hr |
| 12 | P5 | 🔴 CRITICAL | No database backup strategy | N/A | Implement automated pg_dump, test restore procedure | 4hr |
| 13 | P0 | 🟠 HIGH | No pnpm-lock.yaml at workspace root | Root dir | Run `pnpm install` to generate lock file, commit it | 15min |
| 14 | P0 | 🟠 HIGH | No Prisma migration files | `packages/db/prisma/` | Run `prisma migrate dev` to create initial migration | 1hr |
| 15 | P1 | 🟠 HIGH | Business logic embedded in route handlers | Various routes | Extract to service layer, routes should be thin controllers | 1-2 weeks |
| 16 | P1 | 🟠 HIGH | Routes bypass workflow engine for state transitions | Various routes | All status changes must go through `executeTransition()` | 1 week |
| 17 | P1 | 🟠 HIGH | No optimistic locking on state transitions | `workflowEngine.ts` | Add `version` field and check in transactions | 4hr |
| 18 | P1 | 🟠 HIGH | Missing database indexes | `schema.prisma` | Add indexes on FK columns and common filter/sort fields | 2hr |
| 19 | P1 | 🟠 HIGH | No soft-delete on regulatory data (Samples, Tests, Orders) | `schema.prisma` | Add `deletedAt` fields, never physically delete regulatory data | 4hr |
| 20 | P1 | 🟠 HIGH | `trustProxy` always true regardless of env var | `server.ts:31` | Fix: `trustProxy: process.env.TRUST_PROXY === 'true'` | 5min |
| 21 | P1 | 🟠 HIGH | Cookie secret fallback chain | `server.ts:50` | Require explicit `COOKIE_SECRET` env var | 10min |
| 22 | P1 | 🟠 HIGH | No reagent/consumable inventory model | `schema.prisma` | Add Reagent, ReagentLot, ReagentUsage models | 1-2 days |
| 23 | P2 | 🟠 HIGH | No account lockout mechanism | `routes/auth/index.ts` | Track failed attempts per user, lock after 5 failures | 4hr |
| 24 | P2 | 🟠 HIGH | No password complexity enforcement | `routes/auth/index.ts` | Min 8 chars, require upper/lower/digit/special | 1hr |
| 25 | P2 | 🟠 HIGH | MFA fields present but unimplemented | `schema.prisma:80-81` | Implement TOTP-based MFA or remove fields | 2-3 days |
| 26 | P2 | 🟠 HIGH | No IDOR protection on most routes | Various routes | Add `organizationId` filter to ALL queries | 4hr |
| 27 | P2 | 🟠 HIGH | Audit route uses non-existent `fastify.requireRole` | `routes/audit/index.ts` | Use `requireRole('LAB_DIRECTOR')` from middleware | 15min |
| 28 | P2 | 🟠 HIGH | No HTTP security headers (HSTS, CSP, etc.) | `server.ts` | Add `@fastify/helmet` | 30min |
| 29 | P2 | 🟠 HIGH | No encryption at rest for PII/PHI | N/A | Implement column-level encryption or database-level TDE | 1-2 days |
| 30 | P2 | 🟠 HIGH | No change control / versioning for methods/specs | `schema.prisma` | Add version history for TestMethod and Specification | 2-3 days |
| 31 | P2 | 🟠 HIGH | CORS may default to permissive in prod | `plugins/cors.ts` | Default to empty origins list in production if env var missing | 30min |
| 32 | P3 | 🔴 CRITICAL | Race condition in sequence ID generation | `shared/utils/idGenerator.ts` | Use `SELECT FOR UPDATE` or `RETURNING` with atomic increment | 2hr |
| 33 | P3 | 🟠 HIGH | Double-submission creates duplicate test results | `routes/tests/index.ts` | Add `@@unique([testId, analyteId])` constraint | 30min |
| 34 | P3 | 🟠 HIGH | Invoice auto-generation has no idempotency guard | `routes/invoices/index.ts` | Track "invoiced" flag per test/order | 2hr |
| 35 | P3 | 🟠 HIGH | External service calls lack timeouts | Various | Set explicit timeout on Stripe, SMTP, QuickBooks calls | 2hr |
| 36 | P3 | 🟠 HIGH | Missing database indexes cause performance issues | `schema.prisma` | See finding #18 | 2hr |
| 37 | P3 | 🟠 HIGH | Dead code: route registrations commented out | `server.ts:143-153` | See finding #1 | 30min |
| 38 | P3 | 🟡 MEDIUM | JavaScript float used for financial calculations | `shared/utils/calculations.ts` | Use `decimal.js` or `big.js` for invoice/payment math | 4hr |
| 39 | P3 | 🟡 MEDIUM | Batch label rendering produces invalid PDF | `report-engine/src/renderer.ts` | Use `pdf-lib` or `@react-pdf/renderer` multi-page approach | 4hr |
| 40 | P5 | 🟠 HIGH | No API documentation (Swagger/OpenAPI) | N/A | Add `@fastify/swagger` with schema definitions | 1-2 days |
| 41 | P5 | 🟠 HIGH | Deploy workflow is a stub | `.github/workflows/deploy.yml` | Implement actual deployment for chosen provider | 1-2 days |
| 42 | P5 | 🟠 HIGH | No migration rollback strategy | N/A | Create down migrations, document rollback procedure | 1 day |
| 43 | P5 | 🟡 MEDIUM | No ESLint configuration | Root dir | Add ESLint with TypeScript rules | 2hr |

*(Table truncated for 🟡 MEDIUM and 🔵 LOW findings — see individual phase reports for complete listings)*

---

## Prioritized Remediation Plan

### Sprint 0: Immediate (Day 1) — Make the System Functional

**Goal:** The API starts, routes work, authentication functions correctly.

| Task | Finding(s) | Effort | Priority |
|------|------------|--------|----------|
| Uncomment and register all route modules in `server.ts` | #1 | 30min | P0 |
| Remove hardcoded JWT secret fallbacks in `routes/auth/index.ts` | #5 | 15min | P0 |
| Consolidate to single JWT implementation (remove `jsonwebtoken` direct usage) | #6 | 2hr | P0 |
| Fix `trustProxy` logic in `server.ts` | #20 | 5min | P0 |
| Fix cookie secret fallback | #21 | 10min | P0 |
| Fix audit route — use correct `requireRole()` import and valid role name | #27 | 15min | P0 |
| Generate `pnpm-lock.yaml` | #13 | 15min | P0 |
| Create initial Prisma migration | #14 | 1hr | P0 |

**Estimated total:** ~4-5 hours

### Sprint 1: This Week — Critical Security & Compliance

**Goal:** Authentication is secure, authorization works, audit trail is reliable.

| Task | Finding(s) | Effort | Priority |
|------|------------|--------|----------|
| Fix frontend RBAC role names | #7 | 1hr | P0 |
| Add IDOR protection (org scoping) to all queries | #26 | 4hr | P1 |
| Add account lockout after failed attempts | #23 | 4hr | P1 |
| Add password complexity validation | #24 | 1hr | P1 |
| Add HTTP security headers (`@fastify/helmet`) | #28 | 30min | P1 |
| Fix CORS to default-deny in production | #31 | 30min | P1 |
| Make audit trail immutable (DB trigger preventing DELETE/UPDATE) | #8 | 2hr | P1 |
| All route handlers set `request.auditContext` with before/after state | #10 | 1 week | P1 |
| Unify state machine definitions (single source of truth) | #4 | 4hr | P1 |
| All state transitions through `executeTransition()` | #16 | 1 week | P1 |
| Add `@@unique([testId, analyteId])` to TestResult | #33 | 30min | P1 |
| Fix race condition in sequence ID generation | #32 | 2hr | P1 |
| Add missing database indexes | #18, #36 | 2hr | P1 |

**Estimated total:** ~2-3 weeks (with parallel work)

### Sprint 2: Next Sprint — Test Suite & Operational Readiness

**Goal:** Test coverage >80%, deployable to staging.

| Task | Finding(s) | Effort | Priority |
|------|------------|--------|----------|
| Write authentication test suite (12 scenarios) | #2, Phase 4 | 2 days | P0 |
| Write authorization test suite (6 scenarios) | #2, Phase 4 | 2 days | P0 |
| Write sample lifecycle test suite (8 scenarios) | #2, Phase 4 | 2 days | P1 |
| Write test results test suite (8 scenarios) | #2, Phase 4 | 2 days | P1 |
| Write audit trail test suite (7 scenarios) | #2, Phase 4 | 1 day | P1 |
| Write billing/financial test suite (8 scenarios) | #2, Phase 4 | 2 days | P1 |
| Write data validation test suite (8 scenarios) | #2, Phase 4 | 1 day | P1 |
| Create production Dockerfile (multi-stage) | #11 | 4hr | P1 |
| Set up automated database backups | #12 | 4hr | P1 |
| Add `@fastify/swagger` for API documentation | #40 | 1-2 days | P2 |
| Add ESLint configuration | #43 | 2hr | P2 |
| Add optimistic locking (version field) | #17 | 4hr | P2 |
| Add soft-delete to Sample, Test, Order | #19 | 4hr | P2 |

**Estimated total:** ~3-4 weeks

### Sprint 3: Backlog — Compliance & Enhancement

**Goal:** 21 CFR Part 11 compliance, portal API, operational monitoring.

| Task | Finding(s) | Effort | Priority |
|------|------------|--------|----------|
| Implement electronic signatures with re-authentication | #9 | 1 week | P2 |
| Implement MFA (TOTP) | #25 | 2-3 days | P2 |
| Implement change control / versioning for methods & specs | #30 | 2-3 days | P2 |
| Add reagent/consumable inventory model | #22 | 1-2 days | P2 |
| Implement portal API routes | #3 | 1-2 weeks | P2 |
| Add Prometheus metrics endpoint | Phase 5 | 1 day | P3 |
| Add encryption at rest for PII/PHI | #29 | 1-2 days | P3 |
| Use `decimal.js` for financial calculations | #38 | 4hr | P3 |
| Implement actual deployment pipeline | #41 | 1-2 days | P3 |
| Add data export capability for regulatory review | Phase 5 | 2-3 days | P3 |
| Add data retention policy enforcement | Phase 2 | 2-3 days | P3 |

**Estimated total:** ~4-6 weeks

---

## Code Fixes for CRITICAL and HIGH Findings

### Fix #1: Register All Route Modules

**File:** `apps/api/src/server.ts` (lines 141-166)

**Current (broken):**
```typescript
await fastify.register(
  async function v1Routes(v1: FastifyInstance) {
    // Placeholder: individual route files will be registered here.
    // Example:
    //   await v1.register(import('./routes/auth.js'), { prefix: '/auth' });
    //   await v1.register(import('./routes/samples.js'), { prefix: '/samples' });
    //   ...

    v1.setNotFoundHandler(async (request, _reply) => {
      return { ... };
    });
  },
  { prefix: '/api/v1' },
);
```

**Fixed:**
```typescript
await fastify.register(
  async function v1Routes(v1: FastifyInstance) {
    await v1.register(import('./routes/auth/index.js'), { prefix: '/auth' });
    await v1.register(import('./routes/samples/index.js'), { prefix: '/samples' });
    await v1.register(import('./routes/tests/index.js'), { prefix: '/tests' });
    await v1.register(import('./routes/orders/index.js'), { prefix: '/orders' });
    await v1.register(import('./routes/clients/index.js'), { prefix: '/clients' });
    await v1.register(import('./routes/invoices/index.js'), { prefix: '/invoices' });
    await v1.register(import('./routes/payments/index.js'), { prefix: '/payments' });
    await v1.register(import('./routes/reports/index.js'), { prefix: '/reports' });
    await v1.register(import('./routes/users/index.js'), { prefix: '/users' });
    await v1.register(import('./routes/instruments/index.js'), { prefix: '/instruments' });
    await v1.register(import('./routes/specifications/index.js'), { prefix: '/specifications' });
    await v1.register(import('./routes/testMethods/index.js'), { prefix: '/test-methods' });
    await v1.register(import('./routes/storage/index.js'), { prefix: '/storage' });
    await v1.register(import('./routes/priceLists/index.js'), { prefix: '/price-lists' });
    await v1.register(import('./routes/projects/index.js'), { prefix: '/projects' });
    await v1.register(import('./routes/dashboard/index.js'), { prefix: '/dashboard' });
    await v1.register(import('./routes/notifications/index.js'), { prefix: '/notifications' });
    await v1.register(import('./routes/audit/index.js'), { prefix: '/audit' });
    await v1.register(import('./routes/webhooks/index.js'), { prefix: '/webhooks' });

    v1.setNotFoundHandler(async (request, _reply) => {
      return {
        statusCode: 404,
        error: 'NotFoundError',
        code: 'ROUTE_NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
      };
    });
  },
  { prefix: '/api/v1' },
);
```

**Why:** Without this fix, the API server starts but responds with 404 to every request. All 19 route modules are fully implemented but never loaded.

---

### Fix #5: Remove Hardcoded JWT Secret Fallbacks

**File:** `apps/api/src/routes/auth/index.ts` (lines 7-8)

**Current (vulnerable):**
```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'change-me-refresh-in-production';
```

**Fixed:**
```typescript
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
if (!JWT_REFRESH_SECRET) {
  throw new Error('JWT_REFRESH_SECRET environment variable is required');
}
```

**Why:** With fallback values, a deployment that forgets to set environment variables will start successfully but use predictable, publicly-known secrets. Any attacker can forge valid JWTs.

---

### Fix #7: Frontend RBAC Role Names

**File:** `apps/web/src/hooks/useRBAC.ts`

**Current (broken):**
```typescript
const rolePermissions: Record<string, Permission[]> = {
  admin: [...],
  lab_manager: [...],
  analyst: [...],
  reviewer: [...],
  receptionist: [...],
  billing_clerk: [...],
};
```

**Fixed:**
```typescript
import { ROLE_PERMISSIONS, type UserRole } from '@labflow/shared';

// Use the canonical role-permission mapping from the shared package
// The Permission types may need mapping from backend format to frontend format
const rolePermissions: Record<string, Permission[]> = {
  SUPER_ADMIN: [...],
  LAB_DIRECTOR: [...],
  LAB_MANAGER: [...],
  SENIOR_ANALYST: [...],
  ANALYST: [...],
  SAMPLE_RECEIVER: [...],
  DATA_ENTRY: [...],
  BILLING_ADMIN: [...],
  BILLING_VIEWER: [...],
  CLIENT_ADMIN: [...],
  CLIENT_USER: [...],
  READONLY: [...],
};
```

**Why:** The frontend uses role names (`admin`, `lab_manager`) that don't match any backend role (`SUPER_ADMIN`, `LAB_MANAGER`). The `rolePermissions` lookup always returns `undefined`, meaning `permissions` is always an empty set, and `hasPermission()` always returns `false` for every user.

---

### Fix #20: trustProxy Always True

**File:** `apps/api/src/server.ts` (line 31)

**Current (broken):**
```typescript
trustProxy: process.env.TRUST_PROXY === 'true' || true,
```

**Fixed:**
```typescript
trustProxy: process.env.TRUST_PROXY === 'true',
```

**Why:** `|| true` makes the entire expression always `true` regardless of the env var. This means the server always trusts proxy headers, which could allow IP spoofing in non-proxied environments.

---

### Fix #27: Audit Route Uses Non-Existent Method

**File:** `apps/api/src/routes/audit/index.ts`

**Current (broken):**
```typescript
fastify.get('/', {
  preHandler: [fastify.authenticate, fastify.requireRole('ADMIN')],
}, async (request, reply) => { ... });
```

**Fixed:**
```typescript
import { authenticateRequest, requireRole } from '../../middleware/auth.js';

fastify.get('/', {
  preHandler: [authenticateRequest, requireRole('LAB_DIRECTOR')],
}, async (request, reply) => { ... });
```

**Why:** `fastify.requireRole` is not a decorated method. `requireRole` is a standalone function from the auth middleware. Additionally, `'ADMIN'` is not a valid role — the correct role is `'SUPER_ADMIN'` or `'LAB_DIRECTOR'` for the minimum role that should access audit logs.

---

### Fix #32: Sequence ID Race Condition

**File:** Wherever sequence IDs are generated (currently in seed.ts, should be in a service)

**Current (vulnerable):**
```typescript
// Read current value
const seq = await prisma.sequence.findFirst({ where: { ... } });
const nextVal = (seq?.currentValue ?? 0) + 1;
// Update
await prisma.sequence.update({ where: { id: seq.id }, data: { currentValue: nextVal } });
// Use nextVal to generate ID
```

**Fixed:**
```typescript
// Atomic increment using raw SQL for safety
const result = await prisma.$queryRaw<[{ current_value: number }]>`
  UPDATE sequences
  SET current_value = current_value + 1
  WHERE organization_id = ${orgId}
    AND entity_type = ${entityType}
    AND year = ${year}
  RETURNING current_value
`;
const nextVal = result[0].current_value;
```

**Why:** Without atomic increment, two concurrent requests can read the same `currentValue`, both increment to the same value, and generate duplicate IDs. The `RETURNING` clause makes this a single atomic operation.

---

### Fix #33: Duplicate Test Results

**File:** `packages/db/prisma/schema.prisma`

**Current (missing constraint):**
```prisma
model TestResult {
  id       String @id @default(uuid())
  testId   String
  analyteId String
  // ...
  @@map("test_results")
}
```

**Fixed:**
```prisma
model TestResult {
  id       String @id @default(uuid())
  testId   String
  analyteId String
  // ...
  @@unique([testId, analyteId])
  @@map("test_results")
}
```

**Why:** Without this constraint, submitting results for the same analyte on the same test creates duplicate records. Spec checking and result reporting become ambiguous — which result is the "current" one?

---

## Appendix: What This Codebase Does Well

Despite the critical issues, this zero-shot implementation demonstrates genuine strengths:

1. **Domain modeling depth:** The Prisma schema captures LIMS concepts (chain of custody, specification limits with warning bands, dilution factors, RPD, recovery %) with real domain expertise.

2. **Technology choices:** Fastify, Prisma, Zod, BullMQ, React-PDF, React Email — all modern, well-maintained, and appropriate for the use case.

3. **Separation of packages:** The monorepo structure with shared types, separate DB package, email templates, and report engine is clean architecture.

4. **Error handling framework:** Custom AppError hierarchy with structured JSON responses and production-safe error masking.

5. **Pino logging with redaction:** Sensitive fields are redacted before logging — a detail often missed.

6. **Comprehensive seed data:** The seed file creates realistic lab data including cannabis testing analytes, California regulatory specifications, and multi-client scenarios.

7. **Financial model completeness:** Invoice lifecycle, payment tracking, credit notes, aging reports, volume tier pricing, and Stripe integration.

8. **Code consistency:** For zero-shot generation, the coding style is remarkably consistent across 85+ files.

**The foundation is strong. The execution needs completion and hardening.**
