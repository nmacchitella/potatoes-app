# Potatoes Backend

FastAPI backend for the Potatoes application.

## Quick Start

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

**Access:** http://localhost:8000/docs

## Documentation

See the main [documentation](../documentation/) for detailed guides:

- [Local Development](../documentation/02-local-development.md) - Full setup, seeding data
- [Environment Variables](../documentation/03-environment.md) - All env vars explained
- [Auth System](../documentation/04-auth-system.md) - JWT, OAuth implementation
- [Database Schema](../documentation/05-database.md) - Models and relationships
- [API Reference](../documentation/06-api-reference.md) - Endpoint documentation
- [Deployment](../documentation/07-deployment.md) - Fly.io setup
