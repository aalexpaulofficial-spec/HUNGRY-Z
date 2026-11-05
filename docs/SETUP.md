# Development and configuration

This guide is for maintainers and developers who have written authorization to access and use the proprietary HUNGRY Z source. See the root [LICENSE](../LICENSE).

## Prerequisites

- Node.js and npm
- Authorized access to the project's Lovable workspace and configured Supabase backend
- Provider credentials only for the workflows you need to exercise locally

## Install and start the development server

From the repository root:

```bash
npm install
npm run dev
```

Vite starts the local development server. Stop it with `Ctrl+C`. A working browser and server build do not by themselves configure authentication, database access, payments, email or AI-backed scanning; those integrations need their corresponding backend values.

## Environment values

Use [`.env.example`](../.env.example) as the authoritative list of environment variable names. Add values to a local, ignored environment file or an approved secrets manager. Never commit `.env`, `.env.local` or populated environment files.

### Supabase

The browser needs the project URL and publishable key through `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or the supported anon-key alias shown in the example file). Server workflows use `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and the server-only `SUPABASE_SERVICE_ROLE_KEY` as configured by the deployment environment.

Only public project configuration belongs in variables prefixed with `VITE_`. Never put the service-role key in a browser-visible variable or bundle.

### Optional integrations

Set only the provider secrets required by the workflow you are developing:

| Integration | Environment values |
| --- | --- |
| Razorpay payments and webhooks | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| Transactional email | `GMAIL_USER`, `GMAIL_APP_PASSWORD` |
| Administrator login | `ADMIN_PASSWORD` |
| AI food scan and nutrition lookup | `GEMINI_API_KEY`, `USDA_FDC_API_KEY` |

Keep all these values server-side. Configure production values in the hosting/provider secret manager, not in source control.

## Database changes

The current schema is represented by [`drizzle/schema.ts`](../drizzle/schema.ts); incremental SQL changes live in [`drizzle/migrations/`](../drizzle/migrations/). This project is connected to Lovable Cloud: apply schema changes through its configured migration workflow and review the target environment before applying them. `LOVABLE_DB_MIGRATION_URL` is used by Drizzle Kit when generating migrations.

The older [`database/`](../database/) SQL files are historical references for the original schema. They are not the current migration sequence; do not run them as a fresh setup against an existing managed database. Do not manually apply or reorder a migration based only on the filenames. Confirm the migration state with the project maintainers and the target environment's migration history.

## Payments and email

- Razorpay online payment is available for supported Dine In orders when the integration is configured. Parcel orders use pay-at-counter. Payment and refund state must come from server-side provider verification or a verified webhook.
- The public webhook route is `/api/public/razorpay-webhook`. Configure webhook URL and event subscriptions in Razorpay only for an authorized deployment, using the matching server-side webhook secret.
- Transactional mail is sent by the server mailer. Configure SMTP credentials server-side; delivery and status depend on the configured provider.

## Useful project commands

```bash
npm test          # Run the Vitest suite
npm run build     # Build the application
npm run preview   # Preview a production build
npm run lint      # Run ESLint
```

## Security checklist

- Keep secrets out of Git, screenshots, browser variables and issue reports.
- Use the publishable Supabase key in the browser; keep the service-role key server-only.
- Preserve Row Level Security and ownership checks. Privileged writes should use the existing server/database workflows.
- Never treat a client payment callback as proof of payment; retain server verification and webhook signature checks.
- Keep sensitive registration documents in private storage with restrictive Storage policies and authorized review access.
- Use test-mode provider credentials for local payment exercises. Do not place real customer or government ID data in development fixtures.

For application boundaries and domain flows, see [Architecture](ARCHITECTURE.md). For product-facing data practices, see the live [Privacy Policy](https://hungryz.vercel.app/privacy).
