# Hosted Supabase Auth templates

These HTML files are the branded templates for Supabase Auth. The hosted project does not read them directly from this repository; copy each file into **Supabase Dashboard → Authentication → Email Templates** for the matching template. Keep the existing Gmail SMTP settings unchanged.

## URL Configuration

Set the Site URL to:

`https://hungryz.vercel.app`

Add this Redirect URL:

`https://hungryz.vercel.app/**`

Keep any required local development URLs. Remove obsolete entries for `https://hungryofficial.vercel.app` and `https://hungryzq.vercel.app` after confirming they are no longer in use.

The app's password reset request sends the exact redirect `https://hungryz.vercel.app/reset-password`. Signup confirmation also uses the production site origin.

## Authentication templates

| Supabase template | File | Suggested subject |
| --- | --- | --- |
| Confirm signup | `confirmation.html` | Confirm your HUNGRY Z email |
| Reset password | `recovery.html` | Reset your HUNGRY Z password |
| Invite user | `invite.html` | You are invited to HUNGRY Z |
| Magic link | `magic_link.html` | Your HUNGRY Z sign-in link |
| Change email | `email_change.html` | Confirm your new HUNGRY Z email |
| Reauthentication | `reauthentication.html` | Verify your HUNGRY Z account |

## Security notifications

The matching branded templates are `password_changed_notification.html` and `email_changed_notification.html`. Enable the corresponding notifications in Supabase only if they are currently part of the product's auth policy.

The account verification and recovery templates retain Supabase's `{{ .ConfirmationURL }}` tokenized URL. Supabase still owns verification and SMTP delivery; the page links to `https://hungryz.vercel.app` after verification.
