# PRD: Statie Trending Statements

## Overview

The current Statie homepage ranks trending statements by lifetime `usedCount` only. This makes older statements dominate the Trending tab forever, while newer statements have little chance to surface even when they are actively used or generate strong debate.

This PRD defines a better trending algorithm for Statie statements based on recent usage, engagement, and debate quality.

## Problem

Current ranking logic lives in `getStatieStatements` at `app/actions/statie.ts`:

```ts
orderBy: [{ usedCount: "desc" }, { createdAt: "desc" }]
```

This causes three product issues:

- Old high-usage statements stay at the top indefinitely.
- New statements cannot compete until they accumulate many uses.
- Statements that create active debate are treated the same as statements that are merely reused.

## Goals

- Surface statements that are currently active, not just historically popular.
- Reward statements that generate votes and balanced debate.
- Give new statements a fair chance without making the list random.
- Keep the algorithm understandable and cheap to compute.
- Preserve existing Statie data and behavior outside ranking.

## Non-Goals

- Building a full recommendation system.
- Personalizing trending per user.
- Tracking every historical statement view or impression.
- Adding background jobs for rolling aggregates in the first version.

## Users

- Players browsing the Statie homepage before creating a room.
- Room creators choosing a statement to start from.
- Admins curating low-quality or stale statements.

## Current Data Signals

`StatieStatement` currently has:

| Field | Meaning |
|-------|---------|
| `usedCount` | Total number of times the statement has been selected for a round |
| `agreeCount` | Total Agree votes across completed rounds |
| `disagreeCount` | Total Disagree votes across completed rounds |
| `createdAt` | Statement creation time |

Current gaps:

- No `lastUsedAt`, so the system cannot distinguish recently active statements from old inactive ones.
- No precomputed `trendingScore`, so the query cannot sort directly by a computed score without app-side sorting or raw SQL.

## Proposed Solution

Add a lightweight engagement-weighted trending score.

### Schema Changes

Add two fields to `StatieStatement`:

```prisma
lastUsedAt     DateTime?
trendingScore Float     @default(0)
```

Recommended indexes:

```prisma
@@index([trendingScore, createdAt])
@@index([lastUsedAt])
```

`lastUsedAt` is updated whenever `usedCount` increments.

`trendingScore` is recalculated whenever statement usage or vote totals change.

## Scoring Formula

Use four signals:

```ts
totalVotes = agreeCount + disagreeCount
daysSinceCreated = max(0.1, hoursSinceCreated / 24)
hoursSinceLastUse = lastUsedAt ? hoursBetween(now, lastUsedAt) : hoursSinceCreated

velocity = usedCount / daysSinceCreated
voteRatio = totalVotes / max(1, usedCount)
controversy = totalVotes === 0
  ? 0
  : 1 - Math.abs(agreeCount - disagreeCount) / totalVotes
lifetimeUsage = Math.log10(usedCount + 1)

rawScore =
  velocity * 0.4 +
  voteRatio * 0.35 +
  controversy * 0.15 +
  lifetimeUsage * 0.1

trendingScore = rawScore / Math.pow(hoursSinceLastUse + 2, 0.3)
```

### Signal Meaning

| Signal | Weight | Purpose |
|--------|--------|---------|
| `velocity` | 40% | Rewards statements being used quickly relative to their age |
| `voteRatio` | 35% | Rewards statements that generate participation |
| `controversy` | 15% | Rewards statements with balanced Agree/Disagree votes |
| `lifetimeUsage` | 10% | Keeps historically proven statements from disappearing too quickly |
| recency decay | divisor | Penalizes statements not used recently |

## Ranking Behavior

The Trending tab should sort by:

```ts
orderBy: [{ trendingScore: "desc" }, { lastUsedAt: "desc" }, { createdAt: "desc" }]
```

Fallback behavior:

- If all scores are `0`, newest statements can still appear via `createdAt DESC`.
- If `lastUsedAt` is null, use `createdAt` as the recency timestamp during calculation.

## Implementation Plan

### Step 1: Add Database Fields

Update `prisma/schema.prisma` for `StatieStatement`:

```prisma
lastUsedAt     DateTime?
trendingScore Float     @default(0)
```

Then run:

```bash
bunx prisma generate
bunx prisma db push
```

### Step 2: Add Score Helper

Create a helper in `app/actions/statie.ts` or a small shared module:

```ts
function calculateStatieTrendingScore(input: {
  usedCount: number;
  agreeCount: number;
  disagreeCount: number;
  createdAt: Date;
  lastUsedAt: Date | null;
  now?: Date;
}) {
  // formula from this PRD
}
```

### Step 3: Update Usage Writes

Update both `usedCount` increments in `app/actions/statie.ts`:

- Round start flow around line 671.
- Round statement retrieval flow around line 720.

Each write should also set:

```ts
lastUsedAt: now
```

Then recalculate and store `trendingScore`.

### Step 4: Update Vote Writes

When `agreeCount` and `disagreeCount` are incremented around line 1000, recalculate `trendingScore` using the updated counts.

### Step 5: Update Trending Query

Change `getStatieStatements` from lifetime usage sorting to score sorting:

```ts
orderBy: [
  { trendingScore: "desc" },
  { lastUsedAt: "desc" },
  { createdAt: "desc" },
]
```

Also return `trendingScore` if useful for debugging or admin UI.

### Step 6: Backfill Existing Data

For existing statements:

- Set `lastUsedAt = createdAt` if no better historical source is available.
- Compute `trendingScore` using existing counts.

This can be a one-off script or a safe admin action.

## Acceptance Criteria

- Trending statements no longer sort by raw `usedCount` only.
- A recently used statement with moderate engagement can outrank an old statement with high lifetime usage.
- Statements with high vote participation rank higher than low-engagement statements with similar usage.
- Statements with balanced Agree/Disagree votes receive a small boost.
- New statements are not permanently buried by old statements.
- Existing room creation, voting, leaderboard, and admin delete flows continue to work.

## Example

Statement A:

- Created 6 months ago
- Used 100 times
- Last used 45 days ago
- 120 total votes

Statement B:

- Created 2 days ago
- Used 12 times
- Last used 1 hour ago
- 40 total votes
- Agree/Disagree split close to 50/50

Expected result: Statement B should rank above Statement A because it is currently active, highly engaging, and debate-worthy.

## Risks

- Scores may feel unstable if weights are too aggressive.
- `voteRatio` can be high for low sample sizes, so `usedCount` and recency must balance it.
- Precomputed scores can become stale if not recalculated consistently after writes.

## Future Enhancements

- Add a minimum sample threshold before high controversy boosts apply.
- Track per-day usage for true rolling 24h or 7d trending.
- Add admin controls to tune weights without code changes.
- Show a small "Hot" or "Rising" badge for high-scoring statements.
