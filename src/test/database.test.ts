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

    const failures: string[] = [];
    const ok = (c: boolean | undefined, m: string) => { if (!c) failures.push(m); };
    const q = async (s: string, p?: unknown[]) => (await db.query<any>(s, p)).rows;
    const err = async (s: string, p?: unknown[]) => { try { await db.query(s, p); return null; } catch (e) { return (e as Error).message; } };

    const [a] = await q(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('a@x.com', '{"role":"student","full_name":"Asha K","registration_number":"R1"}') RETURNING id`);
    const [b] = await q(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('b@x.com', '{"role":"guest","full_name":"Bala"}') RETURNING id`);
    await q(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('f@x.com', '{"role":"faculty","full_name":"Faculty User","registration_number":"F1"}')`);
    const [owner] = await q(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('owner@owners.hungry.invalid', '{"role":"canteen_owner","full_name":"Owner User"}') RETURNING id`);
    ok((await q(`SELECT count(*)::int n FROM profiles`))[0].n === 3, "student, faculty, and guest users receive profiles but owner identities do not");
    const [c] = await q(`INSERT INTO canteens (code, name, university_name, campus_location, contact_email, owner_user_id) VALUES ('ABC1234','Main','Uni','Block A','o@x.com',$1) RETURNING id`, [owner.id]);
    ok(!!(await err(`UPDATE canteens SET timezone='UTC' WHERE id=$1`, [c.id])), "database keeps all canteen schedules in IST");
    const [supportRequest] = await q(`INSERT INTO support_requests (submission_id,user_id,canteen_id,sender_name,sender_email,sender_role,category,description,rating) VALUES (gen_random_uuid(),$1,$2,'Asha K','a@x.com','student','Rate Us','Great service',5) RETURNING id`, [a.id, c.id]);
    ok(!!supportRequest.id && (await q(`SELECT email_status FROM support_requests WHERE id=$1`, [supportRequest.id]))[0].email_status === "pending", "rating and comments are persisted before email delivery");
    ok(!!(await err(`INSERT INTO support_requests (submission_id,user_id,sender_name,sender_role,category,description) VALUES (gen_random_uuid(),$1,'Asha K','student','Rate Us','Missing rating')`, [a.id])), "Rate Us submissions require a one-to-five-star rating");
    const [m1] = await q(`INSERT INTO menu_items (canteen_id, name, price, stock) VALUES ($1,'Dosa',50,3) RETURNING id`, [c.id]);
    const [m2] = await q(`INSERT INTO menu_items (canteen_id, name, price) VALUES ($1,'Tea',20) RETURNING id`, [c.id]);

    const place = (user: string, lines: unknown, type: string, method: string, sub: number, coupon: string | null, disc: number, key: string, num: string) =>
      q(`SELECT * FROM hungry_place_order($1,$2,'X',$3::jsonb,$4,$5,$6,$7,$8,$9,$10,'1234')`,
        [user, c.id, JSON.stringify(lines), type, method, sub, coupon, disc, key, num]);

    const [o1] = await place(a.id, [{ id: m1.id, qty: 2 }, { id: m2.id, qty: 1 }], "dine_in", "counter", 120, null, 0, "key-aaaa-0001", "HG-A1");
    ok(!o1.already_existed, "counter order created");
    ok((await q(`SELECT stock FROM menu_items WHERE id=$1`, [m1.id]))[0].stock === 1, "stock reserved (3 -> 1)");
    const row1 = (await q(`SELECT * FROM orders WHERE id=$1`, [o1.order_id]))[0];
    ok(row1.status === "placed" && row1.payment_status === "unpaid" && row1.total === 120, "counter order placed/unpaid/total 120");
    await q(`INSERT INTO order_print_events (order_id,canteen_id,owner_user_id,order_number,order_type,payment_method,payment_status,order_status,paper_width,bill_snapshot) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'58',$9::jsonb)`, [o1.order_id, c.id, owner.id, row1.order_number, row1.order_type, row1.payment_method, row1.payment_status, row1.status, JSON.stringify({ lines: row1.lines, subtotal: row1.subtotal, total: row1.total })]);
    const [printSnapshot] = await q(`SELECT bill_snapshot,order_status,payment_status FROM order_print_events WHERE order_id=$1`, [o1.order_id]);
    const [orderAfterPrint] = await q(`SELECT status,payment_status FROM orders WHERE id=$1`, [o1.order_id]);
    ok(printSnapshot.bill_snapshot.total === 120 && printSnapshot.order_status === "placed", "confirmed bill print records the exact bill snapshot");
    ok(orderAfterPrint.status === "placed" && orderAfterPrint.payment_status === "unpaid", "bill print audit does not mark an order collected or paid");
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


    expect(failures).toEqual([]);
  }, 60_000);
});
