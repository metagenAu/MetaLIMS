# =============================================================
# Multi-stage Dockerfile for LabFlow LIMS
# Builds the API (Fastify) service for production deployment.
# =============================================================

# ---- Base ----
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --prod=false

# ---- Build ----
FROM deps AS build
COPY packages/db/ packages/db/
COPY packages/shared/ packages/shared/
COPY apps/api/ apps/api/
COPY tsconfig.json ./
RUN pnpm --filter @labflow/db exec prisma generate
RUN pnpm --filter @labflow/api build

# ---- Production dependencies ----
FROM base AS prod-deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --prod

# ---- Runner ----
FROM node:20-alpine AS runner
RUN addgroup --system --gid 1001 labflow && \
    adduser --system --uid 1001 labflow

WORKDIR /app

# Copy production node_modules
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=prod-deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy built artifacts
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages/db/ ./packages/db/
COPY --from=build /app/packages/shared/ ./packages/shared/

# Copy package.json files for module resolution
COPY --from=build /app/package.json ./
COPY --from=build /app/apps/api/package.json ./apps/api/

# Generate Prisma client for the runtime image
COPY --from=build /app/packages/db/prisma ./packages/db/prisma
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma

USER labflow

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "apps/api/dist/server.js"]
