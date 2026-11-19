# HUNGRY Z notifications

HUNGRY Z notifications use the existing Supabase Auth and PostgreSQL backend, Supabase Realtime, and standards-based Web Push. There is no Firebase or FCM SDK in the app. The Edge Functions use `@portable/web-push` 0.1.0, which uses Web Crypto and `fetch` and documents Deno support; Supabase Edge Functions run on a Deno-compatible runtime.

## 1. Apply the database migration manually

Review and copy the complete contents of [`0026_web_push_notifications.sql`](../drizzle/migrations/0026_web_push_notifications.sql) into the correct project's Supabase SQL Editor, then run it once. This creates the notification history, per-device subscriptions, delivery deduplication records, RLS rules, Realtime publication entry, order/event/application triggers, and pg_net dispatch hook. It is intentionally not executed by the app or deployment scripts.

Enable the **Vault** extension in Supabase Database → Extensions if it is not already enabled. `pg_net` is enabled by the migration. The trigger still saves in-app notifications if the Vault values are not yet present; browser push starts after Vault and Edge secrets are configured.

## 2. Generate VAPID keys once

On a trusted local computer, run:

```sh
npx --yes web-push generate-vapid-keys --json
```

Keep the generated public/private pair together. Use the public key in Vercel's browser build configuration and the private key only as a Supabase Edge Function secret. Do not regenerate the pair after users have subscribed; changing it invalidates existing device subscriptions.

## 3. Configure function secrets

From an authenticated Supabase CLI session, set the Edge Function secrets (replace the placeholders with the newly generated values):

```powershell
supabase secrets set --project-ref hpzllbhusihvkbkbowut "VAPID_PUBLIC_KEY=<generated-public-key>" "VAPID_PRIVATE_KEY=<generated-private-key>" "VAPID_SUBJECT=mailto:hungryofficialx@gmail.com"
```

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. The functions use these only server-side. Never configure either as a `VITE_` variable.

## 4. Configure the database-to-Edge dispatch hook

Create these two values in Supabase Vault using SQL Editor. The project URL below comes from this repository's `supabase/config.toml`; confirm it matches the intended project before running. `VITE_SUPABASE_PUBLISHABLE_KEY` (or the legacy anon key configured for the same project) is public, but the database trigger needs it in the `apikey` header to call the Edge Function gateway.

```sql
select vault.create_secret(
  'https://hpzllbhusihvkbkbowut.supabase.co',
  'notification_dispatch_url',
  'HUNGRY Z Edge Function base URL'
);

select vault.create_secret(
  '<VITE_SUPABASE_PUBLISHABLE_KEY>',
  'notification_dispatch_apikey',
  'Public project key used for Edge Function gateway routing'
);
```

The database trigger sends only a notification ID and the public project key; it does not put privileged credentials in the queued HTTP request. The Edge Function reads the corresponding notification and recipient device subscriptions using its server-only service-role credentials.

## 5. Deploy Edge Functions

From the repository root, with Supabase CLI installed and logged in:

```sh
supabase functions deploy manage-push-subscription --project-ref hpzllbhusihvkbkbowut --no-verify-jwt
supabase functions deploy dispatch-push --project-ref hpzllbhusihvkbkbowut --no-verify-jwt
```

Both function entries disable gateway JWT verification because they validate requests themselves: subscription management calls `auth.getUser()` with the user's bearer token, while dispatch accepts only an existing notification ID. It never accepts arbitrary notification content or recipient IDs.

## 6. Configure Vercel

Set this **public** variable in Vercel for Production, Preview and Development as needed, then redeploy so it is included in the Vite client build:

```text
VITE_VAPID_PUBLIC_KEY=<generated-public-key>
```

No VAPID private key or service-role key belongs in Vercel's browser-visible `VITE_` variables. The Edge Function secrets are stored in Supabase, not the frontend.

## 7. Test

1. Apply the SQL migration and deploy both Edge Functions, then verify both functions appear in Supabase Edge Functions.
2. Add `VITE_VAPID_PUBLIC_KEY` in Vercel and deploy the app. Use HTTPS; browser Push requires a secure context.
3. Sign into a Student, Faculty, Guest, Canteen Owner and Admin account in separate browser profiles. Open the bell, check the in-app history and unread count, mark one/all read, and confirm other accounts cannot see the same rows.
4. Select **Enable on this device** from a user gesture. Confirm the browser permission prompt appears only then, and the device subscription is registered. Repeat in another browser/device for the same user to verify multiple devices.
5. With a customer dashboard visible, place an order and move it through accepted, preparing, ready and collected states. Confirm the bell count/history updates without refresh. Close or background the app and repeat to confirm the operating system notification appears and opens the order.
6. Submit a faculty event and a canteen application. Confirm the owner receives the event request and Admin receives the registration alert. Approve, quote and publish the event to check the relevant event deep links.
7. In Chrome site settings, block notifications and verify the UI reports blocked without repeatedly opening the prompt. Re-enable them from site settings, reload and enable the device. Disable notifications from the bell and verify this browser/device is removed.
8. Repeat in desktop Chrome and Android Chrome. For Android, test both a normal browser tab and the installed HUNGRY Z PWA. Android may group or delay notifications under battery-saving policies.

The automated checks in this repository cover migration application in PGlite, ownership/RLS, notification creation, deduplication and build behavior. This workspace does not have a physical Android device, an authenticated Supabase project, generated VAPID values or production access, so the real provider-delivery checks above still require execution after setup.
