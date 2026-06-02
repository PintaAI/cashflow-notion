<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Cashflow Tracker

Personal/household finance tracking PWA with multi-wallet support, budget alerts, push notifications, MCP server, OAuth 2.1, and AI receipt extraction.

## Tech Stack

| Concern       | Technology                                    |
|---------------|-----------------------------------------------|
| Runtime       | **Bun** — use `bun` for all commands          |
| Framework     | Next.js 16 (App Router), React 19 + Compiler  |
| Database      | PostgreSQL via Prisma ORM                     |
| Auth          | better-auth (email/password + Google OAuth)   |
| UI            | shadcn/ui (Radix) + Tailwind CSS v4           |
| Data Fetching | TanStack Query (React Query)                  |
| Charts        | Recharts                                      |
| PWA           | next-pwa (builds require `--webpack`)         |
| Push          | Web Push API via `web-push`                   |
| AI            | Google Gemini (receipt extraction)            |

## Directory Map

| Path               | What's There                                                  |
|--------------------|---------------------------------------------------------------|
| `app/`             | App Router — pages, layouts, API routes, server actions       |
| `app/actions/`     | Server actions (cashflow CRUD, analytics, budgets, auth, etc) |
| `app/api/`         | API routes (auth, MCP, OAuth, notifications, receipt extract) |
| `components/`      | React components (feature components + `ui/` shadcn primitives + `providers/`) |
| `lib/`             | Core logic — Prisma queries (`db.ts`), auth config (`auth.ts`), notifications, MCP, OAuth, currency |
| `lib/mcp/tools/`   | MCP tool implementations (entries, categories, analytics, quick-fills) |
| `lib/oauth/`       | OAuth 2.1 server logic (`server.ts`)                          |
| `hooks/`           | React hooks (TanStack Query data hooks, mobile, pull-to-refresh) |
| `prisma/`          | `schema.prisma` — 14 models (User, Entry, Category, Management, etc) |
| `worker/`          | Service worker for Web Push (`index.js`)                      |
| `scripts/`         | Utility scripts (PWA icon generation, OAuth client seeding)   |
| `types/`           | TypeScript type declarations                                  |
| `public/`          | Static assets (PWA icons, favicon, manifest, service worker)  |
| `proxy.ts`         | Middleware — auth guard (redirects unauthenticated to `/auth`)|

## Database (Prisma)

`prisma/schema.prisma` — PostgreSQL, 14 models. Key models:

- **User** — profile, MCP API key, currency pref, active wallet
- **Management** — a wallet/household (groups users)
- **Entry** — transaction (name, nominal, date, IO Type: Income/Expenses, category)
- **Category** — per-management categories with budget fields
- **RecurringEntry** — auto-generating templates
- **OverallBudget** — wallet-level budget caps per period
- **OAuthClient / OAuthToken / OAuthAuthorizationCode / OAuthConsent** — OAuth 2.1

UUID-based IDs, cascade deletes on management. Run `bunx prisma generate` after schema changes.

## Key Routes

| Route                                    | Purpose                             |
|------------------------------------------|-------------------------------------|
| `/`                                      | Main dashboard (Home, List, Calendar, Settings tabs) |
| `/auth`                                  | Login/signup                        |
| `/admin`                                 | Admin dashboard                     |
| `/invite?code=...`                       | Accept wallet invitation            |
| `/oauth/authorize`                       | OAuth consent screen                |
| `/.well-known/oauth-authorization-server`| OAuth discovery                     |
| `/api/auth/[...all]`                     | better-auth endpoints               |
| `/api/mcp`                               | MCP server (GET/POST/DELETE)        |
| `/api/notifications/daily`               | Cron-triggered daily push (8 PM Jakarta) |
| `/api/extract-receipt`                   | AI receipt extraction (Gemini)      |
| `/api/oauth/register`                    | Dynamic OAuth client registration   |

## Commands

```bash
bun dev                  # Dev server (Turbopack)
bun run build            # Production build (--webpack for PWA)
bun run lint             # ESLint
bunx prisma generate     # Regenerate Prisma client
bunx prisma db push      # Push schema to DB
bun run generate-icons   # Generate PWA icons from cashflow.png
```

## Deployment

- **Platform:** Vercel (`prj_hlxQdzS32S2PqfresgQVt8W13Wu2`)
- **Trigger:** Pushing to `origin/master` auto-deploys
- **Vercel CLI:** Logged in and available (`vercel` commands work)
- **Cron:** `CRON_SECRET`-authorized call to `/api/notifications/daily` at 8 PM Jakarta

## Commit Convention

When the user says "commit", do ALL of these:

1. Stage all changes (`git add -A`)
2. Commit with a concise, descriptive message in English
3. Push to `origin/master` — this triggers Vercel deploy

## Environment

- `.env.local` — Local development variables
- `.env` — Base / fallback environment variables
- `.env.prod` — Production-only variables (used in Vercel)
- `.env.local.bak` — Backup
