# Authentication System

Comprehensive documentation of Potatoes' authentication implementation.

## Overview

Potatoes uses a **JWT-based authentication system** with refresh tokens, supporting both email/password and Google OAuth login methods.

## Authentication Methods

| Method | Description |
|--------|-------------|
| **Email/Password** | Traditional registration with email verification |
| **Google OAuth** | One-click sign-in via Google account |

## Token Architecture

### Access Tokens

- **Type:** JWT (JSON Web Token)
- **Algorithm:** HS256
- **Lifetime:** 15 minutes (configurable)
- **Storage:** Frontend memory (Zustand store)
- **Payload:**
  ```json
  {
    "sub": "user@example.com",
    "exp": 1234567890
  }
  ```

### Refresh Tokens

- **Type:** Secure random string (32 bytes, URL-safe)
- **Lifetime:** 7 days
- **Storage:**
  - Frontend: localStorage
  - Backend: Database (RefreshToken model)
- **Features:**
  - Can be revoked (per-token or all user tokens)
  - Tracked in database for security audit

## Authentication Flows

### Email/Password Registration

```
┌──────────┐       ┌──────────┐       ┌──────────┐       ┌──────────┐
│  Client  │──────▶│ Register │──────▶│  Create  │──────▶│  Send    │
│          │       │ Endpoint │       │   User   │       │  Email   │
└──────────┘       └──────────┘       └──────────┘       └──────────┘
     │                                                         │
     │                                                         ▼
     │                                              ┌──────────────────┐
     │                                              │ Verification     │
     │                                              │ Token Created    │
     │                                              │ (24hr expiry)    │
     │                                              └──────────────────┘
     │
     │  User clicks email link
     ▼
┌──────────────┐      ┌──────────────┐
│ /verify-email│─────▶│ User marked  │
│   ?token=... │      │ is_verified  │
└──────────────┘      └──────────────┘
```

**API Endpoints:**
1. `POST /api/auth/register` - Create account
2. `GET /api/auth/verify-email?token=...` - Verify email

### Email/Password Login

```
┌──────────┐       ┌──────────┐       ┌──────────┐
│  Client  │──────▶│  Login   │──────▶│ Validate │
│  (form)  │       │ Endpoint │       │ Password │
└──────────┘       └──────────┘       └──────────┘
                                            │
                                            ▼
                                   ┌─────────────────┐
                                   │ Create Tokens   │
                                   │ - Access (JWT)  │
                                   │ - Refresh (DB)  │
                                   └─────────────────┘
                                            │
                                            ▼
                        ┌────────────────────────────────────┐
                        │ Response:                          │
                        │ {                                  │
                        │   access_token: "eyJ...",          │
                        │   refresh_token: "abc123...",      │
                        │   token_type: "bearer",            │
                        │   expires_in: 900                  │
                        │ }                                  │
                        └────────────────────────────────────┘
```

**API Endpoint:** `POST /api/auth/login-json`

### Google OAuth Flow

```
┌──────────┐       ┌──────────┐       ┌──────────┐       ┌──────────┐
│  Client  │──────▶│ /google/ │──────▶│  Google  │──────▶│  User    │
│  Click   │       │  login   │       │  Consent │       │ Approves │
└──────────┘       └──────────┘       └──────────┘       └──────────┘
                                                               │
                                                               ▼
┌────────────────┐       ┌──────────────┐       ┌──────────────────┐
│ /auth/callback │◀──────│   /google/   │◀──────│ Google Callback  │
│ (Frontend)     │       │   callback   │       │ with auth code   │
└────────────────┘       └──────────────┘       └──────────────────┘
        │                       │
        │                       ▼
        │              ┌─────────────────┐
        │              │ Exchange code   │
        │              │ for Google      │
        │              │ access token    │
        │              └─────────────────┘
        │                       │
        │                       ▼
        │              ┌─────────────────┐
        │              │ Fetch user info │
        │              │ Create/update   │
        │              │ user record     │
        │              └─────────────────┘
        │                       │
        │                       ▼
        │              ┌─────────────────┐
        │              │ Create JWT +    │
        │              │ refresh token   │
        │              └─────────────────┘
        │                       │
        ◀───────────────────────┘
        │  Redirect with tokens in URL
        ▼
┌─────────────────┐
│ Store tokens    │
│ in frontend     │
└─────────────────┘
```

**API Endpoints:**
1. `GET /api/auth/google/login` - Returns Google authorization URL
2. `GET /api/auth/google/callback?code=...` - Handles OAuth callback

### Token Refresh Flow

```
┌──────────┐       ┌──────────┐       ┌──────────┐
│  Client  │──────▶│ /refresh │──────▶│ Validate │
│          │       │ Endpoint │       │ Refresh  │
│ (expired │       │          │       │ Token    │
│  access  │       └──────────┘       └──────────┘
│  token)  │                                │
└──────────┘                                ▼
     ▲                            ┌─────────────────┐
     │                            │ Old token still │
     │                            │ valid & not     │
     │                            │ revoked?        │
     │                            └─────────────────┘
     │                                     │
     │                          ┌──────────┴──────────┐
     │                          │                     │
     │                          ▼                     ▼
     │                    ┌──────────┐          ┌──────────┐
     │                    │   Yes    │          │    No    │
     │                    │ Create   │          │  Return  │
     │                    │ new pair │          │  401     │
     │                    └──────────┘          └──────────┘
     │                          │
     └──────────────────────────┘
```

**API Endpoint:** `POST /api/auth/refresh`

### Password Reset Flow

```
1. User requests reset:     POST /api/auth/forgot-password
2. Email sent with token:   Link to /reset-password?token=...
3. User submits new pass:   POST /api/auth/reset-password
4. All refresh tokens revoked (force re-login)
```

## Implementation Details

### Password Hashing

```python
# Using bcrypt via passlib
def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(
        password.encode('utf-8'),
        bcrypt.gensalt()
    ).decode('utf-8')

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(
        plain.encode('utf-8'),
        hashed.encode('utf-8')
    )
```

### JWT Creation

```python
def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm="HS256")
```

### Protected Route Dependency

```python
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        email = payload.get("sub")
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(status_code=401)
        return user
    except JWTError:
        raise HTTPException(status_code=401)
```

## Frontend Integration

### Zustand Store

```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;

  setTokens: (access: string, refresh: string) => void;
  logout: () => void;
}
```

### Axios Interceptor

```typescript
// Request interceptor - attach token
api.interceptors.request.use((config) => {
  const token = useStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle 401, refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Try refresh token
      const refreshed = await refreshTokens();
      if (refreshed) {
        return api.request(error.config);
      }
      // Refresh failed, logout
      logout();
    }
    return Promise.reject(error);
  }
);
```

## Security Considerations

| Measure | Implementation |
|---------|----------------|
| **Short-lived access tokens** | 15 minutes - limits exposure if stolen |
| **Refresh token rotation** | New refresh token issued on each refresh |
| **Token revocation** | Refresh tokens stored in DB, can be revoked |
| **Password hashing** | bcrypt with salt |
| **OAuth state validation** | CSRF protection for OAuth flow |
| **HTTPS only** | Enforced in production (Fly.io) |

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Create new account |
| `/api/auth/login-json` | POST | Login with email/password |
| `/api/auth/refresh` | POST | Refresh access token |
| `/api/auth/logout` | POST | Revoke refresh token |
| `/api/auth/me` | GET | Get current user |
| `/api/auth/profile` | PUT | Update profile |
| `/api/auth/forgot-password` | POST | Request password reset |
| `/api/auth/reset-password` | POST | Set new password |
| `/api/auth/verify-email` | GET | Verify email address |
| `/api/auth/google/login` | GET | Get Google OAuth URL |
| `/api/auth/google/callback` | GET | OAuth callback handler |
