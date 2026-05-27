This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Daily Push Reminder

Push subscriptions are stored in this order:

1. Vercel KV/Upstash Redis, when these env vars are available:

```env
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

The Upstash names are also supported:

```env
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

2. Vercel Blob, when these env vars are available:

```env
NOTIF_STORE_ID=...
NOTIF_READ_WRITE_TOKEN=...
```

3. Local development falls back to `data/push-subscriptions.json`.

The VPS cron should call the deployed app at 8 PM Jakarta time:

```cron
TZ=Asia/Jakarta
0 20 * * * curl -fsS -X POST https://your-domain.com/api/notifications/daily -H "Authorization: Bearer YOUR_CRON_SECRET"
```
