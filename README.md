# HUNGRY — Smart Campus Food Ordering

Students, faculty and guests order from their campus canteen, skip the queue and pick up with a code. Canteens manage menus and live orders; HUNGRY admins approve canteens, coupons and refunds.

## Features
- Accounts (student / faculty / guest), 7-character canteen codes, live menus and orders
- Canteen owners receive a separate 7-character Owner ID and Owner Password Code; customer canteen codes cannot open owner dashboards
- Dine-in or Parcel orders; pay online with **Razorpay** (dine-in) or **at the counter** (parcel is counter-only)
- Server-validated coupons (expiry, eligibility, usage limits, minimum order), stock tracking, duplicate-order protection
- Refund requests and processing through Razorpay
- Emails via Gmail SMTP: welcome, order confirmation, payment failure, refund updates, canteen approval/rejection, admin alerts to hungryofficialx@gmail.com — all logged

## Setup
Everything you need to configure (Supabase SQL, keys, Razorpay webhook, Gmail App Password, test checklist, go-live) is in **[docs/SETUP.md](docs/SETUP.md)**. Variable names are listed in **[.env.example](.env.example)**.

Database scripts (run in order in the Supabase SQL Editor):
1. `database/001_hungry_core.sql`
2. `database/002_payments_coupons_refunds.sql`
3. `database/003_canteen_owner_credentials.sql`
4. `database/004_canteen_owner_credential_guard.sql`
5. `database/005_canteen_menu_images.sql`

## Development
```bash
bun install
bun run dev      # local preview
bunx vitest run  # rules + database tests
```
