# Cashflow API v1

REST API for the Cashflow Tracker mobile app (Expo). All endpoints are prefixed with `/api/v1`.

## Authentication

Every endpoint (except `GET /managements/invites/[code]`) requires an authenticated session. The API uses [Better Auth](https://better-auth.com) with the Expo plugin.

### How to authenticate (Expo client)

```ts
import { authClient } from "@/lib/auth-client";

const cookies = authClient.getCookie(); // session from SecureStore
const res = await fetch("https://your-api.com/api/v1/entries", {
  headers: { Cookie: cookies },
  credentials: "omit", // avoid iOS native cookie interference
});
const { data } = await res.json();
```

- `credentials: "omit"` is required to prevent duplicate cookies on iOS.
- The session cookie is managed by `@better-auth/expo/client` and stored in `expo-secure-store`.

### Response format

```
Success:  { "data": <payload> }            // 200 | 201
Error:    { "error": "<message>" }          // 400 | 401 | 403 | 404 | 500
```

### Wallet scoping

Most endpoints accept an optional `management_id` query param (or `managementId` in the request body) to target a specific wallet. When omitted, the user's `activeManagementId` is used. The user must be a member of the target wallet. Cloud sync and shared wallets are available to every authenticated user; there is no paid entitlement check.

## Managements (Wallets)

| Method | Path | Description | Params / Body |
|--------|------|-------------|---------------|
| GET | `/managements` | List user's wallets | — |
| POST | `/managements` | Create wallet | `{ name }` |
| GET | `/managements/current` | Get active wallet with members | `?management_id=` |
| PATCH | `/managements/active` | Switch active wallet | `{ managementId }` |
| PATCH | `/managements/{id}` | Rename wallet (owner only) | `{ name }` |
| GET | `/managements/{id}/invites` | List invites (owner only) | — |
| POST | `/managements/{id}/invites` | Create invite (owner only) | — → `{ code }` |
| DELETE | `/managements/{id}/members/{memberId}` | Remove member (owner only) | — |
| DELETE | `/managements/invites/{invitationId}` | Delete invite | `?management_id=` |
| GET | `/managements/invites/lookup/{code}` | Get invite info (public) | — |
| POST | `/managements/invites/lookup/{code}/accept` | Accept invite | — |

---

## Entries

| Method | Path | Description | Params / Body |
|--------|------|-------------|---------------|
| GET | `/entries` | List entries (filtered + paginated) | `?page_size=&skip=&io=&date=&created_by_id=&management_id=` |
| POST | `/entries` | Create entry | `{ name, nominal?, category?, date?, io?, originalNominal?, originalCurrency?, exchangeRateToIdr?, exchangeRateAt?, managementId? }` |
| GET | `/entries/summary` | Wallet summary | `?management_id=` |
| GET | `/entries/count` | Total entry count | `?management_id=` |
| GET | `/entries/calendar` | Calendar data | `?year=&month=&io=&management_id=` |
| GET | `/entries/category/{category}` | Entries by category | `?from=&to=&limit=&management_id=` |
| POST | `/entries/transfer` | Transfer between wallets | `{ toManagementId, nominal?, fromManagementId?, originalNominal?, originalCurrency?, exchangeRateToIdr?, exchangeRateAt?, date?, note? }` |
| PATCH | `/entries/{id}` | Edit entry | partial entry fields |
| DELETE | `/entries/{id}` | Delete entry | `?management_id=` |

### Inbound share extraction

`POST /inbound-share/extract` accepts an image, shared text, or both as `multipart/form-data` and returns a reviewable entry draft. It never creates an entry.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `file` | file | one of `file` or `text` | JPEG, PNG, WebP, HEIC, or HEIF image; maximum 4 MB |
| `text` | string | one of `file` or `text` | Shared text; maximum 50,000 characters |
| `management_id` | string | no | Defaults to the active wallet; controls category mapping |
| `locale` | string | no | User locale, such as `id-ID` |
| `currency` | string | no | Preferred ISO 4217 currency; defaults to `IDR` |
| `current_date` | string | no | Client-local date in `YYYY-MM-DD`; defaults to the server date |

The response contains `draft.name`, `amount`, `currency`, `date`, `categoryId`, `category`, and `io`. Extracted fields are nullable, and `categoryId` is only set when the model's category exactly matches a category in the selected wallet. The response also includes `managementId` and source metadata. The client must present the draft for review before calling `POST /entries`.

### Entry body fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | yes | |
| `nominal` | number | no | Positive IDR amount. If omitted, server derives it from `originalNominal` + `originalCurrency`. |
| `io` | `"Income" \| "Expenses"` | no | |
| `category` | string | no | category name |
| `date` | string | no | `YYYY-MM-DD` |
| `originalNominal` | number | no | for multi-currency |
| `originalCurrency` | string | no | ISO 4217 |
| `exchangeRateToIdr` | number | no | |
| `exchangeRateAt` | string | no | ISO date |
| `managementId` | string | no | defaults to active |

---

## Categories

| Method | Path | Description | Params / Body |
|--------|------|-------------|---------------|
| GET | `/categories` | List categories | `?detailed=true&management_id=` |
| POST | `/categories` | Create category | `{ name, color?, icon?, budgets?, managementId? }` |
| PATCH | `/categories/{id}` | Update category | partial category fields |
| DELETE | `/categories/{id}` | Delete category (fails if in use) | `?management_id=` |
| GET | `/categories/usage/{name}` | Check usage count | `?management_id=` |

### Category budgets object

```json
{
  "budgetDaily": 50000,
  "budgetWeekly": 350000,
  "budgetMonthly": 1500000,
  "budgetYearly": 18000000
}
```

---

## Quick Fills

| Method | Path | Description | Params / Body |
|--------|------|-------------|---------------|
| GET | `/quick-fills` | List presets | `?management_id=` |
| POST | `/quick-fills` | Create preset | `{ name, nominal, categoryId?, managementId? }` |
| PATCH | `/quick-fills/{id}` | Edit preset | partial fields |
| DELETE | `/quick-fills/{id}` | Delete preset | `?management_id=` |

---

## Budgets

| Method | Path | Description | Params / Body |
|--------|------|-------------|---------------|
| GET | `/budgets/status` | Budget status (category + overall) | `?management_id=` |
| GET | `/budgets/overall` | List overall budgets | `?management_id=` |
| PUT | `/budgets/overall` | Save overall budget | `{ period, amount, managementId? }` |
| DELETE | `/budgets/overall` | Remove overall budget | `?period=&management_id=` |

### Budget period

One of: `"daily"`, `"weekly"`, `"monthly"`, `"yearly"`.

---

## Recurring Entries

| Method | Path | Description | Params / Body |
|--------|------|-------------|---------------|
| GET | `/recurring` | List recurring entries | `?management_id=` |
| POST | `/recurring` | Create recurring entry | see below |
| PATCH | `/recurring/{id}` | Edit recurring entry | partial fields |
| DELETE | `/recurring/{id}` | Delete recurring entry | `?management_id=` |
| POST | `/recurring/generate` | Run generation | `?management_id=` → `{ generated: count }` |

### Recurring body

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | yes | |
| `nominal` | number | yes | positive |
| `io` | `"Income" \| "Expenses"` | yes | |
| `frequency` | `"daily" \| "weekly" \| "monthly" \| "yearly"` | yes | |
| `startDate` | string | yes | `YYYY-MM-DD` |
| `categoryId` | string | no | |
| `dayOfWeek` | number | no | 0-6 |
| `dayOfMonth` | number | no | 1-31 |
| `monthOfYear` | number | no | 1-12 |
| `endDate` | string | no | `YYYY-MM-DD` |
| `managementId` | string | no | defaults to active |

---

## Analytics

| Method | Path | Description | Params / Body |
|--------|------|-------------|---------------|
| POST | `/analytics` | Fetch analytics | `{ io?, category?, startDate?, endDate?, managementId? }` |
| POST | `/analytics/summary` | Filtered summary | same body → `{ totalIncome, totalExpenses, balance, entryCount }` |
| GET | `/analytics/activity` | Activity overview | `?days_back=182&management_id=` |

---

## Audit

| Method | Path | Description | Params / Body |
|--------|------|-------------|---------------|
| GET | `/audit/balance` | Current balance | `?management_id=` → `{ balance }` |
| GET | `/audit` | Audit history | `?management_id=` |
| GET | `/audit/latest` | Latest snapshot | `?management_id=` |
| POST | `/audit` | Perform audit | `{ actualBalance, note?, autoAdjust?, managementId? }` |

---

## Notes

| Method | Path | Description | Params / Body |
|--------|------|-------------|---------------|
| GET | `/notes` | List user's notes | — |
| POST | `/notes` | Create note | `{ title }` → `{ noteId }` |
| GET | `/notes/{id}` | Get note | — |
| DELETE | `/notes/{id}` | Delete note (owner only) | — |
| PATCH | `/notes/{id}/title` | Update title | `{ title }` |
| PUT | `/notes/{id}/content` | Update content | `{ contentJson, html, markdown }` |
| PATCH | `/notes/{id}/icon` | Update icon | `{ icon, iconType, iconColor }` |
| PATCH | `/notes/{id}/pin` | Toggle pin | — → `{ pinned }` |
| GET | `/notes/{id}/invites` | List invites (owner only) | — |
| POST | `/notes/{id}/invites` | Create invite (owner only) | — → `{ code }` |
| DELETE | `/notes/{id}/invites` | Delete invite | `?invitation_id=` |
| POST | `/notes/invites/{code}/accept` | Accept note invite | — |

### Note icon types

- `iconType`: `"hugeicon"` or `"emoji"`

---

## Preferences

| Method | Path | Description | Params / Body |
|--------|------|-------------|---------------|
| GET | `/preferences/currency` | Get user currency | — → `{ currency }` |
| PUT | `/preferences/currency` | Update currency | `{ currency }` |
| GET | `/preferences/exchange-rates` | Get all rates | — → `Record<string, number>` |

---

## Profile

| Method | Path | Description | Params / Body |
|--------|------|-------------|---------------|
| GET | `/profile/theme` | Get profile theme | — |
| PUT | `/profile/theme` | Save theme | `{ theme }` |
| PUT | `/profile` | Update profile (FormData) | `name`, `image?` (file) |

---

## Account

| Method | Path | Description | Params / Body |
|--------|------|-------------|---------------|
| DELETE | `/account` | Delete the authenticated account and private related data | — → `{ success, deletedManagements, deletedNotes, removedPushSubscriptions }` |

Deletion removes the user, auth sessions/accounts, OAuth tokens/consents/codes, MCP API key, push subscriptions for the user, and any wallet or note where the user is the only member. Shared wallets and notes are preserved; if the deleted user was the only owner, ownership is assigned to the oldest remaining member.

---

## Currency

| Method | Path | Description | Params / Body |
|--------|------|-------------|---------------|
| GET | `/currency/rates` | All currency rates | — → `Record<string, number>` |
| POST | `/currency/convert` | Convert amount | `{ amount, from, to }` → `{ result, rate, rates }` |

---

## Users

| Method | Path | Description | Params / Body |
|--------|------|-------------|---------------|
| GET | `/users/search` | Search registered users | `?q=` (min 2 chars, max 20 results) |

---

## MCP API Key

| Method | Path | Description | Params / Body |
|--------|------|-------------|---------------|
| GET | `/mcp-key` | Get current key | — → `{ apiKey }` |
| POST | `/mcp-key/regenerate` | Regenerate key | — → `{ apiKey }` |

---

## Base URL

In development: `http://localhost:3000/api/v1`
In production: `https://your-domain.com/api/v1`

All routes are skipped by the `proxy.ts` auth gate (line 48: `pathname.startsWith("/api")`), so each route handler enforces its own auth via `auth.api.getSession()`.
