// @vitest-environment node
// Runs both database scripts on an in-memory Postgres and checks the order,
// stock, coupon, payment and privacy rules they enforce.
import { describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");

describe("database scripts", () => {
  it("apply cleanly and enforce order, coupon, payment and privacy rules", async () => {
    const db = new PGlite();
    await db.exec(`
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, raw_user_meta_data jsonb DEFAULT '{}'::jsonb);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text NOT NULL, public boolean NOT NULL DEFAULT false, file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text NOT NULL, name text NOT NULL);
CREATE FUNCTION storage.foldername(_name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array(_name, '/') $$;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON storage.objects TO anon, authenticated, service_role;
CREATE PUBLICATION supabase_realtime;`);
    await db.exec(readFileSync(path.join(root, "database/001_hungry_core.sql"), "utf8"));
    await db.exec(readFileSync(path.join(root, "database/002_payments_coupons_refunds.sql"), "utf8"));
    await db.exec(readFileSync(path.join(root, "database/003_canteen_owner_credentials.sql"), "utf8"));
    await db.exec(readFileSync(path.join(root, "database/004_canteen_owner_credential_guard.sql"), "utf8"));
    await db.exec(readFileSync(path.join(root, "database/005_canteen_menu_images.sql"), "utf8"));
    await db.exec(readFileSync(path.join(root, "database/006_canteen_templates.sql"), "utf8"));
    await db.exec(readFileSync(path.join(root, "database/007_canteen_template_crop.sql"), "utf8"));
    await db.exec(readFileSync(path.join(root, "database/008_user_language_preferences.sql"), "utf8"));
    await db.exec(readFileSync(path.join(root, "database/009_order_print_events.sql"), "utf8"));
    await db.exec(readFileSync(path.join(root, "database/010_support_requests.sql"), "utf8"));
    await db.exec(readFileSync(path.join(root, "database/011_canteen_availability.sql"), "utf8"));
    await db.exec(readFileSync(path.join(root, "database/012_canteen_ist_timezone.sql"), "utf8"));
    await db.exec(readFileSync(path.join(root, "drizzle/migrations/0004_registration_terms_consent.sql"), "utf8"));
    await db.exec(readFileSync(path.join(root, "drizzle/migrations/0005_faculty_event_tokens.sql"), "utf8"));
    await db.exec(readFileSync(path.join(root, "drizzle/migrations/0006_faculty_event_review_and_menu.sql"), "utf8"));
    await db.exec(readFileSync(path.join(root, "drizzle/migrations/0007_customer_bill_print_notifications.sql"), "utf8"));
    await db.exec(readFileSync(path.join(root, "drizzle/migrations/0008_faculty_event_food_request_message.sql"), "utf8"));
    await db.exec(readFileSync(path.join(root, "drizzle/migrations/0009_collected_order_thank_you.sql"), "utf8"));
    await db.exec(readFileSync(path.join(root, "drizzle/migrations/0010_printed_order_food_receipt_confirmation.sql"), "utf8"));
    await db.exec(readFileSync(path.join(root, "drizzle/migrations/0011_faculty_event_quote_and_participation.sql"), "utf8"));
    await db.exec(readFileSync(path.join(root, "drizzle/migrations/0013_faculty_event_additional_token_requests.sql"), "utf8"));
    await db.exec(readFileSync(path.join(root, "drizzle/migrations/0014_faculty_event_manual_quotation.sql"), "utf8"));
    await db.exec(readFileSync(path.join(root, "drizzle/migrations/0015_faculty_event_served_quantity_updates.sql"), "utf8"));
    await db.exec(readFileSync(path.join(root, "drizzle/migrations/0016_faculty_event_logos.sql"), "utf8"));
    await db.exec(readFileSync(path.join(root, "drizzle/migrations/0017_faculty_event_archive.sql"), "utf8"));
    await db.exec(readFileSync(path.join(root, "drizzle/migrations/0018_event_serial_and_order_based_ai_usage.sql"), "utf8"));

    const failures: string[] = [];
    const ok = (c: boolean | undefined, m: string) => { if (!c) failures.push(m); };
    // SQL in this integration test is deliberately dynamic and returns many unrelated row shapes.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = async (s: string, p?: unknown[]) => (await db.query<any>(s, p)).rows;
    const err = async (s: string, p?: unknown[]) => { try { await db.query(s, p); return null; } catch (e) { return (e as Error).message; } };

    const consentMeta = `"accepted_terms":true,"terms_version":"2026-11-04"`;
    const [a] = await q(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('a@x.com', '{"role":"student","full_name":"Asha K","registration_number":"R1",${consentMeta}}') RETURNING id`);
    const [b] = await q(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('b@x.com', '{"role":"guest","full_name":"Bala",${consentMeta}}') RETURNING id`);
    const [faculty] = await q(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('f@x.com', '{"role":"faculty","full_name":"Faculty User","registration_number":"F1",${consentMeta}}') RETURNING id`);
    const [owner] = await q(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('owner@owners.hungry.invalid', '{"role":"canteen_owner","full_name":"Owner User"}') RETURNING id`);
    ok((await q(`SELECT count(*)::int n FROM profiles`))[0].n === 3, "student, faculty, and guest users receive profiles but owner identities do not");
    const [c] = await q(`INSERT INTO canteens (code, name, university_name, campus_location, contact_email, owner_user_id) VALUES ('ABC1234','Main','Uni','Block A','o@x.com',$1) RETURNING id`, [owner.id]);
    await q(`UPDATE profiles SET current_canteen_id=$1 WHERE id IN ($2,$3,$4)`, [c.id, a.id, b.id, faculty.id]);
    ok((await q(`SELECT privacy_accepted_at IS NOT NULL AND terms_accepted_at IS NOT NULL AS accepted FROM profiles WHERE id=$1`, [a.id]))[0].accepted, "signup consent is recorded server-side on the customer profile");
    ok(!!(await err(`INSERT INTO auth.users (email,raw_user_meta_data) VALUES ('no-consent@x.com','{"role":"student","full_name":"No Consent","registration_number":"R2"}')`)), "student signup without consent is rejected by the auth.users trigger");
    const [event1] = await q(`INSERT INTO faculty_events (faculty_user_id,canteen_id,name,event_code,token_prefix,initial_capacity,approved_capacity,status,food_confirmation) VALUES ($1,$2,'Hackathon','1000001','H',100,100,'published','{"quantities":{"Tea":10},"prices":{"Tea":20}}') RETURNING id,serial_number`, [faculty.id, c.id]);
    ok(event1.serial_number === 1, "the first new event receives the first sequential serial number");
    ok(!!(await err(`UPDATE faculty_events SET serial_number=serial_number+100 WHERE id=$1`, [event1.id])), "event serials cannot be changed after assignment");
    ok((await q(`SELECT initial_capacity=100 AND approved_capacity=100 AS initial FROM faculty_events WHERE id=$1`, [event1.id]))[0].initial, "faculty event starts with the requested capacity of 100");
    const [logoBucket] = await q(`SELECT public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id='faculty-event-logos'`);
    ok(logoBucket.public === false && logoBucket.file_size_limit === 8388608 && logoBucket.allowed_mime_types.includes("image/avif"), "event logos use a private, size-limited image bucket");
    const eventOrder = (event: string, code: string, user: string, key: string, number: string) => q(
      `SELECT * FROM hungry_place_event_order($1,$2,$3,$4,'Event participant',$5::jsonb,'dine_in','counter',20,null,0,$6,$7,'1234')`,
      [event, code, user, c.id, JSON.stringify([{ id: m2.id, qty: 1 }]), key, number],
    );
    ok(!!(await err(`UPDATE canteens SET timezone='UTC' WHERE id=$1`, [c.id])), "database keeps all canteen schedules in IST");
    const [supportRequest] = await q(`INSERT INTO support_requests (submission_id,user_id,canteen_id,sender_name,sender_email,sender_role,category,description,rating) VALUES (gen_random_uuid(),$1,$2,'Asha K','a@x.com','student','Rate Us','Great service',5) RETURNING id`, [a.id, c.id]);
    ok(!!supportRequest.id && (await q(`SELECT email_status FROM support_requests WHERE id=$1`, [supportRequest.id]))[0].email_status === "pending", "rating and comments are persisted before email delivery");
    ok(!!(await err(`INSERT INTO support_requests (submission_id,user_id,sender_name,sender_role,category,description) VALUES (gen_random_uuid(),$1,'Asha K','student','Rate Us','Missing rating')`, [a.id])), "Rate Us submissions require a one-to-five-star rating");
    const [m1] = await q(`INSERT INTO menu_items (canteen_id, name, price, stock) VALUES ($1,'Dosa',50,3) RETURNING id`, [c.id]);
    const [m2] = await q(`INSERT INTO menu_items (canteen_id, name, price) VALUES ($1,'Tea',20) RETURNING id`, [c.id]);

    const [requestedEvent] = await q(`INSERT INTO faculty_events (faculty_user_id,canteen_id,name,event_code,token_prefix,event_date,venue,initial_capacity,approved_capacity,food_requirements,food_request_message) VALUES ($1,$2,'Requested','1000004','R','2026-12-01','Main Hall',5,5,'{"Tea":5}','Please pack the snacks separately.') RETURNING id,status,food_request_message,serial_number`, [faculty.id, c.id]);
    ok(requestedEvent.serial_number === event1.serial_number + 1, "the next event receives the next serial after the first event");
    ok(requestedEvent.status === "requested", "new faculty events remain private pending canteen review");
    ok(requestedEvent.food_request_message === "Please pack the snacks separately.", "optional faculty food instructions persist for the canteen dashboard");
    ok((await q(`SELECT hungry_review_faculty_event_request($1,$2,true,'Accepted') status`, [requestedEvent.id, owner.id]))[0].status === "accepted", "only the linked canteen owner accepts the faculty event request");
    ok((await q(`SELECT hungry_submit_faculty_event_quotation($1,$2,'{"Tea":5}'::jsonb,'{"Tea":22}'::jsonb,'Quote note') budget`, [requestedEvent.id, owner.id]))[0].budget === 110, "canteen sends item quantities, an event price and quotation total to faculty");
    ok((await q(`SELECT status,estimated_budget FROM faculty_events WHERE id=$1`, [requestedEvent.id]))[0].status === "quotation_received" && (await q(`SELECT estimated_budget FROM faculty_events WHERE id=$1`, [requestedEvent.id]))[0].estimated_budget === 110, "quotation is saved for faculty review before publication");
    ok(!!(await err(`SELECT hungry_review_faculty_event_quotation($1,$2,true,'')`, [requestedEvent.id, a.id])), "only the event faculty member can approve a quotation");
    ok((await q(`SELECT hungry_review_faculty_event_quotation($1,$2,true,'Approved') status`, [requestedEvent.id, faculty.id]))[0].status === "approved", "faculty approval moves the quotation to the publish-ready state");
    ok((await q(`SELECT hungry_publish_faculty_event($1,$2,'{"Tea":5}'::jsonb,'{"Tea":22}'::jsonb,'Confirmed') status`, [requestedEvent.id, owner.id]))[0].status === "published", "canteen can publish only the faculty-approved quotation");
    ok(!!(await err(`SELECT hungry_review_faculty_event_request($1,$2,true,'')`, [requestedEvent.id, a.id])), "a student cannot approve or publish a canteen event request");
    const [manualEvent] = await q(`INSERT INTO faculty_events (faculty_user_id,canteen_id,name,event_code,token_prefix,event_date,venue,initial_capacity,approved_capacity,food_requirements,food_request_message) VALUES ($1,$2,'Manual food request','1000006','M','2026-12-02','Main Hall',10,10,'{}','MAKE 10 CHICKEN BIRYANI') RETURNING id,serial_number`, [faculty.id, c.id]);
    ok(manualEvent.serial_number === requestedEvent.serial_number + 1, "message-only event requests keep the same sequential event serials");
    await q(`SELECT hungry_review_faculty_event_request($1,$2,true,'Accepted')`, [manualEvent.id, owner.id]);
    ok((await q(`SELECT hungry_submit_faculty_event_quotation($1,$2,'{"Chicken Biryani":10}'::jsonb,'{"Chicken Biryani":250}'::jsonb,'') budget`, [manualEvent.id, owner.id]))[0].budget === 2500, "message-only requests accept free-text manual quote items and calculate the total");
    const [manualQuote] = await q(`SELECT status,estimated_budget,food_confirmation FROM faculty_events WHERE id=$1`, [manualEvent.id]);
    ok(manualQuote.status === "quotation_received" && manualQuote.estimated_budget === 2500 && manualQuote.food_confirmation.quantities["Chicken Biryani"] === 10 && manualQuote.food_confirmation.prices["Chicken Biryani"] === 250, "manual quotation items, quantities, prices and total are stored for faculty review");
    await q(`SELECT hungry_review_faculty_event_quotation($1,$2,true,'Approved')`, [manualEvent.id, faculty.id]);
    ok((await q(`SELECT hungry_publish_faculty_event($1,$2,'{"Chicken Biryani":10}'::jsonb,'{"Chicken Biryani":250}'::jsonb,'') status`, [manualEvent.id, owner.id]))[0].status === "published", "manual quotation remains compatible with faculty approval and event publication");
    await q(`SELECT hungry_update_faculty_event_served_quantities($1,$2,'{"Chicken Biryani":12}'::jsonb)`, [manualEvent.id, owner.id]);
    const [servedManualEvent] = await q(`SELECT served_food_quantities,served_food_updated_at FROM faculty_events WHERE id=$1`, [manualEvent.id]);
    ok(servedManualEvent.served_food_quantities["Chicken Biryani"] === 12 && !!servedManualEvent.served_food_updated_at, "actual quantities persist with an update timestamp for historical manual quote items, even when served count exceeds planned count");
    ok(!!(await err(`SELECT hungry_update_faculty_event_served_quantities($1,$2,'{"Removed menu item":1}'::jsonb)`, [manualEvent.id, owner.id])), "actual-quantity updates reject item names outside the saved event quotation snapshot");
    const [eventToken] = await q(`SELECT * FROM hungry_issue_faculty_event_token($1,'1000004',$2,$3)`, [requestedEvent.id, faculty.id, c.id]);
    ok(eventToken.token_number === "0001" && eventToken.approved_capacity === 5 && eventToken.tokens_remaining === 4, "published event issues an independent four-digit participation token within approved capacity");
    const [duplicateEventToken] = await q(`SELECT * FROM hungry_issue_faculty_event_token($1,'1000004',$2,$3)`, [requestedEvent.id, faculty.id, c.id]);
    ok(duplicateEventToken.already_issued && duplicateEventToken.token_number === "0001", "repeat token requests return the same participant token without consuming capacity");
    const [eventTokenRow] = await q(`SELECT id,order_id FROM faculty_event_tokens WHERE event_id=$1 AND customer_id=$2`, [requestedEvent.id, faculty.id]);
    ok(eventTokenRow.order_id === null, "event participation tokens do not create or require a normal food order");
    ok((await q(`SELECT hungry_collect_faculty_event_token($1,$2) status`, [eventTokenRow.id, owner.id]))[0].status === "collected", "canteen owner verifies and records event-token serving");
    ok(!!(await err(`SELECT hungry_collect_faculty_event_token($1,$2)`, [eventTokenRow.id, a.id])), "only the participating canteen owner can mark an event token served");
    ok((await q(`SELECT hungry_update_faculty_event_served_quantities($1,$2,'{"Tea":3}'::jsonb) quantities`, [requestedEvent.id, owner.id]))[0].quantities.Tea === 3, "canteen records actual quantities served for final expenditure tracking");
    ok((await q(`SELECT hungry_update_faculty_event_served_quantities($1,$2,'{"Tea":6}'::jsonb) quantities`, [requestedEvent.id, owner.id]))[0].quantities.Tea === 6, "canteen can record actual quantities above the approved estimate");
    ok((await q(`SELECT (served_food_quantities->>'Tea')::int * (food_confirmation->'prices'->>'Tea')::int expenditure FROM faculty_events WHERE id=$1`, [requestedEvent.id]))[0].expenditure === 132, "final expenditure uses saved actual served quantities and approved prices");
    const [hackToken] = await eventOrder(event1.id, "1000001", a.id, "event-hack-001", "HG-EVT-1");
    ok(hackToken.token_number === "H001", "first event receives its own H001 sequence");
    const [duplicateHackToken] = await eventOrder(event1.id, "1000001", a.id, "event-hack-001", "HG-EVT-2");
    ok(duplicateHackToken.already_existed && duplicateHackToken.token_number === "H001", "repeated GET TOKEN request returns the same token and order");
    const [event2] = await q(`INSERT INTO faculty_events (faculty_user_id,canteen_id,name,event_code,token_prefix,initial_capacity,approved_capacity,status,food_confirmation) VALUES ($1,$2,'Workshop','1000002','W',1,1,'published','{"quantities":{"Tea":1},"prices":{"Tea":20}}') RETURNING id,serial_number`, [faculty.id, c.id]);
    ok(event2.serial_number === manualEvent.serial_number + 1, "serial numbering remains sequential across event workflows");
    const [workshopToken] = await eventOrder(event2.id, "1000002", b.id, "event-workshop-001", "HG-EVT-3");
    ok(workshopToken.token_number === "W001", "a separate event starts its own independent W001 sequence");
    ok((await err(`SELECT * FROM hungry_place_event_order($1,'1000002',$2,$3,'Full participant',$4::jsonb,'dine_in','counter',20,null,0,'event-workshop-full','HG-EVT-F','1')`, [event2.id, a.id, c.id, JSON.stringify([{ id: m2.id, qty: 1 }])]))?.includes("EVENT:full"), "event capacity rejects an allocation beyond capacity");
    ok((await q(`SELECT count(*)::int n FROM orders WHERE idempotency_key='event-workshop-full'`))[0].n === 0, "failed GET TOKEN rolls back its incomplete order");
    const [capacityRequest] = await q(`INSERT INTO faculty_event_capacity_requests (event_id,faculty_user_id,additional_tokens,proposed_capacity,revised_food_quantities) VALUES ($1,$2,10,110,'{"Tea":10}'::jsonb) RETURNING id`, [event1.id, faculty.id]);
    ok((await q(`SELECT hungry_resolve_faculty_event_capacity_request($1,$2,true,'{"Tea":10}'::jsonb,'{"Tea":20}'::jsonb,'Confirmed') status`, [capacityRequest.id, owner.id]))[0].status === "approved", "canteen can approve faculty-requested additional capacity");
    ok((await q(`SELECT approved_capacity FROM faculty_events WHERE id=$1`, [event1.id]))[0].approved_capacity === 110, "approval alone activates the revised event capacity");
    const [rejectedRequest] = await q(`INSERT INTO faculty_event_capacity_requests (event_id,faculty_user_id,additional_tokens,proposed_capacity,revised_food_quantities) VALUES ($1,$2,5,115,'{"Tea":15}'::jsonb) RETURNING id`, [event1.id, faculty.id]);
    await q(`SELECT hungry_resolve_faculty_event_capacity_request($1,$2,false,'{}'::jsonb,'{}'::jsonb,'Cannot prepare')`, [rejectedRequest.id, owner.id]);
    ok((await q(`SELECT approved_capacity FROM faculty_events WHERE id=$1`, [event1.id]))[0].approved_capacity === 110, "canteen rejection leaves approved capacity unchanged");
    const [secondHackToken] = await eventOrder(event1.id, "1000001", b.id, "event-hack-002", "HG-EVT-4");
    ok(secondHackToken.token_number === "H002", "approved capacity makes the next token H002");
    await q(`SELECT hungry_release_order($1)`, [secondHackToken.order_id]);
    ok((await q(`SELECT status FROM faculty_event_tokens WHERE order_id=$1`, [secondHackToken.order_id]))[0].status === "cancelled", "cancelling an event order marks its token cancelled for analytics");
    const [thirdHackToken] = await eventOrder(event1.id, "1000001", a.id, "event-hack-003", "HG-EVT-5");
    ok(thirdHackToken.token_number === "H003", "cancelled tokens are never reused");
    await q(`UPDATE orders SET status='collected' WHERE id=$1`, [hackToken.order_id]);
    ok((await q(`SELECT status FROM faculty_event_tokens WHERE order_id=$1`, [hackToken.order_id]))[0].status === "collected", "order collection updates the linked event token");
    ok((await q(`SELECT serial_number FROM faculty_events WHERE id=$1`, [event1.id]))[0].serial_number === event1.serial_number, "event serial survives quotation, capacity, and publication-related updates");
    await q(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [faculty.id]);
    const [hackStats] = await q(`SELECT * FROM hungry_get_event_capacity($1)`, [event1.id]);
    ok(hackStats.approved_capacity === 110 && hackStats.issued_tokens === 2 && hackStats.tokens_remaining === 108 && hackStats.collected_tokens === 1 && hackStats.cancelled_tokens === 1, "event capacity analytics exclude cancelled tokens and reserved pending requests consistently");
    const [event3] = await q(`INSERT INTO faculty_events (faculty_user_id,canteen_id,name,event_code,token_prefix,initial_capacity,approved_capacity,status,food_confirmation) VALUES ($1,$2,'Concurrent','1000003','C',1,1,'published','{"quantities":{"Tea":2},"prices":{"Tea":20}}') RETURNING id,serial_number`, [faculty.id, c.id]);
    await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [a.id]);
    const parallel = await Promise.allSettled([
      q(`SELECT * FROM hungry_issue_faculty_event_token($1,'1000003',$2,$3)`, [event3.id, a.id, c.id]),
      q(`SELECT * FROM hungry_issue_faculty_event_token($1,'1000003',$2,$3)`, [event3.id, b.id, c.id]),
    ]);
    ok(parallel.filter((result) => result.status === "fulfilled").length === 1, "simultaneous users cannot oversell a one-token event");
    ok((await q(`SELECT count(*)::int n FROM faculty_event_tokens WHERE event_id=$1`, [event3.id]))[0].n === 1, "atomic event allocation creates only one token under contention");
    const [event4] = await q(`INSERT INTO faculty_events (faculty_user_id,canteen_id,name,event_code,token_prefix,initial_capacity,approved_capacity,status,food_confirmation) VALUES ($1,$2,'Additional tokens','1000005','A',5,5,'published','{"quantities":{"Tea":5},"prices":{"Tea":20}}') RETURNING id,serial_number`, [faculty.id, c.id]);
    ok(event4.serial_number === event3.serial_number + 1, "later event records receive new unique sequential numbers");
    const [studentTokenRequest] = await q(`SELECT hungry_request_faculty_event_tokens($1,$2,3) result`, [event4.id, a.id]);
    ok(studentTokenRequest.result.status === "pending" && studentTokenRequest.result.tokens_remaining === 2, "student additional-token request reserves only its requested event capacity");
    ok(!!(await err(`SELECT hungry_request_faculty_event_tokens($1,$2,3)`, [event4.id, b.id])), "additional token request is rejected when the requested count exceeds free event capacity");
    const [singleWhileReserved] = await q(`SELECT * FROM hungry_issue_faculty_event_token($1,'1000005',$2,$3)`, [event4.id, b.id, c.id]);
    ok(singleWhileReserved.tokens_remaining === 1, "ordinary token issuance cannot consume places reserved for a pending additional-token request");
    const [resolvedTokenRequest] = await q(`SELECT hungry_resolve_faculty_event_token_request($1,$2,true,'Approved') result`, [studentTokenRequest.result.request_id, owner.id]);
    ok(resolvedTokenRequest.result.status === "approved" && resolvedTokenRequest.result.tokens.length === 3, "canteen approval creates the requested number of individual event tokens");
    ok((await q(`SELECT count(*)::int n FROM faculty_event_tokens WHERE event_id=$1 AND customer_id=$2 AND status='issued'`, [event4.id, a.id]))[0].n === 3, "approved student tokens are visible as separate entries for QR generation and serving");
    await q(`UPDATE faculty_events SET archived_at=now(), status='closed' WHERE id=$1`, [event4.id]);
    const [archivedEvent] = await q(`SELECT archived_at IS NOT NULL archived, status FROM faculty_events WHERE id=$1`, [event4.id]);
    ok(archivedEvent.archived && archivedEvent.status === "closed", "archived event closes token issuance and can be excluded from active dashboards");
    ok((await q(`SELECT count(*)::int n FROM faculty_event_tokens WHERE event_id=$1`, [event4.id]))[0].n === 4, "archiving preserves existing student tokens and their event history");
    ok(!!(await err(`SELECT * FROM hungry_issue_faculty_event_token($1,'1000005',$2,$3)`, [event4.id, b.id, c.id])), "students cannot generate new tokens for an archived event");
    ok((await q(`SELECT serial_number FROM faculty_events WHERE id=$1`, [event4.id]))[0].serial_number === event4.serial_number, "event serial remains unchanged when an event is closed and archived");
    await q(`UPDATE profiles SET current_canteen_id=NULL WHERE id IN ($1,$2)`, [b.id, faculty.id]);

    const place = (user: string, lines: unknown, type: string, method: string, sub: number, coupon: string | null, disc: number, key: string, num: string) =>
      q(`SELECT * FROM hungry_place_order($1,$2,'X',$3::jsonb,$4,$5,$6,$7,$8,$9,$10,'1234')`,
        [user, c.id, JSON.stringify(lines), type, method, sub, coupon, disc, key, num]);

    const [o1] = await place(a.id, [{ id: m1.id, qty: 2 }, { id: m2.id, qty: 1 }], "dine_in", "counter", 120, null, 0, "key-aaaa-0001", "HG-A1");
    ok(!o1.already_existed, "counter order created");
    ok((await q(`SELECT stock FROM menu_items WHERE id=$1`, [m1.id]))[0].stock === 1, "stock reserved (3 -> 1)");
    const row1 = (await q(`SELECT * FROM orders WHERE id=$1`, [o1.order_id]))[0];
    ok(row1.status === "placed" && row1.payment_status === "unpaid" && row1.total === 120, "counter order placed/unpaid/total 120");
    const [printConfirmed] = await q(`SELECT * FROM hungry_confirm_order_bill_print($1,$2,'58')`, [o1.order_id, owner.id]);
    ok(!printConfirmed.already_confirmed, "first owner-confirmed print creates its print record and customer notification");
    const [duplicatePrint] = await q(`SELECT * FROM hungry_confirm_order_bill_print($1,$2,'80')`, [o1.order_id, owner.id]);
    ok(duplicatePrint.already_confirmed, "repeated print confirmation does not create a duplicate record or notification");
    ok((await q(`SELECT count(*)::int n FROM order_print_events WHERE order_id=$1`, [o1.order_id]))[0].n === 1, "one order has a single bill print audit record");
    const [printSnapshot] = await q(`SELECT bill_snapshot,order_status,payment_status FROM order_print_events WHERE order_id=$1`, [o1.order_id]);
    const [orderAfterPrint] = await q(`SELECT status,payment_status,bill_print_confirmed_at,bill_print_thank_you_seen_at FROM orders WHERE id=$1`, [o1.order_id]);
    ok(printSnapshot.bill_snapshot.total === 120 && printSnapshot.order_status === "placed", "confirmed bill print records the exact bill snapshot");
    ok(orderAfterPrint.status === "placed" && orderAfterPrint.payment_status === "unpaid" && !!orderAfterPrint.bill_print_confirmed_at && !orderAfterPrint.bill_print_thank_you_seen_at, "bill print leaves physical order and payment states untouched while recording the print");
    ok((await q(`SELECT completion_workflow FROM orders WHERE id=$1`, [o1.order_id]))[0].completion_workflow === "printed", "bill print selects the separate printed-order workflow");
    ok(!!(await err(`SELECT hungry_acknowledge_bill_print_thank_you($1,$2)`, [o1.order_id, b.id])), "a different customer cannot acknowledge the order's thank-you message");
    ok((await q(`SELECT hungry_acknowledge_bill_print_thank_you($1,$2) acknowledged`, [o1.order_id, a.id]))[0].acknowledged, "the order's customer can acknowledge the thank-you message");
    ok(!(await q(`SELECT hungry_acknowledge_bill_print_thank_you($1,$2) acknowledged`, [o1.order_id, a.id]))[0].acknowledged, "repeated popup dismissal is idempotent");
    const [collectedPrintOrder] = await place(a.id, [{ id: m2.id, qty: 1 }], "dine_in", "counter", 20, null, 0, "key-thank-print-01", "HG-TY0");
    await q(`SELECT * FROM hungry_confirm_order_bill_print($1,$2,'58')`, [collectedPrintOrder.order_id, owner.id]);
    ok(!!(await err(`SELECT * FROM hungry_confirm_printed_order_food_received($1,$2)`, [collectedPrintOrder.order_id, b.id])), "another customer cannot confirm receipt of a printed order");
    ok(!!(await err(`SELECT hungry_acknowledge_collected_order_thank_you($1,$2)`, [collectedPrintOrder.order_id, a.id])), "the thank-you popup cannot be acknowledged before printed food is received");
    const [received] = await q(`SELECT * FROM hungry_confirm_printed_order_food_received($1,$2)`, [collectedPrintOrder.order_id, a.id]);
    ok(!!received.confirmed_at && !received.already_confirmed, "the order's customer can confirm physical receipt after the bill is printed");
    const [duplicateReceived] = await q(`SELECT * FROM hungry_confirm_printed_order_food_received($1,$2)`, [collectedPrintOrder.order_id, a.id]);
    ok(duplicateReceived.already_confirmed, "physical receipt confirmation is idempotent");
    const [printedReceiptOrder] = await q(`SELECT status,payment_status,completion_workflow,food_received_confirmed_at FROM orders WHERE id=$1`, [collectedPrintOrder.order_id]);
    ok(printedReceiptOrder.status === "placed" && printedReceiptOrder.payment_status === "unpaid" && printedReceiptOrder.completion_workflow === "printed" && !!printedReceiptOrder.food_received_confirmed_at, "customer receipt confirmation preserves payment and manual status while persisting physical receipt");
    const [usageEntitlementOrder] = await place(a.id, [{ id: m2.id, qty: 1 }], "dine_in", "counter", 20, null, 0, "key-ai-usage-0001", "HG-AIU");
    await q(`UPDATE orders SET status='collected',completion_workflow='manual' WHERE id=$1`, [usageEntitlementOrder.order_id]);
    const [usageEntitlementOrder2] = await place(a.id, [{ id: m2.id, qty: 1 }], "dine_in", "counter", 20, null, 0, "key-ai-usage-0002", "HG-AIV");
    await q(`UPDATE orders SET status='collected',completion_workflow='manual' WHERE id=$1`, [usageEntitlementOrder2.order_id]);
    await q(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [faculty.id]);
    ok((await err(`SELECT * FROM hungry_get_scanner_usage()`))?.includes("students_only"), "faculty cannot retrieve HUNGRY AI usage from the database API");
    ok((await err(`SELECT * FROM hungry_reserve_scanner_usage('11111111-1111-4111-8111-111111111111')`))?.includes("students_only"), "faculty cannot reserve HUNGRY AI analysis usages");
    await q(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [b.id]);
    ok((await err(`SELECT * FROM hungry_get_scanner_usage()`))?.includes("students_only"), "guest cannot retrieve HUNGRY AI usage from the database API");
    await q(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [a.id]);
    const [aiUsageBefore] = await q(`SELECT * FROM hungry_get_scanner_usage()`);
    ok(aiUsageBefore.completed_orders === 4 && aiUsageBefore.total_usages === 4 && aiUsageBefore.used_usages === 0 && aiUsageBefore.remaining_usages === 4, `four completed orders earn four HUNGRY AI usages ${JSON.stringify(aiUsageBefore)}`);
    const requestId = "11111111-1111-4111-8111-111111111111";
    const [reservedUsage] = await q(`SELECT * FROM hungry_reserve_scanner_usage($1)`, [requestId]);
    const [duplicateReservation] = await q(`SELECT * FROM hungry_reserve_scanner_usage($1)`, [requestId]);
    ok(reservedUsage.reserved && !duplicateReservation.reserved, "an analysis request id can reserve usage only once");
    const [completedUsage] = await q(`SELECT * FROM hungry_complete_scanner_usage($1)`, [requestId]);
    ok(completedUsage.used_usages === 1 && completedUsage.remaining_usages === 3, `a completed AI analysis consumes one order-earned usage ${JSON.stringify(completedUsage)}`);
    const [secondUsage] = await q(`SELECT * FROM hungry_reserve_scanner_usage('33333333-3333-4333-8333-333333333333')`);
    ok(secondUsage.reserved && secondUsage.remaining_usages === 2, "a second completed order permits a second analysis usage");
    await q(`SELECT * FROM hungry_complete_scanner_usage('33333333-3333-4333-8333-333333333333')`);
    const [thirdUsage] = await q(`SELECT * FROM hungry_reserve_scanner_usage('44444444-4444-4444-8444-444444444444')`);
    ok(thirdUsage.reserved && thirdUsage.remaining_usages === 1, "four orders with three completed analyses show one usage remaining");
    await q(`SELECT * FROM hungry_complete_scanner_usage('44444444-4444-4444-8444-444444444444')`);
    const [fourthUsage] = await q(`SELECT * FROM hungry_reserve_scanner_usage('55555555-5555-4555-8555-555555555555')`);
    ok(fourthUsage.reserved && fourthUsage.remaining_usages === 0, "the fourth completed order permits a fourth analysis usage");
    await q(`SELECT * FROM hungry_complete_scanner_usage('55555555-5555-4555-8555-555555555555')`);
    const overLimitError = await err(`SELECT * FROM hungry_reserve_scanner_usage('22222222-2222-4222-8222-222222222222')`);
    ok(!!overLimitError?.includes("usage_limit_reached"), `the database prevents analysis after the student's order-earned usage is exhausted ${overLimitError}`);
    ok((await q(`SELECT count(*)::int n FROM scanner_usage WHERE user_id=$1 AND status='completed'`, [a.id]))[0].n === 4, "retrying the same analysis id does not double-deduct any usage");
    ok(!!(await err(`SELECT hungry_acknowledge_collected_order_thank_you($1,$2)`, [collectedPrintOrder.order_id, b.id])), "another customer cannot dismiss the collection popup");
    ok(!(await q(`SELECT collection_thank_you_seen_at FROM orders WHERE id=$1`, [collectedPrintOrder.order_id]))[0].collection_thank_you_seen_at, "the thank-you remains available after receipt confirmation until the customer dismisses it");
    ok((await q(`SELECT hungry_acknowledge_collected_order_thank_you($1,$2) acknowledged`, [collectedPrintOrder.order_id, a.id]))[0].acknowledged, "the customer can dismiss the thank-you popup after confirming printed food receipt");
    ok(!(await q(`SELECT hungry_acknowledge_collected_order_thank_you($1,$2) acknowledged`, [collectedPrintOrder.order_id, a.id]))[0].acknowledged, "the thank-you dismissal is persisted and idempotent");
    ok(!!(await q(`SELECT collection_thank_you_seen_at FROM orders WHERE id=$1`, [collectedPrintOrder.order_id]))[0].collection_thank_you_seen_at, "the one-time thank-you state persists after dismissal");
    const [manualThankYouOrder] = await place(b.id, [{ id: m2.id, qty: 1 }], "dine_in", "counter", 20, null, 0, "key-thank-manual-01", "HG-TY1");
    await q(`UPDATE orders SET status='collected',completion_workflow='manual' WHERE id=$1`, [manualThankYouOrder.order_id]);
    ok((await q(`SELECT hungry_acknowledge_collected_order_thank_you($1,$2) acknowledged`, [manualThankYouOrder.order_id, b.id]))[0].acknowledged, "manual orders receive the same collection thank-you after collection");
    const [o1b] = await place(a.id, [{ id: m1.id, qty: 2 }], "dine_in", "counter", 100, null, 0, "key-aaaa-0001", "HG-A2");
    ok(o1b.already_existed && o1b.order_id === o1.order_id, "same idempotency key returns same order");
    ok((await q(`SELECT stock FROM menu_items WHERE id=$1`, [m1.id]))[0].stock === 1, "duplicate submit does not touch stock");

    await q(`UPDATE canteens SET availability_mode='closed' WHERE id=$1`, [c.id]);
    ok((await err(`SELECT * FROM hungry_place_order($1,$2,'X',$3::jsonb,'dine_in','counter',20,null,0,'key-closed-01','HG-CL1','1')`, [a.id, c.id, JSON.stringify([{ id: m2.id, qty: 1 }])]))?.includes("canteen_closed"), "manual CLOSED blocks counter orders in the database");
    ok((await err(`SELECT * FROM hungry_place_order($1,$2,'X',$3::jsonb,'dine_in','razorpay',20,null,0,'key-closed-02','HG-CL2','1')`, [a.id, c.id, JSON.stringify([{ id: m2.id, qty: 1 }])]))?.includes("canteen_closed"), "manual CLOSED blocks online orders in the database");
    ok((await err(`INSERT INTO orders (order_number,canteen_id,user_id,customer_name,lines,total,subtotal,payment,pickup_code,counter,prep_minutes,order_type,payment_method) VALUES ('HG-OFFLINE-CLOSED',$1,$2,'Offline retry','[]',0,0,'Pay at counter','1','Counter 1',1,'parcel','counter')`, [c.id, a.id]))?.includes("canteen_closed"), "database trigger blocks a delayed or offline order insert while closed");
    const istParts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Kolkata", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    const istValues = Object.fromEntries(istParts.map((part) => [part.type, part.value]));
    const weekdayKey = istValues["weekday"]!.toLowerCase();
    const closingMinute = Number(istValues["hour"]) * 60 + Number(istValues["minute"]) + 2;
    const closing = closingMinute >= 1440 ? "24:00" : `${String(Math.floor(closingMinute / 60)).padStart(2, "0")}:${String(closingMinute % 60).padStart(2, "0")}`;
    const todayHours = Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => [day, day === weekdayKey ? { open: "00:00", close: closing } : null]));
    await q(`UPDATE canteens SET availability_mode='schedule', operating_hours=$2::jsonb WHERE id=$1`, [c.id, JSON.stringify(todayHours)]);
    const [scheduled] = await place(a.id, [{ id: m2.id, qty: 1 }], "dine_in", "counter", 20, null, 0, "key-schedule1", "HG-SCH1");
    ok(!!scheduled.order_id, "scheduled open hours allow orders");
    await q(`UPDATE canteens SET operating_hours=jsonb_set(operating_hours, ARRAY[$2], 'null'::jsonb) WHERE id=$1`, [c.id, weekdayKey]);
    ok((await err(`SELECT * FROM hungry_place_order($1,$2,'X',$3::jsonb,'dine_in','counter',20,null,0,'key-schedule2','HG-SCH2','1')`, [a.id, c.id, JSON.stringify([{ id: m2.id, qty: 1 }])]))?.includes("canteen_closed"), "scheduled closed hours block orders");

    await q(`UPDATE canteens SET availability_mode='open' WHERE id=$1`, [c.id]);

    ok((await err(`SELECT * FROM hungry_place_order($1,$2,'X',$3::jsonb,'parcel','razorpay',20,null,0,'key-parcel-01','HG-P1','1')`, [a.id, c.id, JSON.stringify([{ id: m2.id, qty: 1 }])]))?.includes("parcel_counter_only"), "parcel + razorpay rejected");
    const [op] = await place(a.id, [{ id: m2.id, qty: 1 }], "parcel", "counter", 20, null, 0, "key-parcel-02", "HG-P2");
    ok(!!op.order_id, "parcel + counter allowed");
    ok((await err(`INSERT INTO orders (order_number, canteen_id, user_id, customer_name, lines, total, subtotal, payment, pickup_code, counter, prep_minutes, order_type, payment_method) VALUES ('HG-Z',$1,$2,'x','[]',0,0,'x','1','c',1,'parcel','razorpay')`, [c.id, a.id]))?.includes("orders_parcel_counter_only"), "table constraint blocks parcel online too");

    ok((await err(`SELECT * FROM hungry_place_order($1,$2,'X',$3::jsonb,'dine_in','counter',100,null,0,'key-stock-001','HG-S1','1')`, [b.id, c.id, JSON.stringify([{ id: m1.id, qty: 2 }])]))?.includes("out_of_stock"), "out of stock blocked");
    ok((await err(`SELECT * FROM hungry_place_order($1,$2,'X',$3::jsonb,'dine_in','counter',999,null,0,'key-price-001','HG-S2','1')`, [b.id, c.id, JSON.stringify([{ id: m2.id, qty: 1 }])]))?.includes("prices_changed"), "subtotal mismatch blocked");

    const [cp] = await q(`INSERT INTO coupons (code, discount_type, discount_value, usage_limit, min_order_value) VALUES ('WELCOME10','percent',10,1,30) RETURNING id`);
    ok((await err(`SELECT * FROM hungry_place_order($1,$2,'X',$3::jsonb,'dine_in','counter',20,$4,2,'key-cmin-0001','HG-C0','1')`, [b.id, c.id, JSON.stringify([{ id: m2.id, qty: 1 }]), cp.id]))?.includes("coupon_min_order"), "coupon min order enforced");
    const [oc] = await place(b.id, [{ id: m2.id, qty: 2 }], "dine_in", "razorpay", 40, cp.id, 4, "key-coup-0001", "HG-C1");
    const rowc = (await q(`SELECT * FROM orders WHERE id=$1`, [oc.order_id]))[0];
    ok(rowc.total === 36 && rowc.status === "pending_payment" && rowc.payment_status === "pending", "razorpay order pending, total 40-4=36");
    ok((await q(`SELECT status FROM coupon_redemptions WHERE order_id=$1`, [oc.order_id]))[0].status === "reserved", "coupon reserved while unpaid");
    ok((await err(`SELECT * FROM hungry_place_order($1,$2,'X',$3::jsonb,'dine_in','counter',40,$4,4,'key-coup-0002','HG-C2','1')`, [a.id, c.id, JSON.stringify([{ id: m2.id, qty: 2 }]), cp.id]))?.includes("coupon_exhausted"), "coupon usage limit enforced");

    ok((await q(`SELECT hungry_mark_order_paid($1) r`, [oc.order_id]))[0].r === "paid", "first payment confirmation -> paid");
    ok((await q(`SELECT hungry_mark_order_paid($1) r`, [oc.order_id]))[0].r === "already_paid", "duplicate confirmation is a no-op");
    ok((await q(`SELECT status FROM coupon_redemptions WHERE order_id=$1`, [oc.order_id]))[0].status === "used", "coupon used after payment");

    ok((await q(`SELECT hungry_release_order($1) r`, [o1.order_id]))[0].r === true, "release order");
    ok((await q(`SELECT stock FROM menu_items WHERE id=$1`, [m1.id]))[0].stock === 3, "stock restored on cancel");
    ok((await q(`SELECT hungry_release_order($1) r`, [o1.order_id]))[0].r === false, "release is idempotent");

    await q(`INSERT INTO refunds (order_id, user_id, amount, reason) VALUES ($1,$2,36,'changed mind')`, [oc.order_id, b.id]);
    ok((await err(`INSERT INTO refunds (order_id, user_id, amount, reason) VALUES ($1,$2,36,'again please')`, [oc.order_id, b.id]))?.includes("refunds_one_active_per_order"), "only one live refund per order");

    // expire stale
    const [os] = await place(a.id, [{ id: m1.id, qty: 1 }], "dine_in", "razorpay", 50, null, 0, "key-stale-001", "HG-ST");
    await q(`UPDATE orders SET created_at = now() - interval '45 minutes' WHERE id=$1`, [os.order_id]);
    ok((await q(`SELECT hungry_expire_stale_orders(30) n`))[0].n === 1, "stale unpaid order expired");
    ok((await q(`SELECT hungry_mark_order_paid($1) r`, [os.order_id]))[0].r === "order_cancelled", "late payment on expired order detected");

    // RLS / privileges as authenticated
    await db.exec(`SET ROLE authenticated`);
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [a.id]);
    ok((await q(`SELECT count(*)::int n FROM orders WHERE user_id=$1`, [b.id]))[0].n === 0, "user A cannot read user B's orders");
    ok((await q(`SELECT count(*)::int n FROM orders`))[0].n >= 1, "user A reads own orders");
    ok(!!(await err(`UPDATE orders SET total = 0`)), "customers cannot update orders");
    ok(!!(await err(`SELECT * FROM hungry_place_order($1,$2,'X','[]'::jsonb,'dine_in','counter',0,null,0,'key-x-000001','HG-X','1')`, [a.id, c.id])), "customers cannot call order function directly");
    ok(!!(await err(`SELECT hungry_mark_order_paid($1)`, [oc.order_id])), "customers cannot mark orders paid");
    ok((await q(`SELECT count(*)::int n FROM coupons`))[0].n === 0, "customers cannot list coupons");
    ok((await q(`SELECT count(*)::int n FROM email_logs`))[0].n === 0, "customers cannot read email logs");
    ok((await q(`SELECT count(*)::int n FROM support_requests`))[0].n === 1, "users can read their own support submissions");
    ok(!!(await err(`INSERT INTO support_requests (submission_id,user_id,sender_name,sender_role,category,description) VALUES (gen_random_uuid(),$1,'Asha K','student','Feedback','Try to insert from client')`, [a.id])), "support submissions can only be inserted by server code");
    ok(!!(await err(`SELECT * FROM canteen_owner_credentials`)), "customers cannot read owner credential hashes");
    ok(!!(await err(`INSERT INTO payments (order_id,user_id,razorpay_order_id,razorpay_payment_id,amount_paise,status) VALUES ($1,$2,'o','p',1,'captured')`, [o1.order_id, a.id])), "customers cannot insert payments");
    await db.exec(`RESET ROLE`);

    const [application] = await q(`INSERT INTO canteen_applications (owner_name,owner_phone,canteen_name,university_name,campus_location,contact_email,fssai_license,owner_id_proof,status) VALUES ('Asha K','1234567890','Main','Uni','Block A','owner@x.com','FSSAI12345','ID1234','approved') RETURNING id`);
    await q(`UPDATE canteens SET application_id=$1 WHERE id=$2`, [application.id, c.id]);
    const [otherCanteen] = await q(`INSERT INTO canteens (code,name,university_name,campus_location,contact_email,owner_user_id) VALUES ('XYZ1234','Other','Uni','Block B','other@x.com',$1) RETURNING id`, [b.id]);
    const [imageBucket] = await q(`SELECT public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id='canteen-menu-images'`);
    ok(imageBucket.public && imageBucket.file_size_limit === 8388608 && imageBucket.allowed_mime_types.includes("image/webp"), "food image bucket is public-read and limits image size and MIME types");
    const [bannerBucket] = await q(`SELECT public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id='canteen-home-banners'`);
    ok(bannerBucket.public && bannerBucket.file_size_limit === 8388608 && bannerBucket.allowed_mime_types.includes("image/avif"), "canteen banner bucket is public-read and accepts the supported image types");
    await db.exec(`SET ROLE authenticated`);
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [owner.id]);
    ok((await q(`SELECT count(*)::int n FROM order_print_events WHERE order_id=$1`, [o1.order_id]))[0].n === 1, "canteen owner reads their bill print audit record");
    ok((await q(`SELECT count(*)::int n FROM support_requests WHERE id=$1`, [supportRequest.id]))[0].n === 1, "canteen owners can read support submissions associated with their canteen");
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [b.id]);
    ok((await q(`SELECT count(*)::int n FROM order_print_events`))[0].n === 0, "other users cannot read canteen bill print audit records");
    ok((await q(`SELECT count(*)::int n FROM support_requests`))[0].n === 0, "other users cannot read another customer's support submissions");
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [owner.id]);
    await q(`INSERT INTO user_language_preferences (user_id,language) VALUES ($1,'hi')`, [owner.id]);
    await q(`UPDATE user_language_preferences SET language='kn' WHERE user_id=$1`, [owner.id]);
    ok((await q(`SELECT language FROM user_language_preferences WHERE user_id=$1`, [owner.id]))[0].language === "kn", "owner can save and retrieve their dashboard language preference");
    ok(!!(await err(`UPDATE user_language_preferences SET language='fr' WHERE user_id=$1`, [owner.id])), "language preferences are limited to English, Hindi, and Kannada");
    ok(!!(await err(`INSERT INTO user_language_preferences (user_id,language) VALUES ($1,'hi')`, [a.id])), "owner cannot set a language preference for another user");
    await q(`INSERT INTO canteen_templates (canteen_id,banner_image_url,heading,description) VALUES ($1,'https://images.example/banner.jpg','Welcome','Fresh food on campus')`, [c.id]);
    await q(`UPDATE canteen_templates SET heading='Today at Main', banner_crop_x=64, banner_crop_y=42, banner_crop_zoom=1.4 WHERE canteen_id=$1`, [c.id]);
    const savedTemplate = (await q(`SELECT heading,banner_crop_x,banner_crop_y,banner_crop_zoom FROM canteen_templates WHERE canteen_id=$1`, [c.id]))[0];
    ok(savedTemplate.heading === "Today at Main" && savedTemplate.banner_crop_x === 64 && savedTemplate.banner_crop_y === 42 && savedTemplate.banner_crop_zoom === 1.4, "canteen owner can save/update their template crop and students can retrieve it");
    ok(!!(await err(`UPDATE canteen_templates SET banner_crop_zoom=3.1 WHERE canteen_id=$1`, [c.id])), "banner zoom is constrained to supported crop range");
    ok(!!(await err(`INSERT INTO canteen_templates (canteen_id,heading) VALUES ($1,'Unauthorized')`, [otherCanteen.id])), "canteen owner cannot create a template for another canteen");
    await q(`INSERT INTO storage.objects (bucket_id, name) VALUES ('canteen-menu-images', $1)`, [`${c.id}/owner-food.jpg`]);
    ok(!!(await err(`INSERT INTO storage.objects (bucket_id, name) VALUES ('canteen-menu-images', '00000000-0000-0000-0000-000000000000/not-owned.jpg')`)), "canteen owners cannot upload images into another canteen's folder");
    await q(`INSERT INTO storage.objects (bucket_id,name) VALUES ('canteen-home-banners',$1)`, [`${c.id}/home-banner.webp`]);
    ok(!!(await err(`INSERT INTO storage.objects (bucket_id,name) VALUES ('canteen-home-banners',$1)`, [`${otherCanteen.id}/not-owned.webp`])), "canteen owners cannot upload banner images into another canteen's folder");
    await db.exec(`RESET ROLE`);
    await q(`UPDATE profiles SET current_canteen_id=$1 WHERE id=$2`, [c.id, a.id]);
    await db.exec(`SET ROLE authenticated`);
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [a.id]);
    ok((await q(`SELECT heading FROM canteen_templates WHERE canteen_id=$1`, [c.id]))[0].heading === "Today at Main", "student can read the joined canteen's template");
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [b.id]);
    ok((await q(`SELECT count(*)::int n FROM canteen_templates WHERE canteen_id=$1`, [c.id]))[0].n === 0, "student cannot read another canteen's private template row");
    await db.exec(`RESET ROLE; SET ROLE anon`);
    ok((await q(`SELECT count(*)::int n FROM storage.objects WHERE bucket_id='canteen-menu-images'`))[0].n === 1, "uploaded food images can be read publicly for customer menus");
    ok((await q(`SELECT count(*)::int n FROM storage.objects WHERE bucket_id='canteen-home-banners'`))[0].n === 1, "canteen banner images can be read publicly by students");
    await db.exec(`RESET ROLE`);
    const salt = "0123456789abcdef0123456789abcdef";
    const hash = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const [credential] = await q(`INSERT INTO canteen_owner_credentials (canteen_id,login_id,code_salt,code_hash) VALUES ($1,'ABCDEFG',$2,$3) RETURNING login_id,code_salt,code_hash`, [c.id, salt, hash]);
    ok(credential.login_id === "ABCDEFG" && credential.login_id.length === 7, "approved canteen receives a unique seven-character owner ID");
    ok(credential.code_hash === hash && credential.code_hash !== "WNR2223", "database stores only the owner password code hash");
    ok(!!(await err(`INSERT INTO canteen_owner_credentials (canteen_id,login_id,code_salt,code_hash) VALUES ($1,'SHORT1',$2,$3)`, [c.id, salt, hash])), "database rejects owner IDs with the wrong length");
    ok(!!(await err(`INSERT INTO canteen_owner_credentials (canteen_id,login_id,code_salt,code_hash) VALUES ($1,'ABC1234',$2,$3)`, [c.id, salt, hash])), "owner ID cannot equal the customer canteen code");
    ok(!!(await err(`INSERT INTO canteens (code,name,university_name,campus_location,contact_email) VALUES ('ABCDEFG','Duplicate','Uni','Block D','duplicate@x.com')`)), "customer canteen code cannot equal an owner ID");

    const [pendingApp] = await q(`INSERT INTO canteen_applications (owner_name,owner_phone,canteen_name,university_name,campus_location,contact_email,fssai_license,owner_id_proof,status) VALUES ('Pending Owner','1234567890','Pending','Uni','Block B','pending@x.com','FSSAI12346','ID12345','pending') RETURNING id`);
    const [pendingCanteen] = await q(`INSERT INTO canteens (code,application_id,name,university_name,campus_location,contact_email) VALUES ('PND1234',$1,'Pending','Uni','Block B','pending@x.com') RETURNING id`, [pendingApp.id]);
    ok(!!(await err(`INSERT INTO canteen_owner_credentials (canteen_id,login_id,code_salt,code_hash) VALUES ($1,'BCDEFGH',$2,$3)`, [pendingCanteen.id, salt, hash])), "pending applications cannot receive active owner credentials");
    const [rejectedApp] = await q(`INSERT INTO canteen_applications (owner_name,owner_phone,canteen_name,university_name,campus_location,contact_email,fssai_license,owner_id_proof,status) VALUES ('Rejected Owner','1234567890','Rejected','Uni','Block C','rejected@x.com','FSSAI12347','ID12346','rejected') RETURNING id`);
    const [rejectedCanteen] = await q(`INSERT INTO canteens (code,application_id,name,university_name,campus_location,contact_email) VALUES ('REJ1234',$1,'Rejected','Uni','Block C','rejected@x.com') RETURNING id`, [rejectedApp.id]);
    ok(!!(await err(`INSERT INTO canteen_owner_credentials (canteen_id,login_id,code_salt,code_hash) VALUES ($1,'CDEFGHJ',$2,$3)`, [rejectedCanteen.id, salt, hash])), "rejected applications cannot receive active owner credentials");

    const ipKey = "a".repeat(64);
    const ownerKey = "b".repeat(64);
    let rateAllowed = true;
    for (let i = 0; i < 5; i++) rateAllowed = (await q(`SELECT hungry_allow_canteen_owner_login($1,$2) allowed`, [ipKey, ownerKey]))[0].allowed;
    ok(rateAllowed, "owner login permits up to five attempts per rate-limit window");
    ok(!(await q(`SELECT hungry_allow_canteen_owner_login($1,$2) allowed`, [ipKey, ownerKey]))[0].allowed, "owner login rate limit blocks the next attempt");


    expect(failures, failures.join("\n")).toEqual([]);
  }, 60_000);
});
