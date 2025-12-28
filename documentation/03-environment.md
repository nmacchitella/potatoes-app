# Environment Variables

Complete reference for all environment variables used in Potatoes.

## Backend Variables

Located in `backend/.env` (copy from `.env.example`).

### Database

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `sqlite:///./potatoes.db` | Database connection string. Use `sqlite:///./potatoes.db` for local dev, `sqlite:////data/potatoes.db` for Fly.io with volume mount. |

**Examples:**
```env
# Local SQLite
DATABASE_URL=sqlite:///./potatoes.db

# Fly.io with volume mount
DATABASE_URL=sqlite:////data/potatoes.db

# PostgreSQL (future)
DATABASE_URL=postgresql://user:pass@host:5432/potatoes
```

### Authentication

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SECRET_KEY` | Yes | - | JWT signing key. Generate with `openssl rand -hex 32`. **Never commit this.** |
| `ALGORITHM` | No | `HS256` | JWT signing algorithm. Keep as HS256. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `15` | Access token lifetime in minutes. Short for security. |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | `7` | Refresh token lifetime in days. |

**Generate a secret key:**
```bash
openssl rand -hex 32
# Output: a1b2c3d4e5f6...64 characters
```

### URLs

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FRONTEND_URL` | Yes | `http://localhost:3000` | Frontend URL for CORS and email links |
| `BACKEND_URL` | Yes | `http://localhost:8000` | Backend URL for OAuth callbacks |

**Production values:**
```env
FRONTEND_URL=https://potatoes-frontend.fly.dev
BACKEND_URL=https://potatoes-backend.fly.dev
```

### Google OAuth

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_CLIENT_ID` | No | - | Google OAuth client ID. Optional - app works without OAuth. |
| `GOOGLE_CLIENT_SECRET` | No | - | Google OAuth client secret |

See [Integrations Guide](08-integrations.md) for setup instructions.

### Email (SMTP)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MAIL_USERNAME` | No | - | SMTP username (often your email) |
| `MAIL_PASSWORD` | No | - | SMTP password or app password |
| `MAIL_FROM` | No | `noreply@potatoes.app` | Sender email address |
| `MAIL_SERVER` | No | `smtp.gmail.com` | SMTP server hostname |
| `MAIL_PORT` | No | `587` | SMTP port (587 for TLS, 465 for SSL) |
| `MAIL_STARTTLS` | No | `True` | Use STARTTLS encryption |
| `MAIL_SSL_TLS` | No | `False` | Use SSL/TLS (set True for port 465) |

**Gmail setup:**
```env
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=abcd-efgh-ijkl-mnop  # App password, not regular password
MAIL_FROM=your-email@gmail.com
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_STARTTLS=True
MAIL_SSL_TLS=False
```

See [Integrations Guide](08-integrations.md) for Gmail app password setup.

### Admin

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADMIN_EMAIL` | No | - | Email to auto-promote to admin on startup |

### Image Upload

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CLOUDINARY_CLOUD_NAME` | No | - | Cloudinary cloud name for image uploads |
| `CLOUDINARY_API_KEY` | No | - | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | No | - | Cloudinary API secret |

---

## Frontend Variables

Located in `frontend/.env.local`.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | - | Backend API URL. Must include `/api` suffix. |

**Local development:**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

**Production:**
```env
NEXT_PUBLIC_API_URL=https://potatoes-backend.fly.dev/api
```

> **Note:** Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. Never put secrets here.

---

## Mobile Variables

The mobile app uses hardcoded API URLs in the code. Update `mobile/src/lib/api.ts` to change the backend URL.

---

## Environment File Templates

### Backend `.env` (Local Development)

```env
# Database
DATABASE_URL=sqlite:///./potatoes.db

# JWT Settings
SECRET_KEY=your-generated-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15

# URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000

# Google OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Email (optional)
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM=noreply@potatoes.app
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_STARTTLS=True
MAIL_SSL_TLS=False

# Admin (optional)
ADMIN_EMAIL=
```

### Frontend `.env.local` (Local Development)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

---

## Production Secrets (Fly.io)

Set secrets via CLI (never commit these):

```bash
# Backend secrets
fly secrets set SECRET_KEY="your-production-secret" -a potatoes-backend
fly secrets set GOOGLE_CLIENT_ID="..." -a potatoes-backend
fly secrets set GOOGLE_CLIENT_SECRET="..." -a potatoes-backend
fly secrets set MAIL_USERNAME="..." -a potatoes-backend
fly secrets set MAIL_PASSWORD="..." -a potatoes-backend

# Frontend (set at build time via fly.toml or Dockerfile ARG)
# NEXT_PUBLIC_API_URL is set in fly.toml [env] section
```

See [Deployment Guide](07-deployment.md) for full production setup.
