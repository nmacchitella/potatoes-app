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
| **Backend** | FastAPI, SQLAlchemy 2.0, SQLite/PostgreSQL, JWT auth |
| **Mobile** | React Native, Expo 54, NativeWind |
| **Infrastructure** | Fly.io, GitHub Actions, Docker |

## Quick Start

```bash
# Clone and start with Docker
docker-compose up
```

**Access:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

For manual setup, see [Local Development Guide](documentation/02-local-development.md).

## Project Structure

```
potatoes/
├── backend/           # FastAPI application
├── frontend/          # Next.js web application
├── mobile/            # React Native/Expo app
├── documentation/     # Technical documentation
└── docker-compose.yml
```

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](documentation/01-architecture.md) | System overview, component diagram |
| [Local Development](documentation/02-local-development.md) | Setup guide, seeding data |
| [Environment Variables](documentation/03-environment.md) | All env vars explained |
| [Auth System](documentation/04-auth-system.md) | JWT, OAuth, security |
| [Database Schema](documentation/05-database.md) | Models and relationships |
| [API Reference](documentation/06-api-reference.md) | Endpoint documentation |
| [Deployment](documentation/07-deployment.md) | CI/CD, Fly.io setup |
| [Integrations](documentation/08-integrations.md) | Google OAuth, SMTP setup |
| [Mobile App](documentation/09-mobile.md) | Expo/React Native |

## License

Private and proprietary. All rights reserved.

---

**Built by Nicola Macchitella**
