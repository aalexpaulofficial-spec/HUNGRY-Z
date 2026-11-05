<p align="center">
  <img src="public/HUNGRY%20Z%20Q%20LOGO.png" alt="HUNGRY Z" width="104" />
</p>

<h1 align="center">HUNGRY Z</h1>

<p align="center"><strong>Campus food ordering, canteen operations, and faculty events in one platform.</strong></p>

<p align="center">
  <a href="https://hungryz.vercel.app/">Product</a> ·
  <a href="docs/SETUP.md">Setup</a> ·
  <a href="docs/ARCHITECTURE.md">Architecture</a> ·
  <a href="LICENSE">License</a>
</p>

<p align="center">
  <a href="LICENSE"><img alt="Proprietary license" src="https://img.shields.io/badge/License-PROPRIETARY-red"></a>
  <img alt="React 19" src="https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white">
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-PostgreSQL-3fcf8e?logo=supabase&logoColor=white">
  <img alt="TanStack Start" src="https://img.shields.io/badge/TanStack-Start-ff4154">
</p>

HUNGRY Z brings students, faculty and campus canteens into one coordinated web experience. Students browse participating canteens, place pickup orders and follow order status. Faculty coordinate event food with canteens, while owners manage menus, orders, quotations and event serving from their dashboard.

## Product overview

### Student ordering

- Browse approved participating canteens and current menu availability.
- Place Dine In or Parcel orders and follow the supported order and pickup flow.
- Pay at the counter, or use Razorpay online payment when available for Dine In. Parcel orders are pay-at-counter.
- View order details and pickup QR codes where supported.
- Use **HUNGRY AI Scan** for food identification and nutrition estimates.

### Faculty events

- Submit event details, expected participants and a seven-digit event code.
- Add menu items and quantities, a message to the canteen, or both. Either a menu selection or a message is enough to submit a request.
- Review the canteen's item confirmations, alternatives and quotation; request changes or approve.
- Track event participation and capacity.

### Canteen operations

- Maintain menu items, prices, availability and operating availability.
- Process active orders and review analytics.
- Review faculty requests, suggest alternatives, prepare an itemized quotation and estimated budget, then publish after faculty approval.
- Verify event participation tokens and serving progress.

### Event participation

After a faculty event is published, an eligible signed-in student enters its seven-digit code, reviews the event and requests a four-digit participation token with a QR code. Tokens are issued while approved event capacity remains. Event participation does not use the food cart or regular checkout.

The public website also includes a help assistant with English, Hindi and Kannada responses. Availability of individual features can depend on account, canteen and service configuration.

## Product preview

Screenshots show the current HUNGRY Z landing page at desktop and mobile widths.

<p align="center">
  <img src="docs/screenshots/landing-desktop.png" alt="HUNGRY Z landing page on desktop" width="780" />
</p>

<p align="center">
  <img src="docs/screenshots/landing-mobile.png" alt="HUNGRY Z landing page on a mobile screen" width="260" />
</p>

Open the [live HUNGRY Z website](https://hungryz.vercel.app/) for the interactive product. No separate video demo is included in this repository.

## Technology

| Area | Technologies |
| --- | --- |
| Application | React 19, TypeScript, TanStack Start, TanStack Router |
| UI | Tailwind CSS, Radix UI, Lucide |
| Data and identity | Supabase Auth, PostgreSQL, Row Level Security, Realtime |
| Schema changes | Drizzle schema and SQL migrations |
| Payments | Razorpay, with server-side verification and webhook handling |
| Email | SMTP transport through the server mailer |
| Tooling | Vite, Vitest, Testing Library, ESLint |

## Installation and setup

These instructions are for maintainers and developers who have written authorization to access and use this proprietary source code. See [LICENSE](LICENSE).

### Requirements

- Node.js and npm
- Access to the configured Lovable/Supabase project
- Development environment values described in [`.env.example`](.env.example)

### Install and run

```bash
npm install
npm run dev
```

The development server starts with Vite. Authenticated, database-backed and provider-backed workflows require valid environment configuration.

### Environment configuration

Copy the variable names in [`.env.example`](.env.example) into your local environment and provide values through your approved secrets manager. The file documents Supabase, Razorpay, email, admin and scanner configuration names. Never commit populated environment files.

Browser-visible variables use the `VITE_` prefix and must contain only public configuration, such as the Supabase project URL and publishable key. Keep the Supabase service-role key, Razorpay secrets, SMTP app password, admin password and AI/data-provider API keys server-side. See [Configuration and deployment](docs/SETUP.md) for service setup and migration guidance.

### Common commands

```bash
npm test          # Run the Vitest suite
npm run build     # Build the application
npm run preview   # Preview the production build
npm run lint      # Run ESLint
```

## Usage

Use the [live product](https://hungryz.vercel.app/) to explore the public experience. The main application routes are:

| Route | Purpose |
| --- | --- |
| `/` | Product landing page and website help assistant |
| `/auth` | Account sign-in and registration |
| `/app` | Student and faculty application experience |
| `/canteen` | Canteen-owner sign-in and operations dashboard |
| `/register-canteen` | Canteen registration application |
| `/admin` | Administrator review and management dashboard |

Dashboard actions depend on the signed-in role and approved account/canteen access. Students use their canteen access code to join a participating canteen; owner credentials are separate. For role workflows and data boundaries, see [Architecture](docs/ARCHITECTURE.md).

## Architecture and project structure

The browser application is built with TanStack Start and React. Supabase provides application identity, PostgreSQL data, row-level policies and realtime updates. Authenticated server functions handle privileged workflows; Razorpay and SMTP integrations run server-side.

```text
src/
  routes/                 Landing, dashboards, legal and API routes
  components/foodexa/     Student, faculty and canteen interface components
  lib/                    Domain rules, server functions and integrations
drizzle/
  schema.ts               Typed database schema
  migrations/             Incremental SQL migrations
docs/
  ARCHITECTURE.md         System boundaries and workflow details
  SETUP.md                Service configuration and deployment notes
  screenshots/            README product screenshots
```

The event lifecycle is faculty request → canteen quotation → faculty review → canteen publish → student token → canteen verification. Read [the architecture guide](docs/ARCHITECTURE.md) for ordering, payments, refunds and security boundaries.

## Security and privacy

- Row Level Security and server-side authorization scope access by signed-in user, role and canteen ownership.
- Privileged writes, order totals, stock updates and payment/refund transitions are handled by server/database workflows.
- Online payment is treated as confirmed only after server-side provider verification or a verified Razorpay webhook.
- Server secrets must not be added to `VITE_` variables, browser code, screenshots, issues or commits.
- Do not include personal data, government ID documents, passwords, payment credentials or access tokens in public issues or logs.
- Read the website's [Privacy Policy](https://hungryz.vercel.app/privacy) and [Terms & Conditions](https://hungryz.vercel.app/terms) for product-facing information. Repository code and configuration should be reviewed before deployment.

## Contributing and support

HUNGRY Z is proprietary software. Do not copy, modify, redistribute or submit adapted code without prior written permission. Authorized contributors should coordinate changes with HUNGRY Z maintainers before opening a pull request. You may report reproducible bugs through this repository's issue tracker; do not include secrets or sensitive personal data.

For product support, contact **hungryofficialx@gmail.com**. For security issues, do not post exploit details or private data in a public issue; contact the maintainers directly.

## Copyright & Licensing

HUNGRY Z is proprietary software. All rights are reserved. No permission to use, copy, modify, distribute, sublicense or commercially exploit this repository is granted unless HUNGRY Z provides written authorization. See the root [LICENSE](LICENSE) for the full terms.

**Copyright © 2026 HUNGRY Z. All Rights Reserved.**
