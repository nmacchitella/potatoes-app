# Deployment

Deploying Potatoes to production using Fly.io and GitHub Actions.

## Overview

| Environment | Backend | Frontend |
|-------------|---------|----------|
| Production | potatoes-backend.fly.dev | potatoes-frontend.fly.dev |
| Development | potatoes-backend-dev.fly.dev | potatoes-frontend-dev.fly.dev |

## Infrastructure

### Fly.io Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Fly.io                                  │
├─────────────────────────────┬───────────────────────────────────┤
│     potatoes-backend        │      potatoes-frontend            │
│     ┌─────────────────┐     │      ┌─────────────────┐          │
│     │  Docker         │     │      │  Docker         │          │
│     │  FastAPI        │     │      │  Next.js        │          │
│     │  Port 8000      │     │      │  Port 3000      │          │
│     └────────┬────────┘     │      └─────────────────┘          │
│              │              │                                    │
│              ▼              │                                    │
│     ┌─────────────────┐     │                                    │
│     │  Volume Mount   │     │                                    │
│     │  /data          │     │                                    │
│     │  (SQLite DB)    │     │                                    │
│     └─────────────────┘     │                                    │
└─────────────────────────────┴───────────────────────────────────┘
```

## CI/CD Pipeline

### GitHub Actions Workflows

There are three workflow files in `.github/workflows/`:

| File | Trigger | Deployment Order |
|------|---------|------------------|
| `deploy.yml` | Push to `main` | Parallel (backend & frontend simultaneously) |
| `deploy-prod.yml` | Push to `main` | Sequential (backend first, then frontend) |
| `deploy-dev.yml` | Push to `development` | Sequential (backend first, then frontend) |

> **Note:** Both `deploy.yml` and `deploy-prod.yml` trigger on `main`. You may want to disable one to avoid duplicate deployments.

#### Production Workflow - Sequential (`.github/workflows/deploy-prod.yml`)

```yaml
name: Deploy to Production

on:
  push:
    branches:
      - main

jobs:
  deploy-backend-prod:
    name: Deploy Backend to Production
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}

  deploy-frontend-prod:
    name: Deploy Frontend to Production
    runs-on: ubuntu-latest
    needs: deploy-backend-prod  # Wait for backend first
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

#### Production Workflow - Parallel (`.github/workflows/deploy.yml`)

Deploys backend and frontend simultaneously (faster but no dependency guarantee):

```yaml
name: Deploy to Fly.io

on:
  push:
    branches:
      - main

jobs:
  deploy-backend:
    name: Deploy Backend
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}

  deploy-frontend:
    name: Deploy Frontend
    runs-on: ubuntu-latest
    # No 'needs' - runs in parallel with backend
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

#### Development Workflow (`.github/workflows/deploy-dev.yml`)

Deploys to dev environment using `fly.dev.toml`:

```yaml
name: Deploy to Development

on:
  push:
    branches:
      - development

jobs:
  deploy-backend-dev:
    # Uses: flyctl deploy --config fly.dev.toml --remote-only

  deploy-frontend-dev:
    needs: deploy-backend-dev
    # Uses: flyctl deploy --config fly.dev.toml --remote-only
```

### Branch Workflow

| Branch | Deploys To | Notes |
|--------|------------|-------|
| `main` | Production | Two workflows: `deploy.yml` (parallel) and `deploy-prod.yml` (sequential) |
| `development` | Dev environment | Sequential via `deploy-dev.yml` (backend first) |

## Initial Setup

### 1. Install Fly CLI

```bash
# macOS
brew install flyctl

# Or download from https://fly.io/docs/flyctl/install/
```

### 2. Authenticate

```bash
fly auth login
```

### 3. Create Apps

```bash
# Backend
cd backend
fly apps create potatoes-backend

# Frontend
cd frontend
fly apps create potatoes-frontend
```

### 4. Create Volume (Backend)

SQLite needs persistent storage:

```bash
fly volumes create potatoes_data --size 1 --region iad -a potatoes-backend
```

### 5. Set Secrets

```bash
# Backend secrets
fly secrets set SECRET_KEY="$(openssl rand -hex 32)" -a potatoes-backend
fly secrets set GOOGLE_CLIENT_ID="your-client-id" -a potatoes-backend
fly secrets set GOOGLE_CLIENT_SECRET="your-client-secret" -a potatoes-backend
fly secrets set MAIL_USERNAME="your-email@gmail.com" -a potatoes-backend
fly secrets set MAIL_PASSWORD="your-app-password" -a potatoes-backend
fly secrets set ADMIN_EMAIL="admin@example.com" -a potatoes-backend
```

### 6. Configure GitHub Actions

Add repository secret:
1. Go to GitHub repo → Settings → Secrets → Actions
2. Add `FLY_API_TOKEN` with your Fly.io API token

Get token:
```bash
fly tokens create deploy -x 999999h
```

## Configuration Files

### Backend fly.toml

```toml
app = "potatoes-backend"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  DATABASE_URL = "sqlite:////data/potatoes.db"
  ALGORITHM = "HS256"
  ACCESS_TOKEN_EXPIRE_MINUTES = "15"
  REFRESH_TOKEN_EXPIRE_DAYS = "7"
  FRONTEND_URL = "https://potatoes-frontend.fly.dev"
  BACKEND_URL = "https://potatoes-backend.fly.dev"
  LOG_LEVEL = "INFO"

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  memory = '512mb'
  cpu_kind = 'shared'
  cpus = 1

[mounts]
  source = "potatoes_data"
  destination = "/data"
```

### Frontend fly.toml

```toml
app = "potatoes-frontend"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  memory = '256mb'
  cpu_kind = 'shared'
  cpus = 1
```

### Development fly.dev.toml Files

Development environments use separate config files:

**Backend (fly.dev.toml):**
```toml
app = "potatoes-backend-dev"
primary_region = "iad"

[mounts]
  source = "potatoes_data_dev"  # Separate dev volume
  destination = "/data"

[[vm]]
  memory = '256mb'  # Smaller for dev
```

**Frontend (fly.dev.toml):**
```toml
app = "potatoes-frontend-dev"
primary_region = "iad"

[build.args]
  NEXT_PUBLIC_API_URL = "https://potatoes-backend-dev.fly.dev/api"
```

## Manual Deployment

### Deploy Both Apps

```bash
# Backend
cd backend
fly deploy

# Frontend
cd frontend
fly deploy
```

### Deploy to Dev Environment

```bash
fly deploy --config fly.dev.toml
```

## Secrets Management

### View Secrets

```bash
fly secrets list -a potatoes-backend
```

### Set Secret

```bash
fly secrets set KEY="value" -a potatoes-backend
```

### Remove Secret

```bash
fly secrets unset KEY -a potatoes-backend
```

### Required Secrets

| Secret | App | Required | Description |
|--------|-----|----------|-------------|
| `SECRET_KEY` | backend | Yes | JWT signing key |
| `GOOGLE_CLIENT_ID` | backend | No | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | backend | No | Google OAuth |
| `MAIL_USERNAME` | backend | No | SMTP username |
| `MAIL_PASSWORD` | backend | No | SMTP password |
| `ADMIN_EMAIL` | backend | No | Auto-admin email |
| `GEMINI_API_KEY` | backend | No | AI recipe parsing |
| `CLOUDINARY_CLOUD_NAME` | backend | No | Image uploads |
| `CLOUDINARY_API_KEY` | backend | No | Image uploads |
| `CLOUDINARY_API_SECRET` | backend | No | Image uploads |

## Monitoring

### View Logs

```bash
# Real-time logs
fly logs -a potatoes-backend

# Historical logs
fly logs -a potatoes-backend --since 1h
```

### Check Status

```bash
fly status -a potatoes-backend
fly status -a potatoes-frontend
```

### SSH Access

```bash
fly ssh console -a potatoes-backend
```

### Database Access

```bash
# SSH into machine
fly ssh console -a potatoes-backend

# Access SQLite
sqlite3 /data/potatoes.db
```

## Scaling

### Scale Machines

```bash
# Scale to 2 machines
fly scale count 2 -a potatoes-backend

# Check current scale
fly scale show -a potatoes-backend
```

### Scale Memory

```bash
fly scale memory 1024 -a potatoes-backend
```

### Regions

```bash
# Deploy to multiple regions
fly regions add lhr -a potatoes-backend

# List regions
fly regions list -a potatoes-backend
```

## Troubleshooting

### Machine Won't Start

```bash
# Check machine status
fly machine list -a potatoes-backend

# Restart machine
fly machine restart <machine-id> -a potatoes-backend
```

### Database Issues

```bash
# SSH and check database
fly ssh console -a potatoes-backend
ls -la /data/
sqlite3 /data/potatoes.db ".tables"
```

### Out of Memory

Increase VM memory:
```bash
fly scale memory 1024 -a potatoes-backend
```

### Deploy Fails

Check build logs:
```bash
fly deploy --remote-only --verbose
```

## Rollback

### View Releases

```bash
fly releases -a potatoes-backend
```

### Rollback to Previous

```bash
fly deploy --image registry.fly.io/potatoes-backend:v<version>
```

## Cost Optimization

- **auto_stop_machines:** Machines stop when idle
- **auto_start_machines:** Machines start on request
- **min_machines_running:** Set to 0 for dev, 1 for production
- **Shared CPU:** Cheapest option for low traffic
