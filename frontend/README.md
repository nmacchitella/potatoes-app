# Potatoes Frontend

Next.js frontend for the Potatoes family kitchen application.

## Setup

```bash
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api" > .env.local
npm run dev
```

**Access:** http://localhost:3000

## Project Structure

```
frontend/
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── page.tsx               # Home page
│   │   ├── layout.tsx             # Root layout
│   │   ├── login/                 # Login/register page
│   │   ├── verify-email/          # Email verification
│   │   ├── forgot-password/       # Password reset request
│   │   ├── reset-password/        # Password reset form
│   │   ├── verification-required/ # Pending verification
│   │   └── auth/callback/         # OAuth callback
│   ├── store/
│   │   └── useStore.ts            # Zustand global state
│   ├── lib/
│   │   ├── api.ts                 # Axios API client
│   │   └── auth-storage.ts        # Token storage utilities
│   ├── types/
│   │   └── index.ts               # TypeScript interfaces
│   └── middleware.ts              # Route protection
├── next.config.js                 # Next.js configuration
├── tailwind.config.ts             # Tailwind CSS config
├── Dockerfile                     # Production build
├── fly.toml                       # Fly.io production config
└── fly.dev.toml                   # Fly.io development config
```

## Pages

| Route | Access | Description |
|-------|--------|-------------|
| `/` | Protected | Home page |
| `/login` | Public | Login and registration |
| `/verify-email` | Public | Email verification |
| `/forgot-password` | Public | Request password reset |
| `/reset-password` | Public | Set new password |
| `/verification-required` | Public | Pending verification |
| `/auth/callback` | Public | OAuth callback |

## State Management

Zustand store (`src/store/useStore.ts`):

```typescript
interface AppState {
  // Auth
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;

  // Actions
  setUser, logout, setTokens, fetchUserProfile, updateUserProfile
}
```

## Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

## Deployment

### Fly.io

```bash
# Production
flyctl deploy

# Development
flyctl deploy --config fly.dev.toml
```

### Build for Production

```bash
npm run build
npm run start
```

## Development

### Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Dependencies

Key packages:
- `next` - React framework
- `react` / `react-dom` - UI library
- `typescript` - Type safety
- `tailwindcss` - Styling
- `zustand` - State management
- `axios` - HTTP client

See `package.json` for full list.
