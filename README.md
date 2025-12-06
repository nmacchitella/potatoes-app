# Potatoes

A family kitchen app for organizing recipes, meal planning, and shopping lists.

## Features

- **Recipe Management** - Save and organize family recipes
- **Meal Planning** - Collaborate on weekly meal plans
- **Shopping Lists** - Auto-generate lists from meal plans
- **Family Sharing** - Invite family members to collaborate

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 14, React 18, TypeScript, Tailwind CSS, Zustand |
| **Backend** | FastAPI, SQLAlchemy 2.0, SQLite/PostgreSQL, JWT auth, Google OAuth |
| **Infrastructure** | Fly.io, GitHub Actions, Docker |

## Quick Start

### Option 1: Docker Compose (Recommended)

```bash
docker-compose up
```

Access:
- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Option 2: Manual Setup

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Edit with your credentials
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api" > .env.local
npm run dev
```

## Project Structure

```
potatoes/
├── backend/               # FastAPI application
│   ├── main.py            # App entry point
│   ├── models.py          # SQLAlchemy models
│   ├── schemas.py         # Pydantic schemas
│   ├── auth.py            # JWT authentication
│   ├── routers/           # API endpoints
│   ├── services/          # Email service
│   └── fly.toml           # Fly.io config
├── frontend/              # Next.js application
│   ├── src/app/           # App Router pages
│   ├── src/components/    # React components
│   ├── src/store/         # Zustand state
│   ├── src/lib/           # API client
│   └── fly.toml           # Fly.io config
├── docker-compose.yml     # Local development
└── .github/workflows/     # CI/CD pipelines
```

## Environment Variables

### Backend (.env)

```env
DATABASE_URL=sqlite:///./potatoes.db
SECRET_KEY=<generate-with-openssl-rand-hex-32>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15

# Google OAuth
GOOGLE_CLIENT_ID=<from-google-cloud-console>
GOOGLE_CLIENT_SECRET=<from-google-cloud-console>

# URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000

# Email (optional)
MAIL_USERNAME=<smtp-username>
MAIL_PASSWORD=<smtp-password>
MAIL_FROM=<sender-email>
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_STARTTLS=True
MAIL_SSL_TLS=False
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

## Deployment

### Branch Workflow

- `development` branch → deploys to **dev** environment
- `main` branch → deploys to **production** environment

### Fly.io Apps

| Environment | Backend | Frontend |
|-------------|---------|----------|
| Development | potatoes-backend-dev | potatoes-frontend-dev |
| Production | potatoes-backend | potatoes-frontend |

### Manual Deployment

```bash
# Deploy backend
cd backend && flyctl deploy

# Deploy frontend
cd frontend && flyctl deploy
```

### Setting Secrets

```bash
fly secrets set SECRET_KEY="your-key" -a potatoes-backend
fly secrets set DATABASE_URL="sqlite:////data/potatoes.db" -a potatoes-backend
# ... repeat for all required secrets
```

## Development

### Create Admin User

```bash
cd backend
python create_admin.py admin@example.com
```

### Seed Test Users

```bash
cd backend
source venv/bin/activate
python seed_users.py
```

This creates 5 test users with sample recipes and follow relationships:

| Email | Username | Privacy | Password |
|-------|----------|---------|----------|
| alice@example.com | @alicecooks | PUBLIC | password123 |
| bob@example.com | @chefbob | PUBLIC | password123 |
| carol@example.com | @carolskitchen | PRIVATE | password123 |
| david@example.com | @davidcooks | PRIVATE | password123 |
| emma@example.com | @emmaeats | PUBLIC | password123 |

Pre-configured relationships:
- Alice follows Bob (confirmed) and Carol (pending)
- Bob and Emma follow Alice (confirmed)
- Emma follows Bob (confirmed)

### Database Reset

```bash
rm backend/potatoes.db
```

### Monitoring

```bash
fly logs -a potatoes-backend
fly status -a potatoes-backend
```

## License

Private and proprietary. All rights reserved.

---

**Built by Nicola Macchitella**
