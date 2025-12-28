# Architecture

System architecture overview for Potatoes.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                     │
├─────────────────────┬─────────────────────┬─────────────────────────────┤
│    Web Browser      │    Mobile App       │    PWA (iOS/Android)        │
│    (Next.js)        │    (Expo)           │    (Next.js)                │
│    Port 3000        │    Expo Go          │    Installed                │
└─────────┬───────────┴─────────┬───────────┴──────────────┬──────────────┘
          │                     │                          │
          └─────────────────────┼──────────────────────────┘
                                │ HTTPS
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKEND API                                      │
│                     FastAPI (Port 8000)                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ Auth Router │  │Recipe Router│  │Meal Planner │  │Social Router│    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │Google OAuth │  │Collections  │  │Ingredients  │  │   Search    │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                     │
│  │Admin Router │  │Notifications│  │    Tags     │                     │
│  └─────────────┘  └─────────────┘  └─────────────┘                     │
├─────────────────────────────────────────────────────────────────────────┤
│                          SERVICES                                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │  JWT Auth       │  │  Email Service  │  │  Image Upload   │         │
│  │  (python-jose)  │  │  (fastapi-mail) │  │  (Cloudinary)   │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│  ┌─────────────────┐                                                    │
│  │  Recipe Import  │                                                    │
│  │  (Gemini AI)    │                                                    │
│  └─────────────────┘                                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          DATABASE                                        │
│                    SQLite / PostgreSQL                                   │
│                    (SQLAlchemy 2.0 ORM)                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Overview

### Frontend (Next.js)

| Component | Purpose |
|-----------|---------|
| **App Router** | File-based routing with `src/app/` structure |
| **Zustand Store** | Global state management (auth, user data) |
| **API Client** | Axios instance with interceptors for auth |
| **Middleware** | Route protection, auth redirects |

**Key Files:**
- `src/app/` - Page components (App Router)
- `src/store/useStore.ts` - Zustand global state
- `src/lib/api.ts` - Axios API client
- `src/middleware.ts` - Auth protection

### Backend (FastAPI)

| Component | Purpose |
|-----------|---------|
| **Routers** | API endpoint handlers organized by domain |
| **Models** | SQLAlchemy ORM models |
| **Schemas** | Pydantic request/response validation |
| **Auth** | JWT token management, password hashing |
| **Services** | Email sending, external integrations |

**Key Files:**
- `main.py` - FastAPI app entry point
- `models.py` - Database models
- `schemas.py` - Pydantic schemas
- `auth.py` - Authentication logic
- `routers/` - API endpoints
- `services/` - Email, image upload, recipe import, notifications

### Mobile (Expo)

| Component | Purpose |
|-----------|---------|
| **React Navigation** | Native stack and tab navigation |
| **Zustand** | State management (shared patterns with web) |
| **Expo SecureStore** | Secure token storage |
| **NativeWind** | Tailwind-style styling |

## Data Flow

### Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────▶│  Login   │────▶│  Backend │────▶│ Database │
│          │     │  Form    │     │  /login  │     │  Users   │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                        │
                                        ▼
                              ┌──────────────────┐
                              │ JWT Access Token │
                              │ (15 min expiry)  │
                              │ Refresh Token    │
                              │ (7 day expiry)   │
                              └──────────────────┘
```

### API Request Flow

```
1. Client makes request with Authorization: Bearer <token>
2. FastAPI dependency extracts and validates JWT
3. If expired, client uses refresh token to get new access token
4. Request reaches router handler
5. Handler queries database via SQLAlchemy
6. Response serialized via Pydantic schema
7. JSON response returned to client
```

## Infrastructure

### Local Development

```
docker-compose up
├── backend (port 8000)
│   └── Hot reload via uvicorn --reload
└── frontend (port 3000)
    └── Hot reload via Next.js dev server
```

### Production (Fly.io)

```
GitHub Push to main
        │
        ▼
GitHub Actions
├── Deploy Backend ──▶ potatoes-backend.fly.dev
│   └── Volume: /data (SQLite persistence)
└── Deploy Frontend ─▶ potatoes-frontend.fly.dev
```

## Security Architecture

| Layer | Protection |
|-------|------------|
| **Transport** | HTTPS enforced (Fly.io) |
| **Authentication** | JWT with short-lived access tokens |
| **Token Storage** | Refresh tokens in DB, can be revoked |
| **Passwords** | bcrypt hashing via passlib |
| **OAuth** | Google OAuth 2.0 with PKCE |
| **API** | CORS configured for frontend origin |

## Scalability Considerations

| Current | Future Options |
|---------|----------------|
| SQLite (single file) | PostgreSQL for multi-instance |
| Single Fly.io machine | Horizontal scaling with shared DB |
| In-memory caching | Redis for session/cache |
| Cloudinary (images) | Already scalable, no changes needed |
