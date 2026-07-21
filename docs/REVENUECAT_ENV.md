# RevenueCat Environment Configuration

Do not commit real secret keys. Configure these values in Vercel for Preview and Production separately.

## Backend

| Variable | Scope | Purpose |
| --- | --- | --- |
| `REVENUECAT_PROJECT_ID` | Server | RevenueCat project identifier (`proj...`). |
| `REVENUECAT_V2_SECRET_KEY` | Server secret | Read-only V2 key for customer subscriptions and purchases. |
| `REVENUECAT_V1_SECRET_KEY` | Server secret | V1 key used only for beta promotional lifetime grants. |
| `REVENUECAT_V2_ADMIN_SECRET_KEY` | Server secret | Narrow V2 key with customer deletion permission. |
| `REVENUECAT_APP_ID_IOS` | Server | RevenueCat iOS app identifier used to validate webhook configuration. |
| `REVENUECAT_WEBHOOK_AUTHORIZATION` | Server secret | Full random Authorization value configured on the webhook integration. |
| `REVENUECAT_WEBHOOK_SIGNING_SECRET` | Optional server secret | HMAC signing secret, only if the RevenueCat dashboard exposes signing. |
| `CRON_SECRET` | Server secret | Protects `/api/cron/revenuecat-reconcile`. |
| `BILLING_ENFORCEMENT_ENABLED` | Server | Keep unset/`false` during additive rollout; set `true` only after reconciliation is verified. |
| `BETA_REDEMPTION_ENABLED` | Server | Set to `true` only during the tester migration window. |
| `BETA_REDEMPTION_DEADLINE` | Server | `2026-08-31T23:59:59Z`. |
| `BETA_TESTER_EMAILS` | Operational secret | Comma-separated allowlist used by the cleanup script. |
| `SUPPORT_EMAIL` | Server | Account excluded from beta cleanup. |

The V2 read key needs customer subscription and purchase read permissions. The deletion key should have only the customer deletion permission needed by the cleanup job. RevenueCat V1 and V2 keys are not interchangeable.

## Expo/EAS

Configure public SDK keys as EAS environment variables. They are intentionally public but must match the correct RevenueCat app and environment.

| EAS environment | Variable | Value |
| --- | --- | --- |
| Development | `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | RevenueCat Test Store public key |
| Preview | `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | Apple public SDK key |
| Production | `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | Apple public SDK key |

Android billing is out of scope for the first release. The local ignored `.env.local` currently uses the supplied Test Store key for both native platforms.

## Webhook Dashboard

1. Open the RevenueCat project.
2. Go to **Integrations**, then **Webhooks**.
3. Add Preview and Production integrations where practical.
4. Set the endpoint to `https://cashflow-notion.vercel.app/api/webhooks/revenuecat` for production.
5. Set the same full Authorization value stored in `REVENUECAT_WEBHOOK_AUTHORIZATION`.
6. If the dashboard exposes HMAC signing, enable it and immediately store the one-time secret as `REVENUECAT_WEBHOOK_SIGNING_SECRET`. Otherwise leave this variable unset; the full Authorization value remains mandatory.
7. Select the intended production/sandbox event environments and the Ethos iOS app.

Production URL: `https://cashflow-notion.vercel.app/api/webhooks/revenuecat`

To check webhook plan availability, open **Integrations > Webhooks** and attempt to add a configuration. If RevenueCat shows an upgrade prompt instead of the configuration form, check the workspace **Billing/Plan** page or contact the workspace owner. Do not enable entitlement enforcement until webhook access or the cron-only fallback has been confirmed.
