# Local Development

Setting up your local development environment for Potatoes.

## Prerequisites

- **Python 3.11+** - Backend runtime
- **Node.js 18+** - Frontend runtime
- **Git** - Version control
- **Docker** (optional) - For containerized development

## Quick Start

### Option 1: Docker Compose (Recommended)

The fastest way to get everything running:

```bash
# Clone the repository
git clone <repo-url>
cd potatoes

# Start all services
docker-compose up
```

**Access:**
- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Option 2: Manual Setup

#### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
source venv/bin/activate  # macOS/Linux
# or
venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env

# Start development server
uvicorn main:app --reload --port 8000
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Create environment file
echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api" > .env.local

# Start development server
npm run dev
```

#### Mobile (Optional)

```bash
cd mobile

# Install dependencies
npm install

# Start Expo development server
npm start

# Then press:
# - 'i' for iOS Simulator
# - 'a' for Android Emulator
# - Scan QR code with Expo Go app for physical device
```

## Development Workflow

### Database

The database is auto-created on first run. To reset:

```bash
# Remove the database file
rm backend/potatoes.db

# Restart the backend - tables auto-create
uvicorn main:app --reload --port 8000
```

### Seeding Test Data

```bash
cd backend
source venv/bin/activate

# Create test users with recipes and relationships
python seed_users.py
```

This creates 5 test accounts:

| Email | Username | Password |
|-------|----------|----------|
| alice@example.com | @alicecooks | password123 |
| bob@example.com | @chefbob | password123 |
| carol@example.com | @carolskitchen | password123 |
| david@example.com | @davidcooks | password123 |
| emma@example.com | @emmaeats | password123 |

### Creating an Admin User

```bash
cd backend
source venv/bin/activate
python create_admin.py admin@example.com
```

Or set `ADMIN_EMAIL` in your `.env` file - that email will be auto-promoted to admin on startup.

## Project Structure

```
potatoes/
├── backend/
│   ├── main.py              # FastAPI entry point
│   ├── models.py            # SQLAlchemy models
│   ├── schemas.py           # Pydantic schemas
│   ├── auth.py              # JWT authentication
│   ├── config.py            # Settings from env vars
│   ├── database.py          # DB connection
│   ├── routers/             # API endpoints
│   │   ├── auth_router.py
│   │   ├── google_auth.py
│   │   ├── recipe_router.py
│   │   ├── collection_router.py
│   │   ├── meal_plan_router.py
│   │   ├── social_router.py
│   │   └── ...
│   └── services/
│       └── email_service.py
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router pages
│   │   ├── components/      # React components
│   │   ├── store/           # Zustand state
│   │   ├── lib/             # API client, utilities
│   │   └── types/           # TypeScript types
│   └── public/              # Static assets
├── mobile/
│   ├── src/
│   │   ├── screens/         # Screen components
│   │   ├── components/      # Shared components
│   │   ├── navigation/      # React Navigation setup
│   │   └── store/           # Zustand state
│   └── App.tsx              # Entry point
└── docker-compose.yml
```

## Common Tasks

### Running Tests

```bash
# Backend (if tests exist)
cd backend
pytest

# Frontend
cd frontend
npm run lint
```

### Checking Logs

```bash
# Docker logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Or view uvicorn output directly in terminal
```

### Rebuilding Containers

```bash
# Rebuild after dependency changes
docker-compose build --no-cache
docker-compose up
```

## IDE Setup

### VSCode Extensions (Recommended)

- **Python** - Python language support
- **Pylance** - Python type checking
- **ESLint** - JavaScript/TypeScript linting
- **Tailwind CSS IntelliSense** - Tailwind autocomplete
- **Prettier** - Code formatting

### Settings

```json
{
  "python.defaultInterpreterPath": "./backend/venv/bin/python",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[python]": {
    "editor.defaultFormatter": "ms-python.python"
  }
}
```

## Troubleshooting

### Port Already in Use

```bash
# Find and kill process on port 8000
lsof -i :8000
kill -9 <PID>

# Or use different port
uvicorn main:app --reload --port 8001
```

### Module Not Found (Python)

```bash
# Ensure virtual environment is activated
source backend/venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt
```

### CORS Errors

Check that `FRONTEND_URL` in backend `.env` matches your frontend URL:
```env
FRONTEND_URL=http://localhost:3000
```

### Database Locked (SQLite)

SQLite doesn't handle concurrent writes well. If you see "database is locked":
1. Stop all backend processes
2. Restart the server

For production, use PostgreSQL instead.
