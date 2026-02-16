# LabFlow LIMS - Deployment Guide

This guide covers deploying LabFlow from a local development setup through to production. It includes Docker-based deployment, cloud provider guidance, reverse proxy configuration, TLS, backups, and operational monitoring.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Environment Configuration](#environment-configuration)
4. [Local Development](#local-development)
5. [Docker Production Build](#docker-production-build)
6. [Docker Compose Production Stack](#docker-compose-production-stack)
7. [Reverse Proxy with Nginx](#reverse-proxy-with-nginx)
8. [TLS / HTTPS with Let's Encrypt](#tls--https-with-lets-encrypt)
9. [Database Operations](#database-operations)
10. [Cloud Deployment](#cloud-deployment)
11. [CI/CD Pipeline](#cicd-pipeline)
12. [Monitoring & Logging](#monitoring--logging)
13. [Backup & Restore](#backup--restore)
14. [Security Hardening](#security-hardening)
15. [Scaling](#scaling)
16. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

LabFlow is a monorepo powered by **Turborepo** and **pnpm workspaces** with the following services:

| Service | Technology | Default Port | Description |
|---|---|---|---|
| **API** | Fastify (Node.js) | 4000 | REST API backend |
| **Web** | Next.js 14 | 3000 | Internal staff dashboard |
| **Portal** | Next.js 14 | 3001 | External client portal |
| **Database** | PostgreSQL 16 | 5432 | Primary data store (Prisma ORM) |
| **Cache / Queue** | Redis 7 | 6379 | Caching, rate limiting, BullMQ job queues |
| **Object Storage** | MinIO / S3 | 9000 | File uploads (reports, attachments) |
| **Email** | SMTP (Mailhog in dev) | 1025 / 8025 | Transactional emails |

```
                    ┌─────────────┐
                    │   Nginx /   │
                    │   ALB / CF  │  ← TLS termination
                    └──────┬──────┘
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
     ┌─────────┐    ┌─────────┐    ┌─────────┐
     │   Web   │    │   API   │    │ Portal  │
     │  :3000  │    │  :4000  │    │  :3001  │
     └────┬────┘    └────┬────┘    └────┬────┘
          │              │              │
          │         ┌────┴────┐        │
          │         ▼         ▼        │
          │    ┌────────┐ ┌───────┐   │
          │    │Postgres│ │ Redis │   │
          │    │  :5432 │ │ :6379 │   │
          │    └────────┘ └───────┘   │
          │         │                  │
          └─────────┴──────────────────┘
                    │
               ┌────┴────┐
               │ MinIO/S3│
               │  :9000  │
               └─────────┘
```

---

## Prerequisites

| Tool | Minimum Version | Purpose |
|---|---|---|
| Node.js | >= 20.0.0 | Runtime |
| pnpm | >= 9.0.0 (9.12.0 recommended) | Package manager |
| Docker | >= 24.0 | Containerization |
| Docker Compose | v2 | Service orchestration |
| Git | >= 2.30 | Source control |

---

## Environment Configuration

Copy the example env file and configure for your target environment:

```bash
cp .env.example .env
```

### Required Variables

| Variable | Example | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://labflow:SECRET@db:5432/labflow?schema=public` | PostgreSQL connection string |
| `REDIS_URL` | `redis://redis:6379` | Redis connection string |
| `JWT_SECRET` | (random 64-char string) | JWT signing key |
| `JWT_REFRESH_SECRET` | (random 64-char string) | Refresh token signing key |
| `NEXTAUTH_SECRET` | (random 64-char string) | NextAuth.js session encryption |
| `NEXTAUTH_URL` | `https://app.example.com` | Canonical URL for auth callbacks |
| `NODE_ENV` | `production` | Environment mode |

### Optional / Service Variables

| Variable | Example | Description |
|---|---|---|
| `API_PORT` | `4000` | API server listen port |
| `API_URL` | `https://api.example.com` | Public API base URL |
| `WEB_URL` | `https://app.example.com` | Public web app URL |
| `PORTAL_URL` | `https://portal.example.com` | Public client portal URL |
| `S3_ENDPOINT` | `https://s3.amazonaws.com` | S3-compatible endpoint |
| `S3_ACCESS_KEY` | (your key) | S3 access key |
| `S3_SECRET_KEY` | (your secret) | S3 secret key |
| `S3_BUCKET` | `labflow` | S3 bucket name |
| `S3_REGION` | `us-east-1` | S3 region |
| `SMTP_HOST` | `smtp.sendgrid.net` | SMTP server host |
| `SMTP_PORT` | `587` | SMTP server port |
| `SMTP_USER` | `apikey` | SMTP username |
| `SMTP_PASS` | (your password) | SMTP password |
| `SMTP_FROM` | `noreply@example.com` | Sender address |
| `STRIPE_SECRET_KEY` | `sk_live_...` | Stripe API key |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Stripe webhook signing secret |
| `QUICKBOOKS_CLIENT_ID` | (your id) | QuickBooks OAuth client ID |
| `QUICKBOOKS_CLIENT_SECRET` | (your secret) | QuickBooks OAuth client secret |
| `QUICKBOOKS_REDIRECT_URI` | `https://api.example.com/...` | QuickBooks OAuth callback |
| `LOG_LEVEL` | `info` | Pino log level (`debug`, `info`, `warn`, `error`) |

### Generating Secrets

```bash
# Generate a cryptographically secure 64-character secret
openssl rand -base64 48

# Generate three separate secrets for JWT, refresh, and NextAuth
for name in JWT_SECRET JWT_REFRESH_SECRET NEXTAUTH_SECRET; do
  echo "$name=$(openssl rand -base64 48)"
done
```

> **Warning:** Never reuse secrets across environments. Never commit `.env` files to version control.

---

## Local Development

The automated setup script handles everything:

```bash
# Clone and enter the repo
git clone <repo-url>
cd labflow

# Run the setup script
chmod +x scripts/setup.sh
./scripts/setup.sh
```

The script will:
1. Verify prerequisites (Node.js >= 20, pnpm, Docker)
2. Copy `.env.example` to `.env` if needed
3. Start Docker services (PostgreSQL, Redis, MinIO, Mailhog)
4. Install dependencies (`pnpm install`)
5. Generate the Prisma client
6. Run database migrations
7. Seed the database with demo data

Then start all dev servers:

```bash
pnpm dev
```

| Service | URL |
|---|---|
| Web App | http://localhost:3000 |
| Client Portal | http://localhost:3001 |
| API Server | http://localhost:4000 |
| API Health Check | http://localhost:4000/health |
| MinIO Console | http://localhost:9001 |
| Mailhog UI | http://localhost:8025 |
| Prisma Studio | `pnpm db:studio` |

**Default login:** `admin@labflow.dev` / `password123`

---

## Docker Production Build

### Dockerfile for the API

Create `apps/api/Dockerfile`:

```dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# --- Dependencies stage ---
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile --prod=false

# --- Build stage ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN pnpm db:generate
RUN pnpm --filter @labflow/shared build
RUN pnpm --filter @labflow/api build

# --- Production stage ---
FROM node:20-alpine AS production
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/db ./packages/db
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-workspace.yaml ./
COPY --from=build /app/pnpm-lock.yaml ./

# Run Prisma generate in production image so the engine binary matches the OS
RUN cd packages/db && npx prisma generate

RUN addgroup -g 1001 -S labflow && adduser -S labflow -u 1001
USER labflow

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "apps/api/dist/server.js"]
```

### Dockerfile for the Web App

Create `apps/web/Dockerfile`:

```dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# --- Dependencies stage ---
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile --prod=false

# --- Build stage ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .
RUN pnpm db:generate
RUN pnpm --filter @labflow/shared build
RUN pnpm --filter @labflow/web build

# --- Production stage ---
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

RUN addgroup -g 1001 -S labflow && adduser -S labflow -u 1001
USER labflow

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node", "apps/web/server.js"]
```

> **Note:** For the standalone output to work, add `output: 'standalone'` to `next.config.js` in both `apps/web` and `apps/portal`. The Portal Dockerfile follows the same pattern as Web but uses port 3001.

### Building Images

```bash
# From the monorepo root
docker build -f apps/api/Dockerfile -t labflow-api:latest .
docker build -f apps/web/Dockerfile -t labflow-web:latest .
docker build -f apps/portal/Dockerfile -t labflow-portal:latest .
```

---

## Docker Compose Production Stack

Create `docker-compose.prod.yml`:

```yaml
version: "3.8"

services:
  # ── Database ──────────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-labflow}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-labflow}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-EXEC", "pg_isready -U labflow"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - internal
    # Do NOT expose ports externally in production

  # ── Redis ─────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD:?Set REDIS_PASSWORD} --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - internal

  # ── API ───────────────────────────────────────────────────
  api:
    image: labflow-api:latest
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${POSTGRES_USER:-labflow}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-labflow}?schema=public
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      JWT_SECRET: ${JWT_SECRET:?Set JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:?Set JWT_REFRESH_SECRET}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN:-15m}
      JWT_REFRESH_EXPIRES_IN: ${JWT_REFRESH_EXPIRES_IN:-7d}
      API_PORT: "4000"
      API_URL: ${API_URL}
      WEB_URL: ${WEB_URL}
      PORTAL_URL: ${PORTAL_URL}
      S3_ENDPOINT: ${S3_ENDPOINT}
      S3_ACCESS_KEY: ${S3_ACCESS_KEY}
      S3_SECRET_KEY: ${S3_SECRET_KEY}
      S3_BUCKET: ${S3_BUCKET:-labflow}
      S3_REGION: ${S3_REGION:-us-east-1}
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT:-587}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASS: ${SMTP_PASS}
      SMTP_FROM: ${SMTP_FROM}
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY}
      STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET}
      LOG_LEVEL: ${LOG_LEVEL:-info}
    networks:
      - internal
      - web

  # ── Web (Staff Dashboard) ────────────────────────────────
  web:
    image: labflow-web:latest
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    restart: unless-stopped
    depends_on:
      - api
    environment:
      NODE_ENV: production
      NEXTAUTH_URL: ${WEB_URL}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET:?Set NEXTAUTH_SECRET}
      API_URL: http://api:4000
    networks:
      - internal
      - web

  # ── Portal (Client-Facing) ───────────────────────────────
  portal:
    image: labflow-portal:latest
    build:
      context: .
      dockerfile: apps/portal/Dockerfile
    restart: unless-stopped
    depends_on:
      - api
    environment:
      NODE_ENV: production
      NEXTAUTH_URL: ${PORTAL_URL}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      API_URL: http://api:4000
    networks:
      - internal
      - web

  # ── Nginx Reverse Proxy ──────────────────────────────────
  nginx:
    image: nginx:1.25-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - certbot-webroot:/var/www/certbot:ro
      - certbot-certs:/etc/letsencrypt:ro
    depends_on:
      - api
      - web
      - portal
    networks:
      - web

  # ── Certbot (Let's Encrypt) ──────────────────────────────
  certbot:
    image: certbot/certbot:latest
    volumes:
      - certbot-webroot:/var/www/certbot
      - certbot-certs:/etc/letsencrypt
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do sleep 12h & wait $${!}; certbot renew --webroot -w /var/www/certbot; done'"

volumes:
  postgres-data:
  redis-data:
  certbot-webroot:
  certbot-certs:

networks:
  internal:
    driver: bridge
  web:
    driver: bridge
```

### Deploying

```bash
# Build images
docker compose -f docker-compose.prod.yml build

# Run database migrations before starting
docker compose -f docker-compose.prod.yml run --rm api \
  npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma

# Start all services
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
```

---

## Reverse Proxy with Nginx

Create `nginx/conf.d/labflow.conf`:

```nginx
upstream api_backend {
    server api:4000;
    keepalive 32;
}

upstream web_backend {
    server web:3000;
}

upstream portal_backend {
    server portal:3001;
}

# ── Redirect HTTP → HTTPS ──────────────────────────────────
server {
    listen 80;
    server_name app.example.com api.example.com portal.example.com;

    # Let's Encrypt ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# ── Web App (staff dashboard) ──────────────────────────────
server {
    listen 443 ssl http2;
    server_name app.example.com;

    ssl_certificate     /etc/letsencrypt/live/app.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;
    include             /etc/nginx/conf.d/ssl-params.conf;

    client_max_body_size 50M;

    location / {
        proxy_pass http://web_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-ID $request_id;
    }
}

# ── API ────────────────────────────────────────────────────
server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;
    include             /etc/nginx/conf.d/ssl-params.conf;

    client_max_body_size 50M;

    # Rate limit zone for API
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;

    location / {
        limit_req zone=api_limit burst=50 nodelay;

        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-ID $request_id;
    }

    # Health check endpoint (no rate limit)
    location /health {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }
}

# ── Portal (client-facing) ────────────────────────────────
server {
    listen 443 ssl http2;
    server_name portal.example.com;

    ssl_certificate     /etc/letsencrypt/live/portal.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/portal.example.com/privkey.pem;
    include             /etc/nginx/conf.d/ssl-params.conf;

    client_max_body_size 50M;

    location / {
        proxy_pass http://portal_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-ID $request_id;
    }
}
```

Create `nginx/conf.d/ssl-params.conf`:

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers off;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
ssl_session_timeout 1d;
ssl_session_cache shared:SSL:10m;
ssl_session_tickets off;
ssl_stapling on;
ssl_stapling_verify on;

add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Frame-Options DENY always;
add_header X-Content-Type-Options nosniff always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

Create `nginx/nginx.conf`:

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    multi_accept on;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for" '
                    'rt=$request_time rid=$request_id';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    include /etc/nginx/conf.d/*.conf;
}
```

---

## TLS / HTTPS with Let's Encrypt

### Initial Certificate Provisioning

Before starting the full stack, obtain certificates:

```bash
# 1. Start nginx with HTTP only (comment out the ssl server blocks first)
docker compose -f docker-compose.prod.yml up -d nginx

# 2. Request certificates
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d app.example.com \
  -d api.example.com \
  -d portal.example.com \
  --email admin@example.com \
  --agree-tos \
  --no-eff-email

# 3. Uncomment ssl server blocks and restart nginx
docker compose -f docker-compose.prod.yml restart nginx
```

### Auto-Renewal

The certbot container in the production compose file automatically attempts renewal every 12 hours. Add a cron job to reload nginx after renewal:

```bash
# /etc/cron.d/labflow-certbot
0 */12 * * * root docker compose -f /opt/labflow/docker-compose.prod.yml exec nginx nginx -s reload > /dev/null 2>&1
```

---

## Database Operations

### Running Migrations

```bash
# In development
cd packages/db
npx prisma migrate dev --name <migration-name>

# In production (apply pending migrations)
npx prisma migrate deploy
# Or via Docker:
docker compose -f docker-compose.prod.yml run --rm api \
  npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma
```

### Seeding

```bash
# Development
pnpm db:seed

# Production (first deploy only)
docker compose -f docker-compose.prod.yml run --rm api \
  node packages/db/prisma/seed.js
```

### Prisma Studio (Development Only)

```bash
pnpm db:studio
# Opens a browser-based DB explorer at http://localhost:5555
```

---

## Cloud Deployment

### AWS (Recommended for Production)

**Compute:** ECS Fargate or EC2 with Docker Compose

```
┌────────────────────────────────────────────────────┐
│                      VPC                           │
│  ┌──────────┐  ┌───────────┐  ┌────────────────┐  │
│  │ ALB      │→ │ ECS Tasks │→ │ RDS PostgreSQL │  │
│  │ (HTTPS)  │  │ api/web/  │  │ (Multi-AZ)     │  │
│  └──────────┘  │ portal    │  └────────────────┘  │
│                └───────────┘  ┌────────────────┐  │
│                           └──→│ ElastiCache    │  │
│                               │ (Redis)        │  │
│                               └────────────────┘  │
│                               ┌────────────────┐  │
│                               │ S3 Bucket      │  │
│                               └────────────────┘  │
└────────────────────────────────────────────────────┘
```

| Component | AWS Service | Notes |
|---|---|---|
| API / Web / Portal | ECS Fargate | Auto-scaling task definitions |
| Database | RDS PostgreSQL 16 | Multi-AZ, automated backups |
| Cache | ElastiCache Redis 7 | Cluster mode for HA |
| Object Storage | S3 | Native—remove MinIO |
| Load Balancer | ALB | TLS termination via ACM |
| DNS | Route 53 | Alias records to ALB |
| Secrets | Secrets Manager | Inject via ECS task definition |
| Email | SES | Production email delivery |
| Logs | CloudWatch | Container log groups |

**Key considerations:**
- Use **RDS** instead of self-hosted PostgreSQL for automated backups and failover.
- Use **S3** directly instead of MinIO—set `S3_ENDPOINT` to your region's S3 endpoint.
- Use **ACM** for free TLS certificates managed by ALB.
- Store secrets in **AWS Secrets Manager** and reference them in ECS task definitions.

### DigitalOcean / Smaller Deployments

For a single-server deployment:

```bash
# Provision a Droplet (4GB+ RAM recommended)
# SSH in and install Docker + Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Clone the repo
git clone <repo-url> /opt/labflow
cd /opt/labflow

# Configure environment
cp .env.example .env
# Edit .env with production values

# Deploy
docker compose -f docker-compose.prod.yml up -d
```

### Vercel (Next.js Apps Only)

The Next.js apps (`web` and `portal`) can be deployed to Vercel while running the API separately:

1. Connect the repo to Vercel.
2. Set the root directory to `apps/web` or `apps/portal`.
3. Set environment variables in the Vercel dashboard.
4. Point `API_URL` to your hosted API instance.

> **Note:** The API (Fastify) cannot run on Vercel. Deploy it separately to a server, container service, or Railway/Render.

---

## CI/CD Pipeline

The project includes a GitHub Actions CI workflow at `.github/workflows/ci.yml` that runs on every push/PR to `main` and `develop`:

1. **Install** - `pnpm install --frozen-lockfile`
2. **Lint** - `pnpm lint`
3. **Type Check** - `pnpm type-check`
4. **Test** - `pnpm test` (with PostgreSQL 16 and Redis 7 service containers)
5. **Build** - `pnpm build` (runs after all checks pass)

### Adding a Deployment Step

Add to `.github/workflows/ci.yml` or create a separate `deploy.yml`:

```yaml
deploy:
  name: Deploy to Production
  needs: build
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  runs-on: ubuntu-latest
  steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-east-1

    - name: Login to ECR
      uses: aws-actions/amazon-ecr-login@v2

    - name: Build and push images
      run: |
        docker build -f apps/api/Dockerfile -t $ECR_REGISTRY/labflow-api:${{ github.sha }} .
        docker push $ECR_REGISTRY/labflow-api:${{ github.sha }}
        # Repeat for web and portal

    - name: Deploy to ECS
      run: |
        aws ecs update-service --cluster labflow --service labflow-api \
          --force-new-deployment
```

---

## Monitoring & Logging

### Health Checks

The API exposes two health endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /health` | Liveness probe—returns uptime and version |
| `GET /health/ready` | Readiness probe—checks database connectivity |

Use these in your orchestrator:

```yaml
# Docker Compose healthcheck
healthcheck:
  test: ["CMD", "wget", "-qO-", "http://localhost:4000/health/ready"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 10s
```

```yaml
# Kubernetes
livenessProbe:
  httpGet:
    path: /health
    port: 4000
  initialDelaySeconds: 10
  periodSeconds: 30
readinessProbe:
  httpGet:
    path: /health/ready
    port: 4000
  initialDelaySeconds: 5
  periodSeconds: 10
```

### Structured Logging

The API uses **Pino** for structured JSON logging. In production (`NODE_ENV=production`), logs are emitted as JSON to stdout.

To aggregate logs:

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f api

# Pipe to a file or log aggregator
docker compose -f docker-compose.prod.yml logs -f api 2>&1 | tee /var/log/labflow-api.log
```

For production log aggregation, forward container logs to:
- **AWS CloudWatch** (via `awslogs` log driver)
- **Datadog** (via the Datadog agent)
- **ELK Stack** (via Filebeat sidecar)

### Uptime Monitoring

Set up external monitoring against `GET /health/ready`:

- **UptimeRobot** or **Better Uptime** for simple HTTP checks
- Alert on non-200 responses or response time > 5s

---

## Backup & Restore

### PostgreSQL Backups

```bash
# Manual backup
docker exec labflow-postgres pg_dump -U labflow -Fc labflow > backup_$(date +%Y%m%d_%H%M%S).dump

# Automated daily backup (add to crontab)
# /etc/cron.d/labflow-backup
0 2 * * * root docker exec labflow-postgres pg_dump -U labflow -Fc labflow > /opt/backups/labflow_$(date +\%Y\%m\%d).dump && find /opt/backups -name "labflow_*.dump" -mtime +30 -delete

# Restore from backup
docker exec -i labflow-postgres pg_restore -U labflow -d labflow --clean --if-exists < backup.dump
```

### Redis Backup

Redis is used for caching and rate-limiting state. Data is ephemeral and will rebuild on restart. If BullMQ job persistence is critical:

```bash
# Trigger an RDB snapshot
docker exec labflow-redis redis-cli -a $REDIS_PASSWORD BGSAVE

# Copy the dump file
docker cp labflow-redis:/data/dump.rdb ./redis-backup.rdb
```

### S3 / MinIO Backup

For MinIO, sync data to an external backup:

```bash
# Install mc (MinIO client)
mc alias set labflow http://localhost:9000 minioadmin minioadmin
mc mirror labflow/labflow /opt/backups/minio/
```

For AWS S3, enable versioning and cross-region replication on the bucket.

---

## Security Hardening

### Production Checklist

- [ ] **All secrets are unique** and generated with `openssl rand -base64 48`
- [ ] **`NODE_ENV=production`** is set on all services
- [ ] **Database ports are not exposed** to the public internet
- [ ] **Redis requires a password** (`requirepass` is set)
- [ ] **HTTPS is enforced** with valid TLS certificates
- [ ] **CORS origins are restricted** to your actual domains (check `apps/api/src/plugins/cors.ts`)
- [ ] **Rate limiting is enabled** (built into the API via `@fastify/rate-limit`)
- [ ] **Cookies are secure** (`secure: true`, `httpOnly: true`, `sameSite: lax`)
- [ ] **Internal error details are hidden** (the API strips stack traces when `NODE_ENV=production`)
- [ ] **File upload limits are enforced** (50MB max file size, 10 files per request)
- [ ] **S3 bucket is private** with appropriate IAM policies
- [ ] **Stripe webhook signatures are verified** via `STRIPE_WEBHOOK_SECRET`
- [ ] **Docker containers run as non-root** (`USER labflow` in Dockerfiles)
- [ ] **Dependency vulnerabilities are checked** (`pnpm audit`)

### Network Security

```
Internet → [Firewall: 80, 443 only] → Nginx → [Internal network] → API/Web/Portal
                                                         ↓
                                              PostgreSQL, Redis, MinIO
                                              (no external access)
```

Ensure only ports 80 and 443 are exposed to the internet. All backing services (PostgreSQL, Redis, MinIO) should be on an internal-only network.

---

## Scaling

### Horizontal Scaling

The API, Web, and Portal services are stateless and can be scaled horizontally:

```bash
# Scale API to 3 replicas
docker compose -f docker-compose.prod.yml up -d --scale api=3
```

When running multiple API replicas behind a load balancer, ensure:
- **Sessions/JWT:** Already stateless (JWT-based auth)—no sticky sessions needed.
- **Rate limiting:** Uses Redis, so rate limits are shared across replicas.
- **BullMQ workers:** Multiple workers will automatically distribute jobs.
- **File uploads:** Go to S3/MinIO (shared storage), not local disk.

### Vertical Scaling Guidelines

| Service | Minimum | Recommended (Production) |
|---|---|---|
| API | 512MB RAM, 0.5 vCPU | 1GB RAM, 1 vCPU per replica |
| Web | 512MB RAM, 0.5 vCPU | 1GB RAM, 1 vCPU |
| Portal | 256MB RAM, 0.25 vCPU | 512MB RAM, 0.5 vCPU |
| PostgreSQL | 1GB RAM | 4GB+ RAM, SSD storage |
| Redis | 256MB RAM | 512MB RAM |

### Database Scaling

- Enable **read replicas** for PostgreSQL if read queries become a bottleneck.
- Use **connection pooling** (PgBouncer) if connection counts grow with replicas.
- Add database indexes as query patterns emerge (check `prisma/schema.prisma` for `@@index` directives).

---

## Troubleshooting

### Common Issues

**API won't start: "Cannot find module '@labflow/db'"**
```bash
# Regenerate the Prisma client
pnpm db:generate
```

**Database connection refused**
```bash
# Check if PostgreSQL is running
docker compose ps postgres
docker compose logs postgres

# Verify the DATABASE_URL is correct
docker compose exec api printenv DATABASE_URL
```

**Migration fails with "database does not exist"**
```bash
# Create the database manually
docker exec -it labflow-postgres createdb -U labflow labflow
```

**Port conflicts**
```bash
# Check what's using a port
lsof -i :4000
# Or change ports in .env
API_PORT=4001
```

**CORS errors in browser**
- Verify `WEB_URL`, `PORTAL_URL`, and `API_URL` match your actual deployment URLs.
- Check `apps/api/src/plugins/cors.ts` for allowed origins.

**"ECONNREFUSED" to Redis**
```bash
# Check Redis is running and accessible
docker compose exec redis redis-cli ping
# If using a password, ensure REDIS_URL includes it:
# redis://:yourpassword@redis:6379
```

**Next.js build fails with "Module not found: @labflow/shared"**
```bash
# Build shared packages first
pnpm --filter @labflow/shared build
# Then rebuild
pnpm --filter @labflow/web build
```

### Useful Commands

```bash
# View all service logs
docker compose -f docker-compose.prod.yml logs -f

# Restart a single service
docker compose -f docker-compose.prod.yml restart api

# Open a shell in a container
docker compose -f docker-compose.prod.yml exec api sh

# Check database connectivity from the API container
docker compose -f docker-compose.prod.yml exec api \
  node -e "const {prisma} = require('@labflow/db'); prisma.\$queryRaw\`SELECT 1\`.then(console.log)"

# Monitor Redis
docker compose -f docker-compose.prod.yml exec redis redis-cli -a $REDIS_PASSWORD monitor
```
