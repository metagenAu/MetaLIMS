# AUDIT PHASE 2: SECURITY AUDIT

**Audit Date:** 2026-02-16
**System:** MetaLIMS / LabFlow LIMS

---

## 🔴 IMMEDIATE SECURITY ALERT

**Finding S-1: Hardcoded JWT secrets with fallback values**

```typescript
// routes/auth/index.ts:7-8
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'change-me-refresh-in-production';
```

If environment variables are not set, the API will start with predictable, publicly known secrets. Any attacker can forge valid JWTs. The auth plugin (`plugins/auth.ts:25-28`) correctly throws if `JWT_SECRET` is missing, but the auth route file bypasses this by using its own fallback.

**Finding S-2: All API routes are commented out — no functional authentication boundary exists**

See Phase 0, finding P0-1. The entire API is non-functional because no routes are registered.

---

## 2.1 Authentication

### Assessment: 🟠 HIGH risk — Multiple issues

| # | Severity | Finding | File(s) | Detail |
|---|----------|---------|---------|--------|
| 2.1-1 | 🔴 CRITICAL | **Dual JWT signing — inconsistent secret usage** | `routes/auth/index.ts`, `plugins/auth.ts` | Auth route uses `jsonwebtoken` directly with its own `JWT_SECRET` variable (with fallback). Auth plugin uses `@fastify/jwt` with `process.env.JWT_SECRET` (no fallback, throws). If the auth route signs tokens, the auth plugin may verify with a **different** secret if env var behavior differs. Token claims structure also differs: auth route uses `{userId, organizationId, role, email}`, auth plugin expects `{sub, orgId, email, role}`. |
| 2.1-2 | 🟠 HIGH | **No account lockout mechanism** | `routes/auth/index.ts` | Failed login attempts are not counted. There is no lockout after N failures. The rate limiter applies globally (10 req/min on auth endpoints) but doesn't lock specific accounts. A distributed attacker could bypass the IP-based rate limit. |
| 2.1-3 | 🟠 HIGH | **No password complexity enforcement** | `routes/auth/index.ts` | Login schema requires `z.string().min(1)`, reset-password requires `z.string().min(8).max(128)`. No requirements for uppercase, lowercase, digits, or special characters. No check against common password lists. |
| 2.1-4 | 🟠 HIGH | **MFA fields exist but are completely unimplemented** | `schema.prisma:80-81` | User model has `mfaEnabled` and `mfaSecret` fields, but no code anywhere enables, configures, or verifies MFA. This is a placeholder that provides false confidence. |
| 2.1-5 | 🟡 MEDIUM | **Bcrypt cost factor is 12 in user creation but unverified at login** | `routes/users/index.ts`, `routes/auth/index.ts` | User creation uses `bcrypt.hash(password, 12)` (good, cost 12). The seed uses `bcrypt.hash('password123', 12)`. Login uses `bcrypt.compare()` which auto-detects cost — acceptable. |
| 2.1-6 | 🟡 MEDIUM | **Refresh token rotation partially implemented** | `routes/auth/index.ts` | Refresh tokens are hashed with SHA-256 before storage and rotated on use. However, there's no family/chain tracking — if an old refresh token is reused (indicating theft), the system doesn't invalidate all tokens in the family. |
| 2.1-7 | 🟡 MEDIUM | **Password reset token security** | `routes/auth/index.ts` | Reset token is `crypto.randomBytes(32).toString('hex')` — good randomness. Stored as SHA-256 hash — good. But expiry time is unclear from the code; there's no explicit TTL check in the reset handler. |
| 2.1-8 | 🟡 MEDIUM | **JWT algorithm explicitly set to HS256** | `plugins/auth.ts:32-37` | Algorithm is explicitly set for both signing and verification, preventing algorithm confusion attacks. ✅ This is correct. |
| 2.1-9 | 🔵 LOW | **No "remember me" or session management UI** | N/A | JWT access token expires in 15 minutes, refresh in 7 days. No user-facing session management. |

---

## 2.2 Authorization

### Assessment: 🟠 HIGH risk — Framework exists but inconsistently applied

| # | Severity | Finding | File(s) | Detail |
|---|----------|---------|---------|--------|
| 2.2-1 | 🔴 CRITICAL | **Frontend RBAC uses different role names than backend** | `apps/web/src/hooks/useRBAC.ts` | Frontend defines roles as `admin`, `lab_manager`, `analyst`, `reviewer`, `receptionist`, `billing_clerk`. Backend defines roles as `SUPER_ADMIN`, `LAB_DIRECTOR`, `LAB_MANAGER`, `SENIOR_ANALYST`, `ANALYST`, `SAMPLE_RECEIVER`, `DATA_ENTRY`, `BILLING_ADMIN`, `BILLING_VIEWER`, `CLIENT_ADMIN`, `CLIENT_USER`, `READONLY`. **These don't match.** The frontend's `rolePermissions` map will never match any actual role from the backend, making the entire frontend RBAC system non-functional. |
| 2.2-2 | 🟠 HIGH | **Audit route uses non-existent method** | `routes/audit/index.ts` | `preHandler: [fastify.authenticate, fastify.requireRole('ADMIN')]` — `fastify.requireRole` is not a decorated method on the Fastify instance. The middleware exports `requireRole()` as a standalone function, not a Fastify decorator. This will throw a runtime error. Additionally, `'ADMIN'` is not a valid role name (should be `'SUPER_ADMIN'` or `'LAB_DIRECTOR'`). |
| 2.2-3 | 🟠 HIGH | **Inconsistent authorization patterns** | Various routes | Some routes use `fastify.authenticate` (the plugin decorator), others use `authenticateRequest` (the middleware function), and many routes reference role checks in commented-out forms. No consistent pattern for how auth is applied. |
| 2.2-4 | 🟠 HIGH | **No IDOR protection on most routes** | Various routes | Most routes fetch entities by UUID (`prisma.sample.findUnique({ where: { id } })`) without verifying `organizationId`. If a user knows another organization's sample UUID, they could access it. The `authenticateRequest` middleware sets `request.organizationId` but routes don't always use it in queries. |
| 2.2-5 | 🟡 MEDIUM | **Super admin org header bypass not validated** | `middleware/auth.ts:284-289` | Super admins can set `X-Organization-Id` header to operate across orgs. The header value is accepted without verifying the organization exists. A super admin could set it to an arbitrary string. |
| 2.2-6 | 🟡 MEDIUM | **Permission-based checks vs role-based checks inconsistently used** | `middleware/auth.ts`, `packages/shared/src/constants/roles.ts` | The shared package defines a comprehensive 40+ permission system (`ROLE_PERMISSIONS`), but the API middleware uses hierarchical role checks (`requireRole`, `requireAnyRole`) or the simpler `requirePermission`. The two systems aren't integrated — the role hierarchy in `middleware/auth.ts` is a flat ordered list while `roles.ts` uses level-based comparison. |
| 2.2-7 | 🟡 MEDIUM | **Client portal has no tenant isolation** | `apps/portal/src/hooks/usePortalAuth.ts` | Portal auth stores tokens in `localStorage` and calls `/api/portal/*` endpoints. Since these portal endpoints don't exist, there's no tenant isolation implementation to evaluate. But the frontend assumes clients can only see their own data — this is unverifiable. |

---

## 2.3 Input Validation & Injection

### Assessment: 🟡 MEDIUM — Mostly protected via ORM

| # | Severity | Finding | File(s) | Detail |
|---|----------|---------|---------|--------|
| 2.3-1 | ✅ PASS | **Prisma ORM prevents SQL injection** | All data access | All database queries use Prisma client methods with parameterized queries. No raw SQL string concatenation found. One instance of raw SQL: `prisma.$queryRaw\`SELECT 1\`` in health check — this is safe (no user input). |
| 2.3-2 | 🟡 MEDIUM | **Zod validation not consistently applied** | Various routes | Some routes parse request body with Zod schemas, others trust Fastify's built-in schema validation, and some do neither. The shared validation schemas exist but aren't imported by most route files. |
| 2.3-3 | 🟡 MEDIUM | **File upload validation incomplete** | `server.ts:60-67` | Multipart plugin limits file size (50MB), file count (10), and field count (20). But there's **no file type validation** (MIME type, extension, magic bytes). An attacker could upload executable files, scripts, or malicious content. |
| 2.3-4 | 🟡 MEDIUM | **No XSS protection on report template HTML** | `schema.prisma:928-929` | `ReportTemplate.headerHtml` and `footerHtml` store raw HTML that gets rendered in PDF reports. If an admin injects malicious HTML, it could affect PDF rendering or be exploited if HTML is also rendered in browsers. |
| 2.3-5 | 🔵 LOW | **Sort field injection partially mitigated** | `pagination.ts:247-253` | `parseSortParams` validates `sortBy` against an allowlist. ✅ Good. But the allowlist defaults to `['createdAt', 'updatedAt', 'name']` and callers may not always pass appropriate allowlists. |
| 2.3-6 | 🟡 MEDIUM | **Numeric input ranges not validated** | Various routes | No range validation on decimal fields like `temperatureOnReceipt`, `quantity`, `dilutionFactor`. Extreme values (1e15, -1e15) could pass validation and cause calculation errors. |

---

## 2.4 API Security

### Assessment: 🟡 MEDIUM — Basics present, headers missing

| # | Severity | Finding | File(s) | Detail |
|---|----------|---------|---------|--------|
| 2.4-1 | 🟠 HIGH | **CORS allows all origins in development** | `plugins/cors.ts` | Dev mode: `origin: true` (allows all). Production: reads `CORS_ORIGINS` env var. If `CORS_ORIGINS` isn't set in production, behavior is undefined — should default to restrictive. |
| 2.4-2 | 🟠 HIGH | **No HTTP security headers** | `server.ts` | No HSTS, X-Content-Type-Options, X-Frame-Options, or CSP headers are set. No `@fastify/helmet` or equivalent. API responses lack standard security headers. |
| 2.4-3 | 🟡 MEDIUM | **Rate limiting adequate but basic** | `middleware/rateLimiter.ts` | Global: 100 req/min. Auth: 10/min. Uploads: 20/min. Reports: 30/min. Uses authenticated user ID or IP as key. Acceptable baseline. |
| 2.4-4 | 🟡 MEDIUM | **Password hashes excluded from responses** | `routes/users/index.ts` | User queries use `select` to exclude `passwordHash`. ✅ Good. But no systematic response sanitization — responses include all fields unless explicitly selected. |
| 2.4-5 | 🔵 LOW | **API versioning via URL prefix** | `server.ts:141` | Routes under `/api/v1/`. Good practice for versioning. |

---

## 2.5 Data Protection

### Assessment: 🟠 HIGH risk — Significant gaps

| # | Severity | Finding | File(s) | Detail |
|---|----------|---------|---------|--------|
| 2.5-1 | 🟠 HIGH | **No encryption at rest** | N/A | No evidence of column-level encryption for PII (client contact info, email addresses), PHI (lab results could be health-related), or financial data (payment details, credit card refs). Database-level encryption depends on infrastructure config not present here. |
| 2.5-2 | 🟠 HIGH | **Audit logs are mutable** | `schema.prisma:945-963` | `AuditLog` has no `@updatedAt` field (good — implies no updates), but there's no database-level trigger or constraint preventing UPDATE or DELETE. Application code doesn't delete/update audit logs, but a compromised system could. |
| 2.5-3 | 🟡 MEDIUM | **Sensitive data in logger redaction** | `utils/logger.ts` | Logger redacts `authorization`, `cookie`, `password`, `passwordHash`, `mfaSecret`, `stripeAccountId`, `stripeCustomerId`. ✅ Good coverage. But `email`, `phone`, `address`, and client financial details are not redacted. |
| 2.5-4 | 🟡 MEDIUM | **No data retention policy** | N/A | No automatic purging of old data, no retention period enforcement. Lab data may need to be retained for specific periods (7 years for FDA-regulated), but there's no implementation. |
| 2.5-5 | 🟡 MEDIUM | **S3/MinIO credentials in plaintext** | `.env.example` | MinIO access/secret keys are in the `.env` file. Standard practice but should be noted — production should use IAM roles or vault-based secret management. |

---

## 2.6 Regulatory Compliance (21 CFR Part 11 / GxP)

### Assessment: 🔴 CRITICAL — Not compliant

| # | Severity | Finding | Detail |
|---|----------|---------|--------|
| 2.6-1 | 🔴 CRITICAL | **Electronic signatures not properly implemented** | The `ApprovalAction` model records who approved and when, with an optional `signatureUrl` (presumably an image of a signature). But 21 CFR Part 11 requires electronic signatures to be **linked to the signer's unique identification** (not just a user ID) and include the **meaning of the signing** (e.g., "I approve these results as accurate"). The `comments` field is optional. There's no requirement for re-authentication at the point of signing. |
| 2.6-2 | 🔴 CRITICAL | **Audit trail is incomplete** | The audit middleware captures mutating requests but has significant gaps: (1) It relies on route handlers to set `request.auditContext` for detailed diffs, but most handlers don't. (2) Without `auditContext`, only URL-derived entity type and ID are logged — no old/new values. (3) Reason for change is never captured. 21 CFR Part 11 requires reason-for-change on modifications. |
| 2.6-3 | 🔴 CRITICAL | **Audit trail can be deleted** | No database-level protection against DELETE on `audit_logs` table. No append-only table configuration. No blockchain/hash-chain integrity verification. A database admin could delete or modify audit records without detection. |
| 2.6-4 | 🟠 HIGH | **No system access controls** | No user provisioning workflow (approval required to create accounts). No automatic deactivation of inactive accounts. No requirement to change default passwords. Seed creates users with `password123` — no forced password change on first login. |
| 2.6-5 | 🟠 HIGH | **No change control / versioning** | Test methods, specifications, and workflow configurations can be modified without version tracking. No change request/approval process. No ability to see historical versions of a test method. The `WorkflowConfig.steps` field is JSON with no versioning. |
| 2.6-6 | 🟠 HIGH | **ALCOA+ gaps** | **Attributable:** ✅ User ID tracked on most actions. **Legible:** ✅ Structured data. **Contemporaneous:** ✅ Timestamps auto-generated. **Original:** 🟠 No distinction between original entry and corrections. **Accurate:** 🟡 No validation against specifications during entry (only after). **Complete:** 🟠 Audit trail incomplete (see 2.6-2). **Consistent:** 🟡 Dual timezone handling risk. **Enduring:** 🟠 No backup strategy documented. **Available:** 🟡 No data export capability for regulatory review. |
| 2.6-7 | 🟡 MEDIUM | **No training records or competency tracking** | No model for user competency verification, training records, or method authorization. A lab must verify that analysts are trained on specific test methods before performing tests. |

---

## Phase 2 Summary

| Rating | Count |
|--------|-------|
| 🔴 CRITICAL | 5 (including 2 immediate alerts) |
| 🟠 HIGH | 11 |
| 🟡 MEDIUM | 13 |
| 🔵 LOW | 2 |
| ✅ PASS | 2 |

**Top 5 Security Risks:**
1. Hardcoded JWT secret fallbacks enabling token forgery
2. Dual JWT implementations with incompatible token formats
3. Frontend RBAC using wrong role names — completely non-functional
4. Regulatory non-compliance (21 CFR Part 11) — audit trail deletable, no e-signatures, incomplete change tracking
5. No IDOR protection — cross-tenant data access possible
