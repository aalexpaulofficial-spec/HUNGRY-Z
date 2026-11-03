<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Backend is Lovable Cloud; schema changes go through Lovable migrations (`drizzle/migrations`). `database/*.sql` is the historical reference for the original schema. Storage buckets are private because the workspace blocks public buckets. Why: one managed backend for preview and live.
- HUNGRY SCANNER: client-safe plan/trial rules in `src/lib/scanner.ts` (tested in `src/test/scanner.test.ts`); server functions in `src/lib/scanner.functions.ts` call the AI gateway and write `food_scans` as the user; the free month starts once per student via the `hungry_start_scanner_trial` SQL function. Why: trial dates can't be set by clients.
- All privileged writes (applications, approvals, canteen joins, orders, payments, refunds, coupons, admin login) go through server functions in `src/lib/hungry.functions.ts`; customers/owners never write those tables directly — RLS and revoked grants enforce this. Why: totals, stock and payment state must stay consistent.
- Orders are created only via the `hungry_place_order` SQL function (row locks for stock + coupon limits, idempotency key); paid/cancel transitions only via `hungry_mark_order_paid` / `hungry_release_order`. Why: atomic, duplicate-safe state changes.
- Payment, refund and confirmation workflows live in `src/lib/orders.server.ts`, shared by server functions and the Razorpay webhook (`/api/public/razorpay-webhook`); every step is idempotent. Why: client callbacks and webhooks can arrive in any order or repeat.
- A Razorpay payment counts only after server-side signature check AND fetching the payment from Razorpay's API. Why: never trust client payment results.
- Pure business rules (coupons, payment-method rules, signatures) live in client-safe modules (`coupons.ts`, `order-rules.ts`, `razorpay-signature.ts`) with unit tests. Why: testable and shared by UI + server.
- Emails go through `src/lib/mailer.server.ts` (Gmail SMTP: worker-mailer on Workers, nodemailer in dev), logging every attempt to `email_logs`; content in `src/lib/email-templates.ts`. Why: one place for delivery, retries and logs.
- Customer data is scoped by `profiles.current_canteen_id`; canteen owners are linked via `canteens.owner_user_id` (matched to the application's contact email).
- Admin password lives only in the `ADMIN_PASSWORD` secret; the admin auth user and role are provisioned server-side on successful login.
