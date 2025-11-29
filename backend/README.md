# Potatoes Backend

FastAPI backend for the Potatoes family kitchen application.

## Setup

```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # Edit with your credentials
uvicorn main:app --reload --port 8000
```

**Access:**
- API: http://localhost:8000
- Docs: http://localhost:8000/docs

## Project Structure

```
backend/
├── main.py              # FastAPI app entry point
├── database.py          # SQLAlchemy engine & session
├── models.py            # Database models
├── schemas.py           # Pydantic request/response schemas
├── auth.py              # JWT authentication logic
├── routers/
│   ├── auth_router.py   # Auth endpoints (login, register, profile)
│   └── google_auth.py   # Google OAuth flow
├── services/
│   └── email_service.py # Email verification & password reset
├── requirements.txt     # Python dependencies
├── Dockerfile           # Production container
├── fly.toml             # Fly.io production config
└── fly.dev.toml         # Fly.io development config
```

## Database Models

| Model | Description |
|-------|-------------|
| `User` | User accounts with email/OAuth auth |
| `RefreshToken` | JWT refresh tokens |
| `VerificationToken` | Email verification & password reset |
| `Notification` | User notifications |
| `UserFollow` | User follow relationships |

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login-json` | Login with email/password |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Revoke refresh token |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/profile` | Update profile |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password |
| GET | `/api/auth/verify-email` | Verify email |
| GET | `/api/auth/google/login` | Initiate Google OAuth |
| GET | `/api/auth/google/callback` | Google OAuth callback |

## Environment Variables

```env
DATABASE_URL=sqlite:///./potatoes.db
SECRET_KEY=<openssl-rand-hex-32>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15

# Google OAuth
GOOGLE_CLIENT_ID=<google-cloud-console>
GOOGLE_CLIENT_SECRET=<google-cloud-console>

# URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000

# Email (SMTP)
MAIL_USERNAME=<smtp-user>
MAIL_PASSWORD=<smtp-pass>
MAIL_FROM=<sender-email>
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_STARTTLS=True
MAIL_SSL_TLS=False
```

## Authentication

JWT-based authentication with refresh tokens:

- **Access token**: 15 minutes, stored in frontend memory
- **Refresh token**: 7 days, stored in localStorage + database
- **Token rotation**: New refresh token issued on each refresh
- **Password hashing**: bcrypt via passlib

Include access token in requests:
```
Authorization: Bearer <access_token>
```

## Deployment

### Fly.io

```bash
# Production
flyctl deploy

# Development
flyctl deploy --config fly.dev.toml
```

### Set Secrets

```bash
fly secrets set SECRET_KEY="..." -a potatoes-backend
fly secrets set DATABASE_URL="sqlite:////data/potatoes.db" -a potatoes-backend
fly secrets set GOOGLE_CLIENT_ID="..." -a potatoes-backend
# ... other secrets
```

## Development

### Database Reset

```bash
rm potatoes.db
python -c "from database import Base, engine; Base.metadata.create_all(engine)"
```

## Dependencies

Key packages:
- `fastapi` - Web framework
- `uvicorn` - ASGI server
- `sqlalchemy` - ORM
- `python-jose` - JWT tokens
- `passlib[bcrypt]` - Password hashing
- `authlib` - OAuth2
- `httpx` - Async HTTP client
- `fastapi-mail` - Email sending

See `requirements.txt` for full list.
