# HUNGRY — production setup checklist

Follow these steps in order. Everything marked **YOU** needs your accounts or keys.
Keep Razorpay in **test mode** until step 7 passes completely.

---

## 1. Supabase project (YOU)

1. Create a project at <https://supabase.com/dashboard> (region close to India, e.g. Mumbai).
2. **Project Settings → API**: note the **Project URL**, the **publishable / anon key** and the **service_role / secret key**.

## 2. Run the database SQL (YOU) — exact order

Supabase dashboard → **SQL Editor → New query**. Paste each file's full contents and press **Run**. Run them once, in this order:

| # | File | What it creates |
|---|------|-----------------|
| 1 | `database/001_hungry_core.sql` | roles, canteen applications, canteens, profiles, menu, orders, Row Level Security, signup trigger, realtime |
| 2 | `database/002_payments_coupons_refunds.sql` | stock, order types & payment status, coupons, coupon redemptions, payments, webhook log, refunds, email log, transaction-safe order functions |
| 3 | `database/003_canteen_owner_credentials.sql` | private owner credential and login rate-limit tables |
| 4 | `database/004_canteen_owner_credential_guard.sql` | approved-only credential rules and owner/customer code separation |
| 5 | `database/005_canteen_menu_images.sql` | public food-image reads and canteen-owner-only image uploads |
| 6 | `database/006_canteen_templates.sql` | per-canteen home banner content, owner-scoped template access, and public banner image reads |
| 7 | `database/007_canteen_template_crop.sql` | saved per-canteen banner position and zoom crop settings |
| 8 | `database/008_user_language_preferences.sql` | private per-account dashboard language preferences (English, Hindi, Kannada) |
| 9 | `database/009_order_print_events.sql` | owner-scoped bill print audit snapshots |
| 10 | `database/010_support_requests.sql` | private ratings, feedback and issue reports with email delivery status |
| 11 | `database/011_canteen_availability.sql` | per-canteen time zones and weekly hours, owner overrides, and a database guard that rejects order inserts while closed |
| 12 | `database/012_canteen_ist_timezone.sql` | normalize existing availability schedules to India Standard Time (IST) and enforce IST in the database |

Each file should finish with "Success. No rows returned". If a migration fails, stop and check that the preceding files ran first.

After file 5, verify Storage contains the public `canteen-menu-images` bucket. Owner uploads are limited by Storage policies to each canteen owner's own folder.
After file 6, verify the `canteen_templates` table and public `canteen-home-banners` Storage bucket exist. Canteen owners can only edit their own template and upload/delete banner images in their own folder.
After file 7, banner crop position and zoom settings can be saved for each canteen independently.
After file 8, each signed-in user can save their dashboard language preference; users can only read and update their own preference.
After file 10, users can read only their own support submissions; canteen owners can read submissions tied to their canteen and admins can review all submissions. Inserts and email status updates remain server-only.

Verify: **Table Editor** shows `canteen_applications, canteens, coupon_redemptions, coupons, email_logs, menu_items, orders, order_print_events, payment_events, payments, profiles, refunds, support_requests, user_roles`.
**Database → Publications → supabase_realtime** includes `menu_items, orders, canteens, refunds`.

## 3. Supabase Auth settings (YOU)

**Authentication → URL Configuration**
- Site URL: your live site, e.g. `https://hungry.example.com` (or the Lovable published URL).
- Redirect URLs: add the same URL with `/app`, plus your Lovable preview URL with `/app`.

**Authentication → Providers → Email**: keep enabled. "Confirm email" ON is recommended; the welcome email is then sent on the customer's first login after confirming.

Optional (recommended for deliverability): **Authentication → SMTP Settings** → host `smtp.gmail.com`, port `465`, user `hungryofficialx@gmail.com`, password = the Gmail App Password. This makes Supabase's own confirmation / reset emails come from HUNGRY too.

## 4. Connect Supabase to the app (YOU)

**In Lovable:** Project **Settings → General → External Supabase → Connect** and choose your project. This fills in the URL and keys.
If any of these are still missing, add them under **Project Settings → Secrets**:

| Name | Value | Secret? |
|------|-------|---------|
| `SUPABASE_URL` | Project URL | no |
| `SUPABASE_PUBLISHABLE_KEY` | publishable / anon key | no |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role / secret key | **yes — server only** |

The browser copies (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) are public by design.

**Other hosts:** set every name in `.env.example` in the host's environment settings. Never put the service role key, Razorpay secret, webhook secret, Gmail App Password or admin password in a `VITE_` variable or in the repository.

## 5. Backend secrets (YOU) — Lovable: Project Settings → Secrets

| Name | Where to get it |
|------|-----------------|
| `RAZORPAY_KEY_ID` | Razorpay Dashboard → Account & Settings → API Keys (test mode: `rzp_test_...`) |
| `RAZORPAY_KEY_SECRET` | shown once when you generate the key above |
| `RAZORPAY_WEBHOOK_SECRET` | any strong value you type when creating the webhook (step 6) — same value in both places |
| `GMAIL_APP_PASSWORD` | Google Account for hungryofficialx@gmail.com → Security → 2-Step Verification ON → App passwords → create "HUNGRY" → 16 characters |
| `GMAIL_USER` | optional, defaults to `hungryofficialx@gmail.com` |
| `ADMIN_PASSWORD` | a strong password you choose for `/admin` |

## 6. Razorpay webhook (YOU)

Razorpay Dashboard → **Account & Settings → Webhooks → Add new webhook**
- URL: `https://<your-published-site>/api/public/razorpay-webhook`
- Secret: the same value as `RAZORPAY_WEBHOOK_SECRET`
- Events: `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, `refund.failed`

Also set **Payment Capture → Automatic** (recommended). The app captures authorised payments itself if not.
Webhooks only reach a published site — publish first, then add the webhook.

## 7. Test checklist (test mode)

Razorpay test cards / UPI: <https://razorpay.com/docs/payments/payments/test-card-details/> (e.g. UPI `success@razorpay` / `failure@razorpay`).

- [ ] **Register** a student at `/auth` → confirm email → log in → **welcome email** arrives once (check Admin → Email log).
- [ ] **Canteen application** at `/register-canteen` → Admin (`/admin`) → **Approve** → approval email with a 7-character owner ID, separate owner password code, and student/faculty/guest canteen code. Sign in as owner with only the first two; use the third only to join as a customer. Try **Reject** on a second one → rejection email.
- [ ] Canteen owner logs in at `/canteen` with the contact email + code → add menu items (one with stock `2`).
- [ ] Student joins with the code → orders **Dine-in + Pay at counter** → order confirmation email, kitchen sees it instantly.
- [ ] **Parcel**: online payment is not offered; the order is pay-at-counter only.
- [ ] **Coupon**: Admin → Coupons → create `TEST10` (10%, min ₹100, 1 use). Apply below ₹100 → refused; above → discount shown; second use → refused.
- [ ] **Razorpay success**: Dine-in + Pay online → pay with a test method → status "Paid", confirmation email (only after payment). Kitchen sees it only after payment.
- [ ] **Razorpay failure**: pay with a failing test method → customer "payment failed" email + admin alert to hungryofficialx@gmail.com; "Pay now" retry works; "Cancel order" returns stock.
- [ ] **Duplicate**: double-click Pay / reload during payment → still one order and one charge.
- [ ] **Refund**: on a paid order tap "Request a refund" → customer + admin emails → Admin → Refunds → Approve → "processing" email → after Razorpay's `refund.processed` webhook, "refund completed" email and status Refunded.
- [ ] **Owner cancel** of a paid order → automatic full refund.
- [ ] **Stock**: the item with stock `2` shows "Only 2 left", then "Sold out" after two orders.

## 8. Go live

1. All of step 7 passes in test mode.
2. Razorpay: complete KYC → generate **Live** keys → replace `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` with the live values → create a **live-mode** webhook (same URL, events and secret).
3. Publish the site. Place one small real order and refund it.

## Security notes

- Prices, discounts, totals and stock are always computed in the database/server — the browser only sends item ids and quantities.
- An order is marked paid only after the server checks the Razorpay signature **and** fetches the payment from Razorpay (amount, currency, order id). Webhooks are signature-checked and de-duplicated.
- Order, payment, refund, coupon and email tables are read-only for customers (Row Level Security); all writes go through server code using the service role key.
