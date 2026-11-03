# HUNGRY production upgrade

- [x] Import uploaded project into workspace
- [x] Hero: Register Canteen button above ₹0 box (nav button kept), mobile-safe
- [x] .env.example + setup docs (docs/SETUP.md)
- [x] SQL scripts: database/001 core + 002 payments/coupons/refunds/email logs, RLS, realtime (tested on local Postgres)
- [x] Emails: welcome, order confirmation, payment failure, refunds, canteen approval/rejection, admin alerts, logs
- [x] Razorpay: server order creation, signature verify, webhook, failures, duplicates, refunds
- [x] Coupons + orders: server validation, idempotency, inventory, parcel = counter only
- [x] Admin: refunds, coupons, payments, email logs; canteen: status/cancel via server
- [ ] Live end-to-end test — blocked on owner: connect Supabase, run SQL, add Razorpay test keys + Gmail App Password + admin password
- [ ] Back arrow (←) on every page/form/dashboard/checkout/subpage; returns to previous screen without losing entered data
- [ ] Hero: no empty space under phone; nav no wrapping; performance pass; auth renders immediately; non-customers routed to their dashboards
