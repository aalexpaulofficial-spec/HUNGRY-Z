import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { WEEKDAYS, type WeeklyHours } from "@/lib/canteen-availability";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  accessCodeSchema,
  applicationSchema,
  canAcceptOrders,
  generateCanteenCode,
  isCustomerRole,
  visibilities,
} from "@/lib/access";
import { couponCodeSchema } from "@/lib/coupons";
import type { CanteenApplicationStatus } from "@/lib/canteen-owner-flow";
import { canAccessOwnerCanteen } from "@/lib/canteen-owner-flow";
import { generateOwnerCredentialPair, hashOwnerLoginCode, ownerLoginRateLimitKey, verifyOwnerCredentialPair } from "@/lib/owner-credentials";
import {
  ORDER_TYPES,
  PAYMENT_METHODS,
  canOwnerMove,
  canRequestRefund,
  friendlyOrderError,
  isPaymentAllowed,
  mergeLines,
} from "@/lib/order-rules";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function canteenDashboardInstallUrl() {
  const configuredHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "hungryz.vercel.app";
  const origin = configuredHost.startsWith("https://") ? configuredHost : `https://${configuredHost}`;
  return new URL("/install/canteen", origin).toString();
}

const eventFoodQuantities = z.record(z.string().trim().min(1).max(120), z.number().int().min(0).max(100000));
export const createFacultyEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    name: z.string().trim().min(2).max(120),
    eventCode: z.string().regex(/^[0-9]{7}$/),
    description: z.string().trim().max(1000).default(""),
    eventDate: z.string().date(),
    venue: z.string().trim().min(2).max(200),
    foodRequestMessage: z.string().trim().max(500).default(""),
    initialCapacity: z.number().int().min(1).max(9999),
    foodRequirements: z.record(z.string().trim().min(1).max(120), z.number().int().min(1).max(100000)).default({}),
  }).refine((data) => Object.keys(data.foodRequirements).length > 0 || data.foodRequestMessage.trim().length > 0, {
    message: "Select at least one food item or enter a message to the canteen.",
    path: ["foodRequirements"],
  }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: profile, error: profileError } = await db.from("profiles").select("role,current_canteen_id").eq("id", context.userId).maybeSingle();
    if (profileError || profile?.role !== "faculty" || !profile.current_canteen_id) throw new Error("Join your participating canteen before creating an event.");
    const { data: canteen } = await db.from("canteens").select("id,is_active").eq("id", profile.current_canteen_id).maybeSingle();
    if (!canteen?.is_active) throw new Error("Your participating canteen is unavailable.");
    const { data: menuItems, error: menuError } = await db.from("menu_items").select("name").eq("canteen_id", profile.current_canteen_id).eq("available", true);
    if (menuError) throw new Error("Could not verify the requested event menu.");
    const requestedNames = Object.keys(data.foodRequirements);
    if (requestedNames.some((name) => menuItems?.filter((item) => item.name === name).length !== 1)) {
      throw new Error("Choose food item names that match one available item in your joined canteen menu.");
    }
    const prefix = data.name.trim().match(/[A-Za-z]/)?.[0]?.toUpperCase() ?? "E";
    const { data: row, error } = await db.from("faculty_events").insert({
      faculty_user_id: context.userId,
      canteen_id: profile.current_canteen_id,
      name: data.name,
      description: data.description,
      event_date: data.eventDate,
      venue: data.venue,
      food_request_message: data.foodRequestMessage,
      food_requirements: data.foodRequirements,
      event_code: data.eventCode,
      token_prefix: prefix,
      initial_capacity: data.initialCapacity,
      approved_capacity: data.initialCapacity,
      status: "requested",
    }).select("id,event_code").single();
    if (error || !row) throw new Error(error?.message.includes("faculty_events_event_code_key") ? "That 7-digit Event Code is already in use." : "Could not create the event. Please try again.");
    return row;
  });

export const updateFacultyEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    eventId: z.string().uuid(),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(1000),
    eventDate: z.string().date(),
    venue: z.string().trim().min(2).max(200),
    foodRequestMessage: z.string().trim().max(500).default(""),
    foodRequirements: eventFoodQuantities,
  }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: event, error: readError } = await db.from("faculty_events").select("id,faculty_user_id").eq("id", data.eventId).maybeSingle();
    if (readError || event?.faculty_user_id !== context.userId) throw new Error("You cannot change this event.");
    const { error } = await db.from("faculty_events").update({ name: data.name, description: data.description, event_date: data.eventDate, venue: data.venue, food_request_message: data.foodRequestMessage, food_requirements: data.foodRequirements, updated_at: new Date().toISOString() }).eq("id", data.eventId).in("status", ["requested", "accepted", "changes_requested"]);
    if (error) throw new Error("Could not update the event.");
    return { ok: true };
  });

export const requestFacultyEventCapacity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    eventId: z.string().uuid(),
    additionalTokens: z.number().int().min(1).max(9999),
    revisedFoodQuantities: eventFoodQuantities,
  }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: event, error } = await db.from("faculty_events").select("id,faculty_user_id,approved_capacity,status").eq("id", data.eventId).maybeSingle();
    if (error || event?.faculty_user_id !== context.userId || event.status !== "published") throw new Error("Additional capacity can be requested after the event is published.");
    const { data: pending } = await db.from("faculty_event_capacity_requests").select("id").eq("event_id", data.eventId).eq("status", "pending").maybeSingle();
    if (pending) throw new Error("A capacity request is already awaiting the canteen.");
    const proposedCapacity = event.approved_capacity + data.additionalTokens;
    if (proposedCapacity > 9999) throw new Error("Event capacity cannot exceed 9,999 participants because event tokens use four digits.");
    const { data: request, error: insertError } = await db.from("faculty_event_capacity_requests").insert({
      event_id: data.eventId,
      faculty_user_id: context.userId,
      additional_tokens: data.additionalTokens,
      proposed_capacity: proposedCapacity,
      revised_food_quantities: data.revisedFoodQuantities,
    }).select("id").single();
    if (insertError || !request) throw new Error(insertError?.message.includes("faculty_event_one_pending_capacity_request") ? "A capacity request is already awaiting the canteen." : "Could not send the capacity request.");
    return { ok: true, requestId: request.id, proposedCapacity };
  });

export const reviewFacultyEventRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ eventId: z.string().uuid(), accept: z.boolean(), note: z.string().trim().max(500).default("") }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: result, error } = await db.rpc("hungry_review_faculty_event_request", {
      p_event_id: data.eventId,
      p_canteen_owner_id: context.userId,
      p_accept: data.accept,
      p_note: data.note,
    });
    if (error) throw new Error(error.message.includes("EVENT:not_canteen_owner") ? "You cannot review this event." : "This event request was already handled.");
    return { status: result };
  });

export const submitFacultyEventQuotation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    eventId: z.string().uuid(),
    quantities: z.record(z.string().trim().min(1).max(120), z.number().int().min(1).max(100000)),
    prices: z.record(z.string().trim().min(1).max(120), z.number().int().min(0).max(10000000)),
    note: z.string().trim().max(500).default(""),
  }).refine((value) => Object.keys(value.quantities).length > 0 && Object.keys(value.quantities).length === Object.keys(value.prices).length && Object.keys(value.quantities).every((name) => Object.hasOwn(value.prices, name)), "Add matching quantities and prices for the quotation.").parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: budget, error } = await db.rpc("hungry_submit_faculty_event_quotation", {
      p_event_id: data.eventId,
      p_canteen_owner_id: context.userId,
      p_quantities: data.quantities,
      p_prices: data.prices,
      p_note: data.note,
    });
    if (error) throw new Error(error.message.replace("EVENT:", ""));
    return { estimatedBudget: budget as number };
  });

export const reviewFacultyEventQuotation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ eventId: z.string().uuid(), approve: z.boolean(), note: z.string().trim().max(500).default("") }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: status, error } = await db.rpc("hungry_review_faculty_event_quotation", {
      p_event_id: data.eventId,
      p_faculty_user_id: context.userId,
      p_approve: data.approve,
      p_note: data.note,
    });
    if (error) throw new Error(error.message.replace("EVENT:", ""));
    return { status: status as string };
  });

export const issueFacultyEventToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ eventId: z.string().uuid(), eventCode: z.string().regex(/^[0-9]{7}$/) }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: profile, error: profileError } = await db.from("profiles").select("role,current_canteen_id").eq("id", context.userId).maybeSingle();
    if (profileError || !profile?.current_canteen_id || !["student", "faculty", "guest"].includes(profile.role)) throw new Error("Join the participating canteen before generating an event token.");
    const { data: tokens, error } = await db.rpc("hungry_issue_faculty_event_token", {
      p_event_id: data.eventId,
      p_event_code: data.eventCode,
      p_customer_user_id: context.userId,
      p_canteen_id: profile.current_canteen_id,
    });
    if (error) {
      if (error.message.includes("EVENT:full")) throw new Error("EVENT FULL");
      if (error.message.includes("EVENT:invalid_or_closed")) throw new Error("This event is not available. Check the Event Code.");
      if (error.message.includes("EVENT:not_participant")) throw new Error("Join the participating canteen to get this event token.");
      throw new Error("Could not generate the event token. Please try again.");
    }
    const token = (tokens as { token_number: string; approved_capacity: number; issued_tokens: number; tokens_remaining: number; already_issued: boolean }[] | null)?.[0];
    if (!token) throw new Error("Could not generate the event token. Please try again.");
    return token;
  });

export const collectFacultyEventToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ tokenId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: status, error } = await db.rpc("hungry_collect_faculty_event_token", { p_token_id: data.tokenId, p_canteen_owner_id: context.userId });
    if (error) throw new Error(error.message.includes("EVENT:token_not_issued") ? "This event token has already been served or cancelled." : "You cannot verify this event token.");
    return { status };
  });

export const updateFacultyEventServedQuantities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ eventId: z.string().uuid(), quantities: eventFoodQuantities }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { error } = await db.rpc("hungry_update_faculty_event_served_quantities", {
      p_event_id: data.eventId,
      p_canteen_owner_id: context.userId,
      p_quantities: data.quantities,
    });
    if (error) throw new Error(error.message.replace("EVENT:", ""));
    return { ok: true };
  });

export const publishFacultyEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    eventId: z.string().uuid(),
    confirmedFoodQuantities: eventFoodQuantities,
    confirmedFoodPrices: z.record(z.string().trim().min(1).max(120), z.number().int().min(0).max(10000000)),
    note: z.string().trim().max(500).default(""),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: result, error } = await db.rpc("hungry_publish_faculty_event", {
      p_event_id: data.eventId,
      p_canteen_owner_id: context.userId,
      p_confirmed_food_quantities: data.confirmedFoodQuantities,
      p_confirmed_food_prices: data.confirmedFoodPrices,
      p_note: data.note,
    });
    if (error) throw new Error(error.message.replace("EVENT:", ""));
    return { status: result };
  });

export const resolveFacultyEventCapacity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    requestId: z.string().uuid(),
    approve: z.boolean(),
    note: z.string().trim().max(500).default(""),
    confirmedFoodQuantities: eventFoodQuantities.default({}),
    confirmedFoodPrices: z.record(z.string().trim().min(1).max(120), z.number().int().min(0).max(10000000)).default({}),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: result, error } = await db.rpc("hungry_resolve_faculty_event_capacity_request", {
      p_request_id: data.requestId,
      p_canteen_owner_id: context.userId,
      p_approve: data.approve,
      p_confirmed_food_quantities: data.confirmedFoodQuantities,
      p_confirmed_food_prices: data.confirmedFoodPrices,
      p_note: data.note,
    });
    if (error) throw new Error(error.message.includes("EVENT:not_canteen_owner") ? "You cannot confirm this event request." : "This request has already been handled or could not be updated.");
    return { status: result };
  });

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const ADMIN_EMAIL = "aalexpaulofficial@gmail.com";

/* ---------------- Public: canteen application ---------------- */
export const submitCanteenApplication = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => applicationSchema.parse(input))
  .handler(async ({ data }) => {
    const db = await admin();
    const { count } = await db
      .from("canteen_applications")
      .select("id", { count: "exact", head: true })
      .eq("contact_email", data.contactEmail.toLowerCase())
      .eq("status", "pending");
    if ((count ?? 0) >= 3) throw new Error("You already have applications under review for this email.");
    const { error } = await db.from("canteen_applications").insert({
      owner_name: data.ownerName,
      owner_phone: data.ownerPhone,
      canteen_name: data.canteenName,
      university_name: data.universityName,
      campus_location: data.campusLocation,
      contact_email: data.contactEmail.toLowerCase(),
      fssai_license: data.fssaiLicense,
      owner_id_proof: data.ownerIdProof,
      notes: data.notes || null,
    });
    if (error) throw new Error("Could not submit your application. Please try again.");
    return { ok: true };
  });
/* ---------------- Public: approved canteen owner login ---------------- */
export const loginCanteenOwner = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({
    loginId: z.string().trim().toUpperCase().regex(/^[A-Z2-9]{7}$/),
    code: z.string().trim().toUpperCase().regex(/^[A-Z2-9]{7}$/),
  }).parse(input))
  .handler(async ({ data }) => {
    const db = await admin();
    const request = getRequest();
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
    const [ipKey, ownerKey] = await Promise.all([
      ownerLoginRateLimitKey(`ip:${ip}`),
      ownerLoginRateLimitKey(`owner:${data.loginId}`),
    ]);
    const { data: allowed, error: limitError } = await db.rpc("hungry_allow_canteen_owner_login", {
      p_ip_key: ipKey,
      p_owner_key: ownerKey,
    });
    if (limitError) throw new Error("Owner login is temporarily unavailable. Please try again later.");
    if (!allowed) throw new Error("Too many login attempts. Wait 15 minutes and try again.");

    const { data: credential, error: credentialError } = await db
      .from("canteen_owner_credentials")
      .select("canteen_id,login_id,code_salt,code_hash")
      .eq("login_id", data.loginId)
      .maybeSingle();
    if (credentialError) throw new Error("Owner login is temporarily unavailable. Please try again later.");
    const invalid = "Canteen Owner ID or Password Code is invalid, or this canteen is not approved.";
    if (!credential || !(await verifyOwnerCredentialPair(data.loginId, data.code, credential))) throw new Error(invalid);

    const { data: canteen, error: canteenError } = await db
      .from("canteens")
      .select("id,application_id,name,is_active,owner_user_id")
      .eq("id", credential.canteen_id)
      .maybeSingle();
    if (canteenError) throw new Error("Owner login is temporarily unavailable. Please try again later.");
    if (!canteen?.is_active || !canteen.application_id) throw new Error(invalid);
    const { data: application, error: applicationError } = await db
      .from("canteen_applications")
      .select("status,owner_name")
      .eq("id", canteen.application_id)
      .maybeSingle();
    if (applicationError) throw new Error("Owner login is temporarily unavailable. Please try again later.");
    if (!application || !canAccessOwnerCanteen(canteen.is_active, application.status)) throw new Error(invalid);

    const ownerEmail = `canteen-owner-${canteen.id}@owners.hungry.invalid`;
    let ownerUser: { id: string; email?: string } | null = null;
    if (canteen.owner_user_id) {
      const { data: current, error } = await db.auth.admin.getUserById(canteen.owner_user_id);
      if (error) throw new Error("Could not prepare your owner session. Please try again.");
      if (current.user?.email?.toLowerCase() === ownerEmail) ownerUser = current.user;
    }
    if (!ownerUser) {
      const { data: created, error } = await db.auth.admin.createUser({
        email: ownerEmail,
        email_confirm: true,
        user_metadata: { role: "canteen_owner", full_name: application.owner_name },
      });
      if (created.user) ownerUser = created.user;
      else if (error) ownerUser = await findAuthUserByEmail(db, ownerEmail);
      if (!ownerUser) throw new Error("Could not prepare your owner account. Please try again.");
    }
    if (canteen.owner_user_id !== ownerUser.id) {
      const { error } = await db.from("canteens").update({ owner_user_id: ownerUser.id }).eq("id", canteen.id);
      if (error) throw new Error("Could not link your owner account. Please try again.");
    }

    const { data: link, error: linkError } = await db.auth.admin.generateLink({ type: "magiclink", email: ownerEmail });
    if (linkError || !link.properties.hashed_token) throw new Error("Could not create a secure owner session. Please try again.");
    const { createClient } = await import("@supabase/supabase-js");
    const authUrl = process.env["SUPABASE_URL"];
    const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!authUrl || !publishableKey) throw new Error("Owner login is not configured. Please contact support.");
    const authClient = createClient(authUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: sessionData, error: sessionError } = await authClient.auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: link.properties.verification_type,
    });
    if (sessionError || !sessionData.session) throw new Error("Could not create a secure owner session. Please try again.");
    return { accessToken: sessionData.session.access_token, refreshToken: sessionData.session.refresh_token };
  });

async function findAuthUserByEmail(db: Awaited<ReturnType<typeof admin>>, email: string) {
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) throw new Error("Could not safely check for an existing owner account. Please try again.");
    const user = data.users.find((candidate) => candidate.email?.trim().toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < 1000) return null;
  }
  throw new Error("Could not safely check for an existing owner account. Please try again.");
}

export const getCanteenOwnerAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({}).parse(input))
  .handler(async ({ context }) => {
    const db = await admin();
    const { data: canteen, error } = await db.from("canteens")
      .select("id,application_id,owner_user_id,is_active")
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error("Could not verify your approved canteen. Please try again.");
    if (!canteen || !canteen.application_id || !canteen.is_active) return { status: "missing" as const, linked: false };
    const { data: application, error: applicationError } = await db.from("canteen_applications")
      .select("status")
      .eq("id", canteen.application_id)
      .maybeSingle();
    if (applicationError) throw new Error("Could not verify your approved canteen. Please try again.");
    const status = (application?.status ?? "missing") as CanteenApplicationStatus;
    return { status, linked: canAccessOwnerCanteen(canteen.is_active, status) };
  });

const dailyHoursSchema = z.union([
  z.object({ open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/) }).refine(({ open, close }) => {
    if (open === "00:00" && close === "24:00") return true;
    const toMinutes = (value: string) => value === "24:00" ? 1440 : Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
    return toMinutes(close) > toMinutes(open);
  }, "Closing time must be after opening time."),
  z.null(),
]);
const weeklyHoursSchema = z.object(Object.fromEntries(WEEKDAYS.map(({ key }) => [key, dailyHoursSchema])) as Record<(typeof WEEKDAYS)[number]["key"], typeof dailyHoursSchema>);

export const saveCanteenAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    availabilityMode: z.enum(["schedule", "open", "closed"]),
    operatingHours: weeklyHoursSchema,
  }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: canteen, error } = await db.from("canteens").update({
      availability_mode: data.availabilityMode,
      timezone: "Asia/Kolkata",
      operating_hours: data.operatingHours as unknown as import("@/integrations/supabase/types").Json,
    }).eq("owner_user_id", context.userId).eq("is_active", true)
      .select("id,availability_mode,timezone,operating_hours,is_active,visibility").maybeSingle();
    if (error) throw new Error("Could not save availability. Make sure database/011_canteen_availability.sql has been applied, then try again.");
    if (!canteen) throw new Error("Your approved canteen could not be found for this owner account.");
    return canteen;
  });

const MENU_IMAGE_BUCKET = "canteen-menu-images";
const MENU_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
const MENU_IMAGE_BUCKET_OPTIONS = {
  public: true,
  fileSizeLimit: 8 * 1024 * 1024,
  allowedMimeTypes: [...MENU_IMAGE_TYPES],
};

/** Creates a short-lived, one-path upload token only after verifying the approved canteen owner. */
export const createCanteenMenuImageUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    canteenId: z.string().uuid(),
    contentType: z.enum(MENU_IMAGE_TYPES),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: canteen, error: canteenError } = await db
      .from("canteens")
      .select("id,application_id,is_active")
      .eq("id", data.canteenId)
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    if (canteenError) throw new Error("Could not verify canteen image upload access.");
    if (!canteen?.is_active || !canteen.application_id) throw new Error("Only the approved canteen owner can upload menu images.");

    const { data: application, error: applicationError } = await db
      .from("canteen_applications")
      .select("status")
      .eq("id", canteen.application_id)
      .maybeSingle();
    if (applicationError) throw new Error("Could not verify canteen approval for image upload.");
    if (!canAccessOwnerCanteen(canteen.is_active, (application?.status ?? "missing") as CanteenApplicationStatus)) {
      throw new Error("Only the approved canteen owner can upload menu images.");
    }

    const extensionByType: Record<(typeof MENU_IMAGE_TYPES)[number], string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/avif": "avif",
    };
    const path = `${canteen.id}/${crypto.randomUUID()}.${extensionByType[data.contentType]}`;
    const storage = db.storage.from(MENU_IMAGE_BUCKET);
    const { data: bucket, error: bucketError } = await db.storage.getBucket(MENU_IMAGE_BUCKET);
    const bucketMissing = bucketError && (bucketError.statusCode === "404" || /bucket not found/i.test(bucketError.message));
    if (bucketError && !bucketMissing) throw new Error("Could not check the food image storage bucket.");

    if (!bucket) {
      const { error: createError } = await db.storage.createBucket(MENU_IMAGE_BUCKET, MENU_IMAGE_BUCKET_OPTIONS);
      if (createError && !/already exists|duplicate/i.test(createError.message)) {
        throw new Error("Food image storage is not ready. Please contact support.");
      }
    } else if (
      !bucket.public ||
      bucket.file_size_limit !== MENU_IMAGE_BUCKET_OPTIONS.fileSizeLimit ||
      MENU_IMAGE_TYPES.some((type) => !bucket.allowed_mime_types?.includes(type)) ||
      bucket.allowed_mime_types?.length !== MENU_IMAGE_TYPES.length
    ) {
      const { error: updateError } = await db.storage.updateBucket(MENU_IMAGE_BUCKET, MENU_IMAGE_BUCKET_OPTIONS);
      if (updateError) throw new Error("Could not configure secure food image storage.");
    }

    const { data: signed, error: signedError } = await storage.createSignedUploadUrl(path);
    if (signedError || !signed) throw new Error("Could not prepare the food image upload. Please try again.");
    return {
      path,
      token: signed.token,
      publicUrl: storage.getPublicUrl(path).data.publicUrl,
    };
  });

/* ---------------- Public: admin login (server-verified) ---------------- */
export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ email: z.string().trim().max(255), password: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const secret = process.env["ADMIN_PASSWORD"];
    if (!secret) throw new Error("Admin access is not configured yet.");
    const ok = safeEqual(data.email.toLowerCase(), ADMIN_EMAIL) && safeEqual(data.password, secret);
    if (!ok) {
      await new Promise((r) => setTimeout(r, 800));
      throw new Error("Invalid admin credentials.");
    }
    const db = await admin();
    let userId: string | undefined;
    for (let page = 1; page <= 20 && !userId; page++) {
      const { data: list, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
      if (error || !list) throw new Error("Could not verify the Admin account in Supabase. Please try again.");
      userId = list.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL)?.id;
      if (list.users.length < 200) break;
    }
    if (!userId) {
      const { data: created, error } = await db.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: secret,
        email_confirm: true,
      });
      if (error || !created.user) throw new Error("Could not prepare admin account.");
      userId = created.user.id;
    } else {
      const { error } = await db.auth.admin.updateUserById(userId, { password: secret, email_confirm: true });
      if (error) throw new Error("Could not prepare the Admin account in Supabase. Please try again.");
    }
    const { error: roleError } = await db.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    if (roleError) throw new Error("Could not assign the Admin role in Supabase. Please try again.");
    return { ok: true };
  });

/* ---------------- Admin actions ---------------- */
async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const approveApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { data: app } = await db.from("canteen_applications").select("*").eq("id", data.id).maybeSingle();
    if (!app) throw new Error("Application not found");
    if (app.status !== "pending") throw new Error("Application was already reviewed");
    let code = "";
    for (let i = 0; i < 10; i++) {
      const c = generateCanteenCode();
      const [{ count: canteenCount, error: canteenError }, { count: ownerIdCount, error: ownerIdError }] = await Promise.all([
        db.from("canteens").select("id", { count: "exact", head: true }).eq("code", c),
        db.from("canteen_owner_credentials").select("canteen_id", { count: "exact", head: true }).eq("login_id", c),
      ]);
      if (canteenError || ownerIdError) throw new Error("Could not check canteen code availability");
      if (!canteenCount && !ownerIdCount) {
        code = c;
        break;
      }
    }
    if (!code) throw new Error("Could not generate a unique code, try again");
    let ownerLoginId = "";
    let ownerLoginCode = "";
    for (let i = 0; i < 10; i++) {
      const pair = generateOwnerCredentialPair(code);
      const [{ count: ownerIdCount, error: ownerIdError }, { count: customerCodeCount, error: customerCodeError }] = await Promise.all([
        db.from("canteen_owner_credentials").select("canteen_id", { count: "exact", head: true }).eq("login_id", pair.loginId),
        db.from("canteens").select("id", { count: "exact", head: true }).eq("code", pair.loginId),
      ]);
      if (ownerIdError || customerCodeError) throw new Error("Could not check owner ID availability");
      if (!ownerIdCount && !customerCodeCount) { ownerLoginId = pair.loginId; ownerLoginCode = pair.loginCode; break; }
    }
    if (!ownerLoginId) throw new Error("Could not generate a unique owner ID, try again");
    const codeHash = await hashOwnerLoginCode(ownerLoginCode);
    // Claim the application first so two admins can't approve it twice.
    const { data: claimed } = await db
      .from("canteen_applications")
      .update({ status: "approved", reviewed_at: new Date().toISOString() })
      .eq("id", app.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!claimed) throw new Error("Application was already reviewed");
    const { data: canteen, error } = await db.from("canteens").insert({
      code,
      application_id: app.id,
      name: app.canteen_name,
      university_name: app.university_name,
      campus_location: app.campus_location,
      contact_email: app.contact_email,
    }).select("id").single();
    if (error || !canteen) {
      await db.from("canteen_applications").update({ status: "pending", reviewed_at: null }).eq("id", app.id);
      throw new Error("Could not create canteen");
    }
    const { error: credentialsError } = await db.from("canteen_owner_credentials").insert({
      canteen_id: canteen.id,
      login_id: ownerLoginId,
      code_salt: codeHash.salt,
      code_hash: codeHash.hash,
    });
    if (credentialsError) {
      await db.from("canteens").delete().eq("application_id", app.id);
      await db.from("canteen_applications").update({ status: "pending", reviewed_at: null }).eq("id", app.id);
      throw new Error("Could not securely prepare owner login credentials");
    }
    const { sendCanteenEmail } = await import("@/lib/canteen-email.server");
    const email = await sendCanteenEmail("approved", app.contact_email, {
      canteenName: app.canteen_name,
      university: app.university_name,
      code,
      ownerLoginId,
      ownerLoginCode,
      installUrl: canteenDashboardInstallUrl(),
    }, app.id);
    return { code, ownerLoginId, ownerLoginCode, emailSent: email.sent };
  });

export const issueCanteenOwnerCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ canteenId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { data: canteen, error } = await db.from("canteens")
      .select("id,application_id,code,name,university_name,contact_email,is_active")
      .eq("id", data.canteenId).maybeSingle();
    if (error || !canteen?.application_id || !canteen.is_active) throw new Error("Could not find an active approved canteen.");
    const { data: application, error: applicationError } = await db.from("canteen_applications")
      .select("status").eq("id", canteen.application_id).maybeSingle();
    if (applicationError || !canAccessOwnerCanteen(canteen.is_active, application?.status)) throw new Error("Only approved canteens can receive owner credentials.");
    let loginId = "";
    let loginCode = "";
    for (let attempt = 0; attempt < 10; attempt++) {
      const pair = generateOwnerCredentialPair(canteen.code);
      const [{ count: ownerIdCount, error: ownerIdError }, { count: customerCodeCount, error: customerCodeError }] = await Promise.all([
        db.from("canteen_owner_credentials").select("canteen_id", { count: "exact", head: true }).eq("login_id", pair.loginId),
        db.from("canteens").select("id", { count: "exact", head: true }).eq("code", pair.loginId),
      ]);
      if (ownerIdError || customerCodeError) throw new Error("Could not check owner ID availability");
      if (!ownerIdCount && !customerCodeCount) { loginId = pair.loginId; loginCode = pair.loginCode; break; }
    }
    if (!loginId) throw new Error("Could not generate a unique owner ID, try again");
    const hashed = await hashOwnerLoginCode(loginCode);
    const { error: saveError } = await db.from("canteen_owner_credentials").upsert({
      canteen_id: canteen.id,
      login_id: loginId,
      code_salt: hashed.salt,
      code_hash: hashed.hash,
    }, { onConflict: "canteen_id" });
    if (saveError) throw new Error("Could not save owner credentials. Please try again.");
    const { sendCanteenEmail } = await import("@/lib/canteen-email.server");
    const email = await sendCanteenEmail("approved", canteen.contact_email, {
      canteenName: canteen.name,
      university: canteen.university_name,
      code: canteen.code,
      ownerLoginId: loginId,
      ownerLoginCode: loginCode,
      installUrl: canteenDashboardInstallUrl(),
    }, canteen.application_id);
    return { ownerLoginId: loginId, ownerLoginCode: loginCode, emailSent: email.sent };
  });

export const rejectApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { data: app } = await db
      .from("canteen_applications")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();
    if (!app) throw new Error("Application not pending");
    const { sendCanteenEmail } = await import("@/lib/canteen-email.server");
    const email = await sendCanteenEmail("rejected", app.contact_email, { canteenName: app.canteen_name, university: app.university_name }, app.id);
    return { ok: true, emailSent: email.sent };
  });

export const setCanteenVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), visibility: z.enum(visibilities) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { error } = await db.from("canteens").update({ visibility: data.visibility }).eq("id", data.id);
    if (error) throw new Error("Could not update canteen");
    return { ok: true };
  });

const couponInput = z
  .object({
    code: couponCodeSchema,
    description: z.string().trim().max(200).default(""),
    discountType: z.enum(["percent", "flat"]),
    discountValue: z.number().int().min(1).max(100000),
    maxDiscount: z.number().int().min(1).max(100000).nullable(),
    minOrderValue: z.number().int().min(0).max(100000),
    startsAt: z.string().datetime().nullable(),
    expiresAt: z.string().datetime().nullable(),
    usageLimit: z.number().int().min(1).max(1000000).nullable(),
    perUserLimit: z.number().int().min(1).max(100),
    canteenId: z.string().uuid().nullable(),
    eligibleRoles: z.array(z.enum(["student", "faculty", "guest"])).max(3).nullable(),
    firstOrderOnly: z.boolean(),
  })
  .refine((v) => v.discountType !== "percent" || v.discountValue <= 100, { message: "Percent discounts must be 1–100", path: ["discountValue"] })
  .refine((v) => !v.startsAt || !v.expiresAt || new Date(v.expiresAt) > new Date(v.startsAt), { message: "Expiry must be after start", path: ["expiresAt"] });

export const createCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => couponInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { error } = await db.from("coupons").insert({
      code: data.code,
      description: data.description,
      discount_type: data.discountType,
      discount_value: data.discountValue,
      max_discount: data.maxDiscount,
      min_order_value: data.minOrderValue,
      starts_at: data.startsAt,
      expires_at: data.expiresAt,
      usage_limit: data.usageLimit,
      per_user_limit: data.perUserLimit,
      canteen_id: data.canteenId,
      eligible_roles: data.eligibleRoles && data.eligibleRoles.length ? data.eligibleRoles : null,
      first_order_only: data.firstOrderOnly,
    });
    if (error) throw new Error(error.code === "23505" ? "A coupon with this code already exists." : "Could not create coupon.");
    return { ok: true };
  });

export const setCouponActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { error } = await db.from("coupons").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error("Could not update coupon.");
    return { ok: true };
  });

export const approveRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { startRefund } = await import("@/lib/orders.server");
    return startRefund(data.id);
  });

export const rejectRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), note: z.string().trim().max(500).default("") }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { data: r } = await db
      .from("refunds")
      .update({ status: "rejected", admin_note: data.note || null })
      .eq("id", data.id)
      .eq("status", "requested")
      .select("*")
      .maybeSingle();
    if (!r) throw new Error("This refund isn't awaiting review.");
    const { data: o } = await db.from("orders").select("order_number, customer_name, user_id").eq("id", r.order_id).maybeSingle();
    const { data: p } = await db.from("profiles").select("email").eq("id", r.user_id).maybeSingle();
    if (o && p?.email) {
      const { sendEmail } = await import("@/lib/mailer.server");
      const { refundRejectedEmail } = await import("@/lib/email-templates");
      await sendEmail("refund_rejected", p.email, refundRejectedEmail({ customerName: o.customer_name, orderNumber: o.order_number, amount: r.amount, note: data.note }), r.id);
    }
    return { ok: true };
  });

/* ---------------- Customers ---------------- */
async function setCurrentCanteen(userId: string, canteenId: string) {
  const db = await admin();
  const { data: p, error } = await db.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (error || !p || !isCustomerRole(p.role)) throw new Error("Only student, faculty and guest accounts can join a canteen.");
  const { error: updateError } = await db.from("profiles").update({ current_canteen_id: canteenId }).eq("id", userId);
  if (updateError) throw new Error("Could not save your canteen. Please try again.");
}

async function getCustomerUserId(accessToken?: string) {
  const authorization = getRequest().headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
  const token = accessToken || bearerToken;
  if (!token) {
    throw new Error("This page is out of date. Refresh the page and try again.");
  }
  if (token.length < 20 || token.length > 8192) {
    throw new Error("Your session has expired. Please sign in again.");
  }
  const db = await admin();
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) throw new Error("Your session has expired. Please sign in again.");
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile || !isCustomerRole(profile.role)) {
    throw new Error("Only student, faculty and guest accounts can join a canteen.");
  }
  return user.id;
}

export const ensureWelcomeEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sendWelcomeOnce } = await import("@/lib/orders.server");
    return sendWelcomeOnce(context.userId);
  });

export const submitSupportRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    submissionId: z.string().uuid(),
    category: z.enum(["Rate Us", "Feedback", "Report an issue", "Order issue", "Payment issue", "Operational issue", "Other"]),
    description: z.string().trim().min(3).max(2000),
    orderId: z.string().trim().max(80).optional().default(""),
    rating: z.number().int().min(1).max(5).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const [{ data: profile }, { data: canteen }] = await Promise.all([
      db.from("profiles").select("full_name,email,role,current_canteen_id").eq("id", context.userId).maybeSingle(),
      db.from("canteens").select("id,name,contact_email").eq("owner_user_id", context.userId).maybeSingle(),
    ]);
    if (!profile && !canteen) throw new Error("Your HUNGRY Z account could not be verified. Please sign in again.");
    const isOwner = !!canteen;
    const senderName = canteen ? canteen.name : profile!.full_name;
    const senderEmail = canteen ? canteen.contact_email : profile!.email;
    const role = canteen ? "Canteen owner" : profile!.role;

    if (data.category === "Rate Us" && !data.rating) throw new Error("Choose a star rating before sending.");
    if (data.category !== "Rate Us" && data.rating !== undefined) throw new Error("A star rating is only accepted with Rate Us feedback.");
    let orderNumber = "";
    if (data.orderId) {
      const { data: order } = await db.from("orders").select("id,user_id,canteen_id,order_number").eq("order_number", data.orderId).maybeSingle();
      if (!order || (isOwner ? order.canteen_id !== canteen!.id : order.user_id !== context.userId)) {
        throw new Error("That Order ID could not be found for your account. Check it and try again.");
      }
      orderNumber = order.order_number;
    }

    const submittedAt = new Date().toISOString();
    const { data: existingRequest, error: lookupError } = await db.from("support_requests")
      .select("id,user_id")
      .eq("submission_id", data.submissionId)
      .maybeSingle();
    if (lookupError) throw new Error("Could not save your support request. Please try again.");
    if (existingRequest && existingRequest.user_id !== context.userId) throw new Error("This submission has already been used. Refresh the form and try again.");

    let supportRequestId = existingRequest?.id;
    if (supportRequestId) {
      const { error } = await db.from("support_requests").update({
        category: data.category,
        description: data.description,
        order_number: orderNumber,
        rating: data.rating ?? null,
        email_status: "pending",
      }).eq("id", supportRequestId);
      if (error) throw new Error("Could not update your saved support request. Please try again.");
    } else {
      const { data: savedRequest, error } = await db.from("support_requests").insert({
        submission_id: data.submissionId,
        user_id: context.userId,
        canteen_id: canteen?.id ?? profile?.current_canteen_id ?? null,
        sender_name: senderName,
        sender_email: senderEmail ?? "",
        sender_role: role,
        category: data.category,
        description: data.description,
        order_number: orderNumber,
        rating: data.rating ?? null,
      }).select("id").single();
      if (error || !savedRequest) throw new Error("Could not save your support request. Please try again.");
      supportRequestId = savedRequest.id;
    }

    const templates = await import("@/lib/email-templates");
    const { sendEmailOnce } = await import("@/lib/mailer.server");
    const support = await sendEmailOnce(
      "support_request",
      templates.ADMIN_ALERT_EMAIL,
      templates.supportRequestEmail({ senderName, senderEmail, role, canteen: canteen?.name ?? "", category: data.category, orderId: data.orderId, description: data.description, submittedAt, ...(data.rating === undefined ? {} : { rating: data.rating }) }),
      `support:${data.submissionId}`,
    );
    if (!support.sent) {
      await db.from("support_requests").update({ email_status: "failed" }).eq("id", supportRequestId);
      throw new Error("Your request was saved, but HUNGRY Z could not deliver it to support. Please try again or email hungryofficialx@gmail.com directly.");
    }
    const { error: savedStatusError } = await db.from("support_requests").update({ email_status: "sent", email_sent_at: submittedAt }).eq("id", supportRequestId);
    if (savedStatusError) console.error("[support] request email sent but status update failed", savedStatusError.message);

    const confirmation = senderEmail
      ? await sendEmailOnce("support_confirmation", senderEmail, templates.supportConfirmationEmail({ senderName, category: data.category, submittedAt, orderId: data.orderId }), `support:${data.submissionId}`)
      : { sent: false };
    return { sent: true, confirmationSent: confirmation.sent, duplicate: support.reason === "already_sent" };
  });

export const joinCanteenByCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ code: accessCodeSchema, accessToken: z.string().min(20).max(8192).optional() }).parse(input))
  .handler(async ({ data }) => {
    const userId = await getCustomerUserId(data.accessToken);
    const db = await admin();
    const { data: c } = await db
      .from("canteens")
      .select("id, name, university_name, visibility, is_active")
      .eq("code", data.code)
      .maybeSingle();
    if (!c || !c.is_active) throw new Error("This code isn't an approved HUNGRY Z canteen code.");
    if (c.visibility === "maintenance") throw new Error("This canteen is in maintenance mode right now. Try again later.");
    await setCurrentCanteen(userId, c.id);
    return { name: c.name, university: c.university_name, visibility: c.visibility };
  });

export const listPublicCanteens = createServerFn({ method: "GET" })
  .handler(async () => {
    const db = await admin();
    const { data } = await db
      .from("canteens")
      .select("id, name, university_name, campus_location")
      .eq("visibility", "public")
      .eq("is_active", true)
      .order("university_name");
    return data ?? [];
  });

export const joinPublicCanteen = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), accessToken: z.string().min(20).max(8192).optional() }).parse(input))
  .handler(async ({ data }) => {
    const userId = await getCustomerUserId(data.accessToken);
    const db = await admin();
    const { data: c } = await db.from("canteens").select("id, visibility, is_active").eq("id", data.id).maybeSingle();
    if (!c || !c.is_active || c.visibility !== "public") throw new Error("This canteen needs its code to join.");
    await setCurrentCanteen(userId, c.id);
    return { ok: true };
  });

export const getPaymentConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { razorpayKeys } = await import("@/lib/razorpay.server");
    const k = razorpayKeys();
    return { onlineEnabled: k.configured, testMode: k.testMode };
  });

const linesSchema = z.array(z.object({ id: z.string().uuid(), qty: z.number().int().min(1).max(20) })).min(1).max(30);

/** Prices the cart from the database and checks the coupon. Nothing is reserved. */
async function priceCart(userId: string, rawLines: { id: string; qty: number }[], couponCode?: string | null) {
  const db = await admin();
  const { data: p } = await db.from("profiles").select("full_name, role, current_canteen_id").eq("id", userId).maybeSingle();
  if (!p?.current_canteen_id) throw new Error("Join a canteen first.");
  const { data: c } = await db.from("canteens").select("*").eq("id", p.current_canteen_id).maybeSingle();
  if (!canAcceptOrders(c)) throw new Error("This canteen isn't accepting orders right now.");
  const lines = mergeLines(rawLines);
  if (lines.some((l) => l.qty > 20)) throw new Error("Each item can be ordered 1–20 times.");
  const { data: items } = await db
    .from("menu_items")
    .select("id, price, available, stock")
    .eq("canteen_id", c!.id)
    .in("id", lines.map((l) => l.id));
  const byId = new Map((items ?? []).map((i) => [i.id, i]));
  let subtotal = 0;
  for (const l of lines) {
    const it = byId.get(l.id);
    if (!it || !it.available) throw new Error("Some items are no longer available. Please review your cart.");
    if (it.stock != null && it.stock < l.qty) throw new Error("Some items just sold out. Please review your cart.");
    subtotal += it.price * l.qty;
  }
  let coupon: { id: string; code: string; description: string } | null = null;
  let discount = 0;
  let couponError: string | null = null;
  if (couponCode) {
    const { evaluateCouponFor } = await import("@/lib/coupons.server");
    const r = await evaluateCouponFor({ code: couponCode, userId, canteenId: c!.id, role: p.role, subtotal });
    if (r.result.ok && r.coupon) {
      coupon = { id: r.coupon.id, code: r.coupon.code, description: r.coupon.description };
      discount = r.result.discount;
    } else if (!r.result.ok) couponError = r.result.message;
  }
  return { profile: p, canteenId: c!.id, lines, subtotal, discount, total: subtotal - discount, coupon, couponError };
}

export const quoteOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ lines: linesSchema, couponCode: couponCodeSchema.nullable().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const q = await priceCart(context.userId, data.lines, data.couponCode);
    return {
      subtotal: q.subtotal,
      discount: q.discount,
      total: q.total,
      coupon: q.coupon ? { code: q.coupon.code, description: q.coupon.description } : null,
      couponError: q.couponError,
    };
  });

function pickupCode() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(1000 + (a[0]! % 9000));
}

export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        lines: linesSchema,
        orderType: z.enum(ORDER_TYPES),
        paymentMethod: z.enum(PAYMENT_METHODS),
        couponCode: couponCodeSchema.nullable().optional(),
        idempotencyKey: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
        eventId: z.string().uuid().optional(),
        eventCode: z.string().regex(/^[0-9]{7}$/).optional(),
      })
      .refine((v) => Boolean(v.eventId) === Boolean(v.eventCode), { message: "Enter the event code to get a token." })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!isPaymentAllowed(data.orderType, data.paymentMethod)) throw new Error("Parcel orders are paid at the counter.");
    const db = await admin();
    const { razorpayKeys } = await import("@/lib/razorpay.server");
    if (data.eventId && data.paymentMethod !== "counter") throw new Error("Event tokens require Pay at Counter.");
    if (data.paymentMethod === "razorpay" && !razorpayKeys().configured)
      throw new Error("Online payment isn't available yet. Please choose Pay at counter.");
    await db.rpc("hungry_expire_stale_orders", { p_minutes: 30 });

    // Same checkout submitted twice: return the original order instead of creating a new one.
    const { data: existing } = await db.from("orders").select("id").eq("user_id", context.userId).eq("idempotency_key", data.idempotencyKey).maybeSingle();
    let orderId = data.eventId ? null : (existing?.id ?? null);
    let created = false;
    let eventToken: string | null = null;

    if (!orderId) {
      const q = await priceCart(context.userId, data.lines, data.couponCode);
      if (data.couponCode && !q.coupon) throw new Error(q.couponError ?? "This coupon can't be used.");
      for (let attempt = 0; attempt < 3 && !orderId; attempt++) {
        const orderArgs = {
          p_user: context.userId,
          p_canteen: q.canteenId,
          p_customer_name: q.profile.full_name,
          p_lines: q.lines,
          p_order_type: data.orderType,
          p_payment_method: data.paymentMethod,
          p_expected_subtotal: q.subtotal,
          p_coupon_id: (q.coupon?.id ?? null) as string, // NULL = no coupon
          p_discount: q.discount,
          p_idempotency_key: data.idempotencyKey,
          p_order_number: "HG-" + generateCanteenCode().slice(0, 6),
          p_pickup_code: pickupCode(),
        };
        const { data: rows, error } = data.eventId
          ? await db.rpc("hungry_place_event_order", { ...orderArgs, p_event_id: data.eventId, p_event_code: data.eventCode! })
          : await db.rpc("hungry_place_order", orderArgs);
        if (error) {
          if (error.message.includes("EVENT:full")) throw new Error("EVENT FULL");
          if (error.message.includes("EVENT:invalid_or_closed")) throw new Error("This event is not available. Check its Event Code.");
          if (error.message.includes("EVENT:not_participant")) throw new Error("Join the participating canteen to get this event token.");
          if (error.message.includes("EVENT:counter_payment_required")) throw new Error("Event tokens require Pay at Counter.");
          if (error.message.includes("orders_order_number_key")) continue; // rare number clash — retry
          throw new Error(friendlyOrderError(error.message) ?? "Could not place order. Please try again.");
        }
        const row = (rows as { order_id: string; already_existed: boolean; token_number?: string }[] | null)?.[0];
        if (!row) throw new Error("Could not place order. Please try again.");
        orderId = row.order_id;
        created = !row.already_existed;
        eventToken = row.token_number ?? null;
      }
      if (!orderId) throw new Error("Could not place order. Please try again.");
    }

    const orders = await import("@/lib/orders.server");
    const order = await orders.getOrder(orderId);
    if (!order) throw new Error("Could not load your order.");

    if (order.payment_method === "razorpay" && order.status === "pending_payment") {
      try {
        const payment = await orders.checkoutParams(order);
        const email = await orders.sendPaymentPendingNotice(order.id);
        return { orderId: order.id, payment, emailSent: email.sent, eventToken };
      } catch (e) {
        console.error("[placeOrder] could not create Razorpay order", e instanceof Error ? e.message : e);
        if (created) await db.rpc("hungry_release_order", { p_order: order.id, p_payment_status: "failed" });
        throw new Error("We couldn't start the payment and nothing was charged. Please try again or choose Pay at counter.");
      }
    }
    const email = await orders.sendOrderConfirmation(order.id);
    return { orderId: order.id, payment: null, emailSent: email.sent && email.ownerSent !== false, eventToken };
  });

async function ownOrder(userId: string, orderId: string) {
  const { getOrder } = await import("@/lib/orders.server");
  const o = await getOrder(orderId);
  if (!o || o.user_id !== userId) throw new Error("Order not found");
  return o;
}

/** Fetch a fresh order for a QR deep link, but never reveal another customer's order. */
export const getOwnOrderDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: order } = await db
      .from("orders")
      .select("id,user_id,order_number,pickup_code,customer_name,lines,subtotal,discount,total,coupon_code,payment,payment_method,payment_status,order_type,created_at,prep_minutes,counter,status,canteen_id")
      .eq("id", data.orderId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!order) throw new Error("Order not found or unavailable.");
    const { data: canteen } = await db.from("canteens").select("name").eq("id", order.canteen_id).maybeSingle();
    return { order: { ...order, canteen_name: canteen?.name ?? "Canteen" } };
  });

export const resumePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const o = await ownOrder(context.userId, data.orderId);
    if (o.status !== "pending_payment") throw new Error("This order doesn't need payment.");
    const { checkoutParams } = await import("@/lib/orders.server");
    return checkoutParams(o);
  });

const rzpId = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[A-Za-z0-9]{6,40}$`));

export const verifyRazorpayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ razorpayOrderId: rzpId("order"), razorpayPaymentId: rzpId("pay"), signature: z.string().regex(/^[a-f0-9]{64}$/i) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: o } = await db.from("orders").select("id, user_id").eq("razorpay_order_id", data.razorpayOrderId).maybeSingle();
    if (!o || o.user_id !== context.userId) throw new Error("Order not found");
    const { verifyCheckoutSignature } = await import("@/lib/razorpay-signature");
    const valid = await verifyCheckoutSignature({
      orderId: data.razorpayOrderId,
      paymentId: data.razorpayPaymentId,
      signature: data.signature,
      secret: (process.env["RAZORPAY_KEY_SECRET"] ?? "").trim(),
    });
    if (!valid) throw new Error("We couldn't verify this payment. If money was debited, it will be confirmed automatically or refunded.");
    const { confirmOnlinePayment } = await import("@/lib/orders.server");
    return confirmOnlinePayment({ razorpayOrderId: data.razorpayOrderId, razorpayPaymentId: data.razorpayPaymentId, signatureVerified: true });
  });

export const reportPaymentFailure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ razorpayOrderId: rzpId("order"), razorpayPaymentId: rzpId("pay") }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: o } = await db.from("orders").select("id, user_id").eq("razorpay_order_id", data.razorpayOrderId).maybeSingle();
    if (!o || o.user_id !== context.userId) throw new Error("Order not found");
    const { recordFailedPayment } = await import("@/lib/orders.server");
    // Razorpay is asked directly; the browser's failure report is only a hint.
    const r = await recordFailedPayment(data);
    const notificationsSent = "notificationsSent" in r ? r.notificationsSent : "emailSent" in r ? r.emailSent : undefined;
    return { state: r.state, notificationsSent };
  });

export const cancelPendingOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const o = await ownOrder(context.userId, data.orderId);
    if (o.status !== "pending_payment") throw new Error("Only unpaid online orders can be cancelled here.");
    const db = await admin();
    const { count } = await db.from("payments").select("id", { count: "exact", head: true }).eq("order_id", o.id).eq("status", "captured");
    if (count) throw new Error("This order was already paid.");
    await db.rpc("hungry_release_order", { p_order: o.id });
    const { sendOrderStatusUpdate } = await import("@/lib/orders.server");
    const notifications = await sendOrderStatusUpdate(o.id, "cancelled");
    return { ok: true, notificationsSent: notifications.sent };
  });

export const requestRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orderId: z.string().uuid(), reason: z.string().trim().min(3, "Tell us why").max(500) }).parse(input))
  .handler(async ({ data, context }) => {
    const o = await ownOrder(context.userId, data.orderId);
    if (!canRequestRefund(o)) throw new Error("Refunds can be requested for online-paid orders that haven't been collected.");
    const { createRefundRequest } = await import("@/lib/orders.server");
    const refund = await createRefundRequest({ order: o, amount: o.total, reason: data.reason, requestedBy: "customer" });
    return { ok: true, emailSent: refund.customerEmailSent };
  });

/* ---------------- Canteen owners ---------------- */
export const ownerUpdateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      orderId: z.string().uuid(),
      status: z.enum(["preparing", "ready", "collected", "cancelled"]),
      counterPaymentConfirmed: z.boolean().optional().default(false),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const orders = await import("@/lib/orders.server");
    const o = await orders.getOrder(data.orderId);
    if (!o) throw new Error("Order not found");
    const { data: c } = await db.from("canteens").select("owner_user_id").eq("id", o.canteen_id).maybeSingle();
    if (!c || c.owner_user_id !== context.userId) throw new Error("Forbidden");
    if (o.completion_workflow === "printed" && data.status !== "cancelled") throw new Error("This order uses customer-confirmed printed collection; it cannot enter the manual preparation workflow.");
    if (!canOwnerMove(o.status, data.status)) throw new Error("That status change isn't allowed.");

    if (data.status === "cancelled") {
      if (o.payment_method === "razorpay" && o.payment_status === "paid") {
        const r = await orders.createRefundRequest({ order: o, amount: o.total, reason: "Cancelled by the canteen", requestedBy: "canteen" });
        await orders.startRefund(r.id);
        const notifications = await orders.sendOrderStatusUpdate(o.id, "cancelled");
        return { ok: true, refund: true, notificationsSent: notifications.sent };
      }
      await db.rpc("hungry_release_order", { p_order: o.id });
      const notifications = await orders.sendOrderStatusUpdate(o.id, "cancelled");
      return { ok: true, refund: false, notificationsSent: notifications.sent };
    }
    const patch: { status: string; completion_workflow?: string | null; payment_status?: string; paid_at?: string } = {
      status: data.status,
      completion_workflow: data.status === "cancelled" ? o.completion_workflow : "manual",
    };
    if (data.status === "collected" && o.payment_method === "counter" && data.counterPaymentConfirmed) {
      patch.payment_status = "paid";
      patch.paid_at = new Date().toISOString();
    }
    const { data: updated } = await db.from("orders").update(patch).eq("id", o.id).eq("status", o.status).select("id").maybeSingle();
    if (!updated) throw new Error("This order was just updated. Refresh and try again.");
    const notifications = await orders.sendOrderStatusUpdate(o.id, data.status);
    return { ok: true, refund: false, notificationsSent: notifications.sent };
  });

export const ownerRecordConfirmedBillPrint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orderId: z.string().uuid(), paperWidth: z.enum(["auto", "58", "80"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: result, error } = await db.rpc("hungry_confirm_order_bill_print", {
      p_order_id: data.orderId,
      p_owner_user_id: context.userId,
      p_paper_width: data.paperWidth,
    });
    if (error) {
      if (error.message.includes("PRINT:not_canteen_owner")) throw new Error("You cannot confirm a print for this order.");
      if (error.message.includes("PRINT:cancelled_order")) throw new Error("Cancelled orders cannot be printed as customer bills.");
      throw new Error("The print confirmation could not be saved.");
    }
    const confirmation = Array.isArray(result) ? result[0] : result;
    if (!confirmation) throw new Error("The print confirmation could not be saved.");
    return { ok: true, alreadyConfirmed: confirmation.already_confirmed as boolean, confirmedAt: confirmation.confirmed_at as string };
  });

export const acknowledgeBillPrintThankYou = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: acknowledged, error } = await db.rpc("hungry_acknowledge_bill_print_thank_you", {
      p_order_id: data.orderId,
      p_customer_user_id: context.userId,
    });
    if (error) {
      if (error.message.includes("PRINT:not_order_customer")) throw new Error("You cannot dismiss another customer's message.");
      throw new Error("Could not save the thank-you popup status.");
    }
    return { acknowledged: Boolean(acknowledged) };
  });

export const acknowledgeCollectedOrderThankYou = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: acknowledged, error } = await db.rpc("hungry_acknowledge_collected_order_thank_you", {
      p_order_id: data.orderId,
      p_customer_user_id: context.userId,
    });
    if (error) throw new Error("Could not save the thank-you popup status.");
    return { acknowledged: acknowledged === true };
  });

export const confirmOwnPrintedOrderFoodReceived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: result, error } = await db.rpc("hungry_confirm_printed_order_food_received", {
      p_order_id: data.orderId,
      p_customer_user_id: context.userId,
    });
    if (error) {
      if (error.message.includes("RECEIPT:not_order_customer")) throw new Error("You can only confirm receipt for your own order.");
      if (error.message.includes("RECEIPT:bill_not_printed")) throw new Error("This order has no confirmed printed bill.");
      if (error.message.includes("RECEIPT:order_cancelled")) throw new Error("A cancelled order cannot be confirmed as received.");
      throw new Error("Could not save your food-received confirmation. Please try again.");
    }
    const confirmation = Array.isArray(result) ? result[0] : result;
    if (!confirmation) throw new Error("Could not save your food-received confirmation. Please try again.");
    return { confirmedAt: confirmation.confirmed_at as string, alreadyConfirmed: confirmation.already_confirmed as boolean };
  });
