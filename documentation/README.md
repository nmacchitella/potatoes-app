# Potatoes Documentation

Technical documentation for the Potatoes family kitchen application.

## Quick Links

| Document | Description |
|----------|-------------|
| [Architecture](01-architecture.md) | System overview, component diagram, data flow |
| [Local Development](02-local-development.md) | Setting up your development environment |
| [Environment Variables](03-environment.md) | All env vars with explanations |
| [Authentication System](04-auth-system.md) | JWT, OAuth, email verification flows |
| [Database Schema](05-database.md) | Models, relationships, ERD |
| [API Reference](06-api-reference.md) | Endpoint documentation with examples |
| [Deployment](07-deployment.md) | CI/CD, Fly.io, secrets management |
| [Integrations](08-integrations.md) | Google OAuth, SMTP setup |
| [Mobile App](09-mobile.md) | React Native/Expo documentation |

## Project Overview

**Potatoes** is a family kitchen app for organizing recipes, meal planning, and shopping lists.

### Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 14, React 18, TypeScript, Tailwind CSS, Zustand |
| **Backend** | FastAPI, SQLAlchemy 2.0, SQLite/PostgreSQL, JWT auth |
| **Mobile** | React Native, Expo 54, NativeWind |
| **Infrastructure** | Fly.io, GitHub Actions, Docker |

### Repository Structure

```
potatoes/
├── backend/           # FastAPI application
├── frontend/          # Next.js web application
├── mobile/            # React Native/Expo app
├── documentation/     # This documentation
├── docker-compose.yml # Local development
└── .github/workflows/ # CI/CD pipelines
```

## Getting Started

1. **New to the project?** Start with [Local Development](02-local-development.md)
2. **Setting up integrations?** See [Integrations](08-integrations.md) for Google OAuth and email setup
3. **Deploying?** Check [Deployment](07-deployment.md)

## Contributing

When updating documentation:
1. Keep information accurate and up-to-date
2. Include code examples where helpful
3. Update this index if adding new documents
