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

## Instruction Amount Backfill

After applying migrations, inspect existing recipes before writing scalable instruction amounts:

```bash
alembic upgrade head
python scripts/backfill_instruction_usages.py --dry-run
python scripts/backfill_instruction_usages.py --apply
```

Use repeated `--recipe-id ID` arguments or `--limit N` to process a subset. Apply mode records resumable progress and writes a JSON report. To remove generated templates and usages while preserving the original instruction prose:

```bash
python scripts/backfill_instruction_usages.py --clear
```

## Documentation

See the main [documentation](../documentation/) for detailed guides:

- [Local Development](../documentation/02-local-development.md) - Full setup, seeding data
- [Environment Variables](../documentation/03-environment.md) - All env vars explained
- [Auth System](../documentation/04-auth-system.md) - JWT, OAuth implementation
- [Database Schema](../documentation/05-database.md) - Models and relationships
- [API Reference](../documentation/06-api-reference.md) - Endpoint documentation
- [Deployment](../documentation/07-deployment.md) - Fly.io setup
