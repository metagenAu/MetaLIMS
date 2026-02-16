#!/bin/bash
set -euo pipefail

# ============================================================
# LabFlow LIMS - First-time Development Setup
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()    { echo -e "${BLUE}[INFO]${NC}  $1"; }
success() { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; }

echo ""
echo "============================================================"
echo "  LabFlow LIMS - Development Environment Setup"
echo "============================================================"
echo ""

# --------------------------------------------------
# 1. Check prerequisites
# --------------------------------------------------

info "Checking prerequisites..."

# Node.js >= 20
if ! command -v node &> /dev/null; then
  error "Node.js is not installed. Please install Node.js >= 20."
  echo "  https://nodejs.org/"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  error "Node.js >= 20 is required. Found: $(node -v)"
  exit 1
fi
success "Node.js $(node -v)"

# pnpm
if ! command -v pnpm &> /dev/null; then
  warn "pnpm is not installed. Installing via corepack..."
  corepack enable
  corepack prepare pnpm@9.12.0 --activate
fi

if command -v pnpm &> /dev/null; then
  success "pnpm $(pnpm -v)"
else
  error "Failed to install pnpm. Install manually: npm install -g pnpm"
  exit 1
fi

# Docker
if ! command -v docker &> /dev/null; then
  error "Docker is not installed. Please install Docker Desktop."
  echo "  https://www.docker.com/products/docker-desktop/"
  exit 1
fi
success "Docker $(docker --version | awk '{print $3}' | sed 's/,//')"

# docker-compose (v2 via docker compose, or legacy docker-compose)
COMPOSE_CMD=""
if docker compose version &> /dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
  COMPOSE_CMD="docker-compose"
else
  error "docker-compose is not available. Please install Docker Compose."
  exit 1
fi
success "Docker Compose available ($COMPOSE_CMD)"

echo ""

# --------------------------------------------------
# 2. Copy .env.example -> .env if not present
# --------------------------------------------------

info "Setting up environment variables..."

if [ -f "$ROOT_DIR/.env" ]; then
  warn ".env file already exists - skipping copy"
else
  if [ -f "$ROOT_DIR/.env.example" ]; then
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
    success "Copied .env.example -> .env"
  else
    error ".env.example not found at $ROOT_DIR/.env.example"
    exit 1
  fi
fi

echo ""

# --------------------------------------------------
# 3. Start Docker services
# --------------------------------------------------

info "Starting Docker services (PostgreSQL, Redis, MinIO, Mailhog)..."

cd "$ROOT_DIR"
$COMPOSE_CMD up -d

# Wait for PostgreSQL to be ready
info "Waiting for PostgreSQL to be ready..."
RETRIES=30
until docker exec labflow-postgres pg_isready -U labflow -q 2>/dev/null; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -le 0 ]; then
    error "PostgreSQL did not become ready in time"
    exit 1
  fi
  sleep 1
done
success "PostgreSQL is ready"

# Wait for Redis to be ready
info "Waiting for Redis to be ready..."
RETRIES=15
until docker exec labflow-redis redis-cli ping 2>/dev/null | grep -q PONG; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -le 0 ]; then
    error "Redis did not become ready in time"
    exit 1
  fi
  sleep 1
done
success "Redis is ready"

echo ""

# --------------------------------------------------
# 4. Install dependencies
# --------------------------------------------------

info "Installing dependencies with pnpm..."

cd "$ROOT_DIR"
pnpm install

success "Dependencies installed"

echo ""

# --------------------------------------------------
# 5. Generate Prisma client
# --------------------------------------------------

info "Generating Prisma client..."

cd "$ROOT_DIR"
pnpm db:generate

success "Prisma client generated"

echo ""

# --------------------------------------------------
# 6. Run database migrations
# --------------------------------------------------

info "Running database migrations..."

cd "$ROOT_DIR/packages/db"
npx prisma migrate dev --name init --skip-generate 2>/dev/null || npx prisma db push --accept-data-loss

success "Database migrations applied"

echo ""

# --------------------------------------------------
# 7. Seed the database
# --------------------------------------------------

info "Seeding the database..."

cd "$ROOT_DIR"
pnpm db:seed

success "Database seeded"

echo ""

# --------------------------------------------------
# Done!
# --------------------------------------------------

echo "============================================================"
echo -e "${GREEN}  LabFlow LIMS setup complete!${NC}"
echo "============================================================"
echo ""
echo "  Services:"
echo "    PostgreSQL:  postgresql://labflow:labflow@localhost:5432/labflow"
echo "    Redis:       redis://localhost:6379"
echo "    MinIO:       http://localhost:9000  (console: http://localhost:9001)"
echo "    Mailhog:     http://localhost:8025"
echo ""
echo "  Commands:"
echo "    pnpm dev          Start all dev servers"
echo "    pnpm build        Build all packages"
echo "    pnpm lint         Lint all packages"
echo "    pnpm test         Run tests"
echo "    pnpm db:studio    Open Prisma Studio"
echo ""
echo "  Default Login:"
echo "    Email:    admin@labflow.dev"
echo "    Password: password123"
echo ""
echo "  Web App:     http://localhost:3000"
echo "  API Server:  http://localhost:4000"
echo "  Portal:      http://localhost:3001"
echo ""
