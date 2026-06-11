<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This repo uses Next.js 16. APIs, routing conventions, and generated types may differ from older Next.js versions. Read the relevant guide in `node_modules/next/dist/docs/` before changing framework-sensitive code.
<!-- END:nextjs-agent-rules -->

# Cashflow Tracker

## Commands

```bash
bun dev                    # Next dev server; PWA is disabled in development
bun run build              # next build --webpack; required because next-pwa needs webpack
bun run lint               # only configured verifier; there is no test script in package.json
bunx prisma generate       # run after Prisma schema changes; also runs on postinstall
bunx prisma db push        # push schema to DATABASE_URL/DIRECT_URL database
bun run generate-icons       # regenerate PWA icons from cashflow.png
bun run scripts/seed-oauth.ts # seed the default public OAuth client
```

Use Bun for package/script commands; `bun.lock` is the lockfile. Do not invent `npm test`/`pnpm test` commands.

## Architecture Notes

- Main app routes live under `app/(app)`. `/` redirects to the user's active wallet at `/dompet/[managementId]`; `/m/[managementId]` exists as a short alias/redirect path.
- `proxy.ts` is the auth gate for non-API pages and skips `/api`, `/_next`, `/.well-known`, `/oauth`, PWA assets, and static files.
- Server actions are in `app/actions`; shared Prisma data access is re-exported from `lib/db.ts` and implemented in `lib/db/*`.
- Data is wallet-scoped through `Management`/`ManagementMember`; most user-visible records carry `managementId`. Preserve this scoping in CRUD, analytics, MCP tools, and notification changes.
- New users are created through `better-auth`; `lib/auth.ts` creates their first `Management`, default categories, MCP API key, and `activeManagementId` in the user create hook.
- MCP is served by `app/api/mcp/route.ts` with `mcp-handler`. It accepts OAuth access tokens, `mcpApiKey` bearer tokens, or `api_key` query tokens and scopes tools via `AsyncLocalStorage` management context.
- OAuth 2.1 server logic is in `lib/oauth/server.ts`; discovery routes are under `app/.well-known` and default `BETTER_AUTH_URL` to `http://localhost:3000`.

## Database And Env

- Prisma uses PostgreSQL with both `DATABASE_URL` and `DIRECT_URL` in `prisma/schema.prisma`.
- Push subscriptions are stored in Upstash/Vercel KV first (`KV_REST_API_*` or `UPSTASH_REDIS_REST_*`), then Vercel Blob (`NOTIF_STORE_ID`/`NOTIF_READ_WRITE_TOKEN`), then local `data/push-subscriptions.json`.
- Daily notifications require `CRON_SECRET`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`; timezone defaults to `Asia/Jakarta` via `NOTIFICATION_TIMEZONE`.
- Google auth requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Admin access is controlled by comma-separated `ADMIN_EMAILS`.

## UI And Framework Quirks

- React Compiler is enabled in `next.config.ts`; avoid unnecessary `useMemo`/`useCallback` unless the local code already needs them.
- Tailwind CSS v4 is wired through `@tailwindcss/postcss`; shadcn/Radix primitives live in `components/ui`.
- `next-pwa` writes service worker assets to `public` and is disabled when `NODE_ENV=development`.

## Commit Convention

When the user says "commit", do ALL of these:

1. Stage all changes (`git add -A`)
2. Commit with a concise, descriptive message in English
3. Push to `origin/master`
