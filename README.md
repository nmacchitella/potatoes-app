# Potatoes

A kitchen app. Recipes, meal plans, grocery lists, the whole thing.

Built because every recipe app is either too much or not enough. This one is just right — if you're the kind of person who actually cooks and wants to share a kitchen with someone without shouting across the room "what are we eating Thursday?"

## What it does

- **Recipes.** Save them, tag them, draft them, publish them. Import from any URL or YouTube video — AI does the scraping so you don't have to.
- **Meal planning.** Drag recipes onto a calendar. Breakfast, lunch, dinner, snack. Share calendars with your people.
- **Grocery lists.** Auto-generated from your meal plan. Shareable via link so someone else can do the shopping.
- **Partner mode.** Link with another person. See each other's entire library. Built for couples, roommates, families — anyone sharing a fridge.
- **Collections.** Curate recipe lists. Give viewer or editor access.
- **Social.** Follow people, discover recipes, fork the ones you like.
- **Claude integration.** MCP server baked in. Talk to your kitchen through Claude — search recipes, plan meals, manage groceries, all conversational.
- **PWA + Mobile.** Install it on your phone from the browser, or use the native app.

## Stack

| | |
|---|---|
| Backend | FastAPI, SQLAlchemy, SQLite, Alembic |
| Frontend | Next.js 14, TypeScript, Tailwind, Zustand |
| Mobile | React Native, Expo, NativeWind |
| AI | Google Gemini |
| Images | Cloudinary |
| Infra | Fly.io, Docker, GitHub Actions |

## Run it yourself

### Docker (fastest)

```bash
git clone <repo-url>
cd potatoes
docker-compose up
```

Frontend at `localhost:3000`. API at `localhost:8000`. Docs at `localhost:8000/docs`.

### Manual

You'll need Python 3.11+ and Node 18+.

**Backend:**

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edit this — SECRET_KEY is the only required one
alembic upgrade head
uvicorn main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api" > .env.local
npm run dev
```

**Mobile (optional):**

```bash
cd mobile
npm install
npm start
```

### Or just

```bash
./setup.sh
```

## Environment

Only `SECRET_KEY` is truly required. Everything else turns on optional features.

| Variable | Does what |
|---|---|
| `SECRET_KEY` | Signs JWTs. Generate: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `GEMINI_API_KEY` | AI recipe import from URLs and YouTube |
| `GOOGLE_CLIENT_ID` / `SECRET` | Google OAuth login |
| `CLOUDINARY_*` | Image uploads |
| `MAIL_*` | Email verification |
| `MCP_AUTH_TOKEN` / `MCP_USER_EMAIL` | Claude MCP server |
| `ADMIN_EMAIL` | Auto-promotes this user to admin |

Full list in [`backend/.env.example`](backend/.env.example).

## Test data

```bash
cd backend && source venv/bin/activate
python scripts/seed_users.py
```

Five users: alice, bob, carol, david, emma. All `@example.com`, password `password123`.

## Structure

```
potatoes/
├── backend/          # FastAPI — models, routers, services, migrations
├── frontend/         # Next.js 14 — App Router, PWA
├── mobile/           # React Native + Expo
├── documentation/    # Deep-dive technical docs
└── docker-compose.yml
```

## Docs

The [`documentation/`](documentation/) folder has detailed guides on [architecture](documentation/01-architecture.md), [local dev](documentation/02-local-development.md), [env vars](documentation/03-environment.md), [auth](documentation/04-auth-system.md), [database](documentation/05-database.md), [API](documentation/06-api-reference.md), [deployment](documentation/07-deployment.md), [integrations](documentation/08-integrations.md), and [mobile](documentation/09-mobile.md).

---

Built by [Nicola Macchitella](https://macchitella.xyz)
