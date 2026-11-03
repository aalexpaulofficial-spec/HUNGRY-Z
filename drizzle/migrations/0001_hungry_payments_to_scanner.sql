CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamptz;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS stock integer CHECK (stock IS NULL OR (stock >= 0 AND stock <= 100000));

CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9_-]{3,20}$'),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 200),
  discount_type text NOT NULL CHECK (discount_type IN ('percent','flat')),
  discount_value integer NOT NULL CHECK (discount_value > 0),
  max_discount integer CHECK (max_discount IS NULL OR max_discount > 0),
  min_order_value integer NOT NULL DEFAULT 0 CHECK (min_order_value >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  usage_limit integer CHECK (usage_limit IS NULL OR usage_limit > 0),
  per_user_limit integer NOT NULL DEFAULT 1 CHECK (per_user_limit > 0),
  canteen_id uuid REFERENCES public.canteens(id) ON DELETE CASCADE,
  eligible_roles text[] CHECK (eligible_roles IS NULL OR eligible_roles <@ ARRAY['student','faculty','guest']::text[]),
  first_order_only boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (discount_type <> 'percent' OR discount_value <= 100),
  CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at > starts_at)
);
GRANT SELECT ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read coupons" ON public.coupons FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'dine_in' CHECK (order_type IN ('dine_in','parcel')),
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'counter' CHECK (payment_method IN ('counter','razorpay')),
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','pending','paid','failed','refund_pending','refunded')),
  ADD COLUMN IF NOT EXISTS subtotal integer NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  ADD COLUMN IF NOT EXISTS discount integer NOT NULL DEFAULT 0 CHECK (discount >= 0),
  ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS idempotency_key text CHECK (idempotency_key IS NULL OR char_length(idempotency_key) BETWEEN 8 AND 64),
  ADD COLUMN IF NOT EXISTS razorpay_order_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmation_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.orders SET subtotal = total WHERE subtotal = 0 AND total > 0;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status IN ('pending_payment','placed','preparing','ready','collected','cancelled'));
ALTER TABLE public.orders ADD CONSTRAINT orders_parcel_counter_only CHECK (order_type <> 'parcel' OR payment_method = 'counter');
ALTER TABLE public.orders ADD CONSTRAINT orders_total_math CHECK (total = subtotal - discount AND total >= 0);
CREATE UNIQUE INDEX orders_user_idempotency ON public.orders (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX orders_pending_payment ON public.orders (created_at) WHERE status = 'pending_payment';
CREATE TRIGGER orders_touch BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP POLICY IF EXISTS "Owners update order status" ON public.orders;
REVOKE UPDATE ON public.orders FROM authenticated;
DROP TRIGGER IF EXISTS orders_guard ON public.orders;
DROP FUNCTION IF EXISTS public.orders_guard_update();
DROP POLICY IF EXISTS "Owners read canteen orders" ON public.orders;
CREATE POLICY "Owners read canteen orders" ON public.orders FOR SELECT TO authenticated USING (public.owns_canteen(canteen_id) AND status <> 'pending_payment');
CREATE POLICY "Admins read orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  discount integer NOT NULL CHECK (discount >= 0),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','used','released')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coupon_redemptions_coupon ON public.coupon_redemptions (coupon_id, status);
CREATE INDEX coupon_redemptions_user ON public.coupon_redemptions (coupon_id, user_id);
GRANT SELECT ON public.coupon_redemptions TO authenticated;
GRANT ALL ON public.coupon_redemptions TO service_role;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own redemptions" ON public.coupon_redemptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read redemptions" ON public.coupon_redemptions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER coupon_redemptions_touch BEFORE UPDATE ON public.coupon_redemptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'razorpay' CHECK (provider = 'razorpay'),
  razorpay_order_id text NOT NULL,
  razorpay_payment_id text NOT NULL UNIQUE,
  amount_paise integer NOT NULL CHECK (amount_paise >= 0),
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL CHECK (status IN ('created','authorized','captured','failed','refunded','partially_refunded')),
  method text,
  error_code text,
  error_description text,
  signature_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_order ON public.payments (order_id);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own payments" ON public.payments FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read payments" ON public.payments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER payments_touch BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.payment_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  razorpay_order_id text,
  razorpay_payment_id text,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  error text,
  received_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_events TO authenticated;
GRANT ALL ON public.payment_events TO service_role;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read payment events" ON public.payment_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 500),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','processing','processed','rejected','failed')),
  requested_by text NOT NULL DEFAULT 'customer' CHECK (requested_by IN ('customer','canteen','admin','system')),
  razorpay_refund_id text UNIQUE,
  admin_note text CHECK (admin_note IS NULL OR char_length(admin_note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX refunds_one_active_per_order ON public.refunds (order_id) WHERE status IN ('requested','processing','processed');
GRANT SELECT ON public.refunds TO authenticated;
GRANT ALL ON public.refunds TO service_role;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own refunds" ON public.refunds FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owners read canteen refunds" ON public.refunds FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND public.owns_canteen(o.canteen_id)));
CREATE POLICY "Admins read refunds" ON public.refunds FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER refunds_touch BEFORE UPDATE ON public.refunds FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  recipient text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent','failed','skipped')),
  error text,
  attempts integer NOT NULL DEFAULT 1,
  ref_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_logs_created ON public.email_logs (created_at DESC);
GRANT SELECT ON public.email_logs TO authenticated;
GRANT ALL ON public.email_logs TO service_role;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read email logs" ON public.email_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.hungry_place_order(
  p_user uuid, p_canteen uuid, p_customer_name text, p_lines jsonb, p_order_type text, p_payment_method text,
  p_expected_subtotal integer, p_coupon_id uuid, p_discount integer, p_idempotency_key text, p_order_number text, p_pickup_code text
) RETURNS TABLE (order_id uuid, already_existed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing uuid; v_line jsonb; v_qty integer; v_item public.menu_items%ROWTYPE; v_lines jsonb := '[]'::jsonb;
  v_subtotal integer := 0; v_prep integer := 0; v_counter text; v_coupon public.coupons%ROWTYPE;
  v_total_uses integer; v_user_uses integer; v_order uuid;
BEGIN
  IF p_order_type NOT IN ('dine_in','parcel') THEN RAISE EXCEPTION 'HUNGRY:invalid_order_type'; END IF;
  IF p_payment_method NOT IN ('counter','razorpay') THEN RAISE EXCEPTION 'HUNGRY:invalid_payment_method'; END IF;
  IF p_order_type = 'parcel' AND p_payment_method <> 'counter' THEN RAISE EXCEPTION 'HUNGRY:parcel_counter_only'; END IF;
  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 OR jsonb_array_length(p_lines) > 30 THEN
    RAISE EXCEPTION 'HUNGRY:invalid_cart';
  END IF;
  SELECT o.id INTO v_existing FROM public.orders o WHERE o.user_id = p_user AND o.idempotency_key = p_idempotency_key;
  IF FOUND THEN RETURN QUERY SELECT v_existing, true; RETURN; END IF;
  PERFORM 1 FROM public.canteens c WHERE c.id = p_canteen AND c.is_active AND c.visibility IN ('public','private');
  IF NOT FOUND THEN RAISE EXCEPTION 'HUNGRY:canteen_closed'; END IF;
  BEGIN
    FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) ORDER BY value->>'id' LOOP
      v_qty := (v_line->>'qty')::integer;
      IF v_qty IS NULL OR v_qty < 1 OR v_qty > 20 THEN RAISE EXCEPTION 'HUNGRY:invalid_quantity'; END IF;
      SELECT * INTO v_item FROM public.menu_items m WHERE m.id = (v_line->>'id')::uuid AND m.canteen_id = p_canteen FOR UPDATE;
      IF NOT FOUND OR NOT v_item.available THEN RAISE EXCEPTION 'HUNGRY:item_unavailable'; END IF;
      IF v_item.stock IS NOT NULL THEN
        IF v_item.stock < v_qty THEN RAISE EXCEPTION 'HUNGRY:out_of_stock'; END IF;
        UPDATE public.menu_items SET stock = stock - v_qty WHERE id = v_item.id;
      END IF;
      v_lines := v_lines || jsonb_build_object('id', v_item.id, 'name', v_item.name, 'price', v_item.price, 'qty', v_qty);
      v_subtotal := v_subtotal + v_item.price * v_qty;
      v_prep := greatest(v_prep, v_item.prep_minutes);
      v_counter := coalesce(v_counter, v_item.counter);
    END LOOP;
    IF p_expected_subtotal IS DISTINCT FROM v_subtotal THEN RAISE EXCEPTION 'HUNGRY:prices_changed'; END IF;
    IF p_coupon_id IS NOT NULL THEN
      SELECT * INTO v_coupon FROM public.coupons cp WHERE cp.id = p_coupon_id FOR UPDATE;
      IF NOT FOUND OR NOT v_coupon.active
         OR (v_coupon.starts_at IS NOT NULL AND v_coupon.starts_at > now())
         OR (v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at <= now())
         OR (v_coupon.canteen_id IS NOT NULL AND v_coupon.canteen_id <> p_canteen) THEN
        RAISE EXCEPTION 'HUNGRY:coupon_invalid';
      END IF;
      IF v_subtotal < v_coupon.min_order_value THEN RAISE EXCEPTION 'HUNGRY:coupon_min_order'; END IF;
      SELECT count(*), count(*) FILTER (WHERE r.user_id = p_user) INTO v_total_uses, v_user_uses
        FROM public.coupon_redemptions r WHERE r.coupon_id = p_coupon_id AND r.status IN ('reserved','used');
      IF v_coupon.usage_limit IS NOT NULL AND v_total_uses >= v_coupon.usage_limit THEN RAISE EXCEPTION 'HUNGRY:coupon_exhausted'; END IF;
      IF v_user_uses >= v_coupon.per_user_limit THEN RAISE EXCEPTION 'HUNGRY:coupon_already_used'; END IF;
      IF p_discount IS NULL OR p_discount < 0 OR p_discount > v_subtotal THEN RAISE EXCEPTION 'HUNGRY:coupon_invalid'; END IF;
    ELSIF coalesce(p_discount, 0) <> 0 THEN
      RAISE EXCEPTION 'HUNGRY:coupon_invalid';
    END IF;
    INSERT INTO public.orders (
      order_number, canteen_id, user_id, customer_name, lines, subtotal, discount, total,
      payment, payment_method, payment_status, order_type, pickup_code, counter, prep_minutes,
      status, coupon_id, coupon_code, idempotency_key
    ) VALUES (
      p_order_number, p_canteen, p_user, p_customer_name, v_lines, v_subtotal, coalesce(p_discount, 0),
      v_subtotal - coalesce(p_discount, 0),
      CASE WHEN p_payment_method = 'razorpay' THEN 'Paid online (Razorpay)' ELSE 'Pay at counter' END,
      p_payment_method,
      CASE WHEN p_payment_method = 'razorpay' THEN 'pending' ELSE 'unpaid' END,
      p_order_type, p_pickup_code, coalesce(v_counter, 'Counter 1'), greatest(v_prep, 1),
      CASE WHEN p_payment_method = 'razorpay' THEN 'pending_payment' ELSE 'placed' END,
      p_coupon_id, CASE WHEN p_coupon_id IS NULL THEN NULL ELSE v_coupon.code END, p_idempotency_key
    ) RETURNING id INTO v_order;
    IF p_coupon_id IS NOT NULL THEN
      INSERT INTO public.coupon_redemptions (coupon_id, user_id, order_id, discount, status)
      VALUES (p_coupon_id, p_user, v_order, p_discount, CASE WHEN p_payment_method = 'razorpay' THEN 'reserved' ELSE 'used' END);
    END IF;
  EXCEPTION WHEN unique_violation THEN
    SELECT o.id INTO v_existing FROM public.orders o WHERE o.user_id = p_user AND o.idempotency_key = p_idempotency_key;
    IF FOUND THEN RETURN QUERY SELECT v_existing, true; RETURN; END IF;
    RAISE;
  END;
  RETURN QUERY SELECT v_order, false;
END $$;

CREATE OR REPLACE FUNCTION public.hungry_mark_order_paid(p_order uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_status text; v_pay text;
BEGIN
  UPDATE public.orders SET payment_status = 'paid', status = 'placed', paid_at = now()
   WHERE id = p_order AND status = 'pending_payment' AND payment_status IN ('pending','failed')
  RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    UPDATE public.coupon_redemptions SET status = 'used' WHERE order_id = p_order AND status = 'reserved';
    RETURN 'paid';
  END IF;
  SELECT status, payment_status INTO v_status, v_pay FROM public.orders WHERE id = p_order;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF v_pay IN ('paid','refund_pending','refunded') THEN RETURN 'already_paid'; END IF;
  IF v_status = 'cancelled' THEN RETURN 'order_cancelled'; END IF;
  RETURN 'not_found';
END $$;

CREATE OR REPLACE FUNCTION public.hungry_release_order(p_order uuid, p_payment_status text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order public.orders%ROWTYPE; v_line jsonb;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND OR v_order.status IN ('cancelled','collected') THEN RETURN false; END IF;
  FOR v_line IN SELECT value FROM jsonb_array_elements(v_order.lines) LOOP
    UPDATE public.menu_items SET stock = stock + (v_line->>'qty')::integer WHERE id = (v_line->>'id')::uuid AND stock IS NOT NULL;
  END LOOP;
  UPDATE public.coupon_redemptions SET status = 'released' WHERE order_id = p_order AND status IN ('reserved','used');
  UPDATE public.orders SET status = 'cancelled', payment_status = coalesce(p_payment_status, payment_status) WHERE id = p_order;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.hungry_expire_stale_orders(p_minutes integer DEFAULT 30)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN SELECT o.id FROM public.orders o
            WHERE o.status = 'pending_payment' AND o.created_at < now() - make_interval(mins => p_minutes)
            FOR UPDATE SKIP LOCKED LOOP
    IF public.hungry_release_order(r.id, NULL) THEN n := n + 1; END IF;
  END LOOP;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.hungry_place_order(uuid, uuid, text, jsonb, text, text, integer, uuid, integer, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hungry_mark_order_paid(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hungry_release_order(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hungry_expire_stale_orders(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hungry_place_order(uuid, uuid, text, jsonb, text, text, integer, uuid, integer, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hungry_mark_order_paid(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.hungry_release_order(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hungry_expire_stale_orders(integer) TO service_role;
ALTER PUBLICATION supabase_realtime ADD TABLE public.refunds;

CREATE TABLE public.canteen_owner_credentials (
  canteen_id uuid PRIMARY KEY REFERENCES public.canteens(id) ON DELETE CASCADE,
  login_id text NOT NULL UNIQUE CHECK (login_id ~ '^[A-Z2-9]{7}$' OR login_id ~ '^HC-[A-Z2-9]{8}$'),
  code_salt text NOT NULL CHECK (code_salt ~ '^[a-f0-9]{32}$'),
  code_hash text NOT NULL CHECK (code_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.canteen_owner_credentials TO service_role;
ALTER TABLE public.canteen_owner_credentials ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.canteen_owner_login_limits (
  key_hash text PRIMARY KEY CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  blocked_until timestamptz
);
GRANT ALL ON public.canteen_owner_login_limits TO service_role;
ALTER TABLE public.canteen_owner_login_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.hungry_allow_canteen_owner_login(p_ip_key text, p_owner_key text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_key text; v_started timestamptz; v_attempts integer; v_blocked timestamptz; v_allowed boolean := true;
BEGIN
  IF p_ip_key !~ '^[a-f0-9]{64}$' OR p_owner_key !~ '^[a-f0-9]{64}$' THEN RETURN false; END IF;
  FOR v_key IN SELECT DISTINCT unnest(ARRAY[p_ip_key, p_owner_key]) AS key_hash ORDER BY key_hash LOOP
    INSERT INTO public.canteen_owner_login_limits (key_hash) VALUES (v_key) ON CONFLICT DO NOTHING;
    SELECT window_started_at, attempts, blocked_until INTO v_started, v_attempts, v_blocked
      FROM public.canteen_owner_login_limits WHERE key_hash = v_key FOR UPDATE;
    IF v_blocked > now() THEN
      v_allowed := false;
    ELSIF v_started < now() - interval '15 minutes' THEN
      UPDATE public.canteen_owner_login_limits SET window_started_at = now(), attempts = 1, blocked_until = NULL WHERE key_hash = v_key;
    ELSIF v_attempts >= 5 THEN
      UPDATE public.canteen_owner_login_limits SET blocked_until = now() + interval '15 minutes' WHERE key_hash = v_key;
      v_allowed := false;
    ELSE
      UPDATE public.canteen_owner_login_limits SET attempts = attempts + 1 WHERE key_hash = v_key;
    END IF;
  END LOOP;
  RETURN v_allowed;
END $$;
REVOKE ALL ON FUNCTION public.hungry_allow_canteen_owner_login(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hungry_allow_canteen_owner_login(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.hungry_owner_credentials_require_approved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text;
BEGIN
  SELECT application.status INTO v_status
    FROM public.canteens AS canteen
    JOIN public.canteen_applications AS application ON application.id = canteen.application_id
   WHERE canteen.id = NEW.canteen_id AND canteen.is_active;
  IF v_status IS DISTINCT FROM 'approved' THEN RAISE EXCEPTION 'Owner credentials require an active, approved canteen'; END IF;
  IF EXISTS (SELECT 1 FROM public.canteens WHERE code = NEW.login_id) THEN
    RAISE EXCEPTION 'Canteen Owner ID must be distinct from every customer canteen code';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.hungry_owner_credentials_require_approved() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER canteen_owner_credentials_approved_guard BEFORE INSERT OR UPDATE ON public.canteen_owner_credentials
  FOR EACH ROW EXECUTE FUNCTION public.hungry_owner_credentials_require_approved();

CREATE OR REPLACE FUNCTION public.hungry_canteen_code_not_owner_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.canteen_owner_credentials WHERE login_id = NEW.code) THEN
    RAISE EXCEPTION 'Customer canteen code must be distinct from every Canteen Owner ID';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.hungry_canteen_code_not_owner_id() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER canteen_code_owner_id_guard BEFORE INSERT OR UPDATE OF code ON public.canteens
  FOR EACH ROW EXECUTE FUNCTION public.hungry_canteen_code_not_owner_id();

CREATE POLICY "Public read canteen menu images" ON storage.objects FOR SELECT TO public USING (bucket_id = 'canteen-menu-images');
CREATE POLICY "Canteen owners upload menu images" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'canteen-menu-images' AND EXISTS (SELECT 1 FROM public.canteens c WHERE c.id::text = (storage.foldername(storage.objects.name))[1] AND public.owns_canteen(c.id)));
CREATE POLICY "Canteen owners delete menu images" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'canteen-menu-images' AND EXISTS (SELECT 1 FROM public.canteens c WHERE c.id::text = (storage.foldername(storage.objects.name))[1] AND public.owns_canteen(c.id)));

CREATE TABLE public.canteen_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canteen_id uuid NOT NULL UNIQUE REFERENCES public.canteens(id) ON DELETE CASCADE,
  banner_image_url text,
  heading text NOT NULL DEFAULT '' CHECK (char_length(heading) <= 120),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  updated_at timestamptz NOT NULL DEFAULT now(),
  banner_crop_x double precision NOT NULL DEFAULT 50 CHECK (banner_crop_x BETWEEN 0 AND 100),
  banner_crop_y double precision NOT NULL DEFAULT 50 CHECK (banner_crop_y BETWEEN 0 AND 100),
  banner_crop_zoom double precision NOT NULL DEFAULT 1 CHECK (banner_crop_zoom BETWEEN 1 AND 3)
);
GRANT SELECT, INSERT, UPDATE ON public.canteen_templates TO authenticated;
GRANT ALL ON public.canteen_templates TO service_role;
ALTER TABLE public.canteen_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Canteen members read their template" ON public.canteen_templates FOR SELECT TO authenticated USING (canteen_id = public.current_canteen() OR public.owns_canteen(canteen_id));
CREATE POLICY "Canteen owners create their template" ON public.canteen_templates FOR INSERT TO authenticated WITH CHECK (public.owns_canteen(canteen_id));
CREATE POLICY "Canteen owners update their template" ON public.canteen_templates FOR UPDATE TO authenticated USING (public.owns_canteen(canteen_id)) WITH CHECK (public.owns_canteen(canteen_id));
CREATE POLICY "Public read canteen home banners" ON storage.objects FOR SELECT TO public USING (bucket_id = 'canteen-home-banners');
CREATE POLICY "Canteen owners upload home banners" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'canteen-home-banners' AND EXISTS (SELECT 1 FROM public.canteens c WHERE c.id::text = (storage.foldername(storage.objects.name))[1] AND public.owns_canteen(c.id)));
CREATE POLICY "Canteen owners delete home banners" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'canteen-home-banners' AND EXISTS (SELECT 1 FROM public.canteens c WHERE c.id::text = (storage.foldername(storage.objects.name))[1] AND public.owns_canteen(c.id)));
ALTER PUBLICATION supabase_realtime ADD TABLE public.canteen_templates;

CREATE TABLE public.user_language_preferences (
  user_id uuid PRIMARY KEY,
  language text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'hi', 'kn')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_language_preferences TO authenticated;
GRANT ALL ON public.user_language_preferences TO service_role;
ALTER TABLE public.user_language_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_language_preferences_read_own ON public.user_language_preferences FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY user_language_preferences_insert_own ON public.user_language_preferences FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY user_language_preferences_update_own ON public.user_language_preferences FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE TABLE public.order_print_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  canteen_id uuid NOT NULL REFERENCES public.canteens(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  order_number text NOT NULL,
  order_type text NOT NULL CHECK (order_type IN ('dine_in','parcel')),
  payment_method text NOT NULL CHECK (payment_method IN ('counter','razorpay')),
  payment_status text NOT NULL CHECK (payment_status IN ('unpaid','pending','paid','failed','refund_pending','refunded')),
  order_status text NOT NULL CHECK (order_status IN ('pending_payment','placed','preparing','ready','collected','cancelled')),
  paper_width text NOT NULL CHECK (paper_width IN ('auto','58','80')),
  bill_snapshot jsonb NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_print_events_order_created ON public.order_print_events(order_id, created_at DESC);
CREATE INDEX order_print_events_owner_created ON public.order_print_events(owner_user_id, created_at DESC);
GRANT SELECT ON public.order_print_events TO authenticated;
GRANT ALL ON public.order_print_events TO service_role;
ALTER TABLE public.order_print_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Canteen owners read their print events" ON public.order_print_events FOR SELECT TO authenticated USING (owner_user_id = auth.uid() AND public.owns_canteen(canteen_id));
CREATE POLICY "Admins read order print events" ON public.order_print_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  canteen_id uuid REFERENCES public.canteens(id) ON DELETE SET NULL,
  sender_name text NOT NULL,
  sender_email text NOT NULL DEFAULT '',
  sender_role text NOT NULL,
  category text NOT NULL CHECK (category IN ('Rate Us','Feedback','Report an issue','Order issue','Payment issue','Operational issue','Other')),
  description text NOT NULL CHECK (char_length(description) BETWEEN 3 AND 2000),
  order_number text NOT NULL DEFAULT '' CHECK (char_length(order_number) <= 80),
  rating integer CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  email_status text NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending','sent','failed')),
  email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((category = 'Rate Us' AND rating IS NOT NULL) OR (category <> 'Rate Us' AND rating IS NULL))
);
CREATE INDEX support_requests_user_created ON public.support_requests(user_id, created_at DESC);
CREATE INDEX support_requests_canteen_created ON public.support_requests(canteen_id, created_at DESC);
GRANT SELECT ON public.support_requests TO authenticated;
GRANT ALL ON public.support_requests TO service_role;
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own support requests" ON public.support_requests FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR (canteen_id IS NOT NULL AND public.owns_canteen(canteen_id)) OR public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.canteens
  ADD COLUMN availability_mode text NOT NULL DEFAULT 'schedule' CHECK (availability_mode IN ('schedule','open','closed')),
  ADD COLUMN timezone text NOT NULL DEFAULT 'Asia/Kolkata' CHECK (timezone = 'Asia/Kolkata'),
  ADD COLUMN operating_hours jsonb NOT NULL DEFAULT '{"mon":{"open":"00:00","close":"24:00"},"tue":{"open":"00:00","close":"24:00"},"wed":{"open":"00:00","close":"24:00"},"thu":{"open":"00:00","close":"24:00"},"fri":{"open":"00:00","close":"24:00"},"sat":{"open":"00:00","close":"24:00"},"sun":{"open":"00:00","close":"24:00"}}'::jsonb;

CREATE OR REPLACE FUNCTION public.valid_canteen_hours(p_hours jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v_day text; v_hours jsonb; v_open text; v_close text; v_open_min integer; v_close_min integer;
BEGIN
  IF jsonb_typeof(p_hours) <> 'object' THEN RETURN false; END IF;
  FOREACH v_day IN ARRAY ARRAY['mon','tue','wed','thu','fri','sat','sun'] LOOP
    IF NOT (p_hours ? v_day) THEN RETURN false; END IF;
    v_hours := p_hours -> v_day;
    IF v_hours = 'null'::jsonb THEN CONTINUE; END IF;
    IF jsonb_typeof(v_hours) <> 'object' THEN RETURN false; END IF;
    v_open := v_hours ->> 'open';
    v_close := v_hours ->> 'close';
    IF v_open IS NULL OR v_close IS NULL
       OR v_open !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       OR v_close !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$|^24:00$' THEN RETURN false; END IF;
    IF v_open = '00:00' AND v_close = '24:00' THEN CONTINUE; END IF;
    v_open_min := split_part(v_open,':',1)::integer * 60 + split_part(v_open,':',2)::integer;
    v_close_min := CASE WHEN v_close = '24:00' THEN 1440 ELSE split_part(v_close,':',1)::integer * 60 + split_part(v_close,':',2)::integer END;
    IF v_close_min <= v_open_min THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END $$;
ALTER TABLE public.canteens ADD CONSTRAINT canteens_operating_hours_valid CHECK (public.valid_canteen_hours(operating_hours));

CREATE OR REPLACE FUNCTION public.guard_order_canteen_availability()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_canteen public.canteens%ROWTYPE; v_local timestamp; v_day text; v_hours jsonb; v_open text; v_close text;
  v_minute integer; v_open_min integer; v_close_min integer;
BEGIN
  SELECT * INTO v_canteen FROM public.canteens WHERE id = NEW.canteen_id FOR UPDATE;
  IF NOT FOUND OR NOT v_canteen.is_active OR v_canteen.visibility = 'maintenance' THEN RAISE EXCEPTION 'HUNGRY:canteen_closed'; END IF;
  IF v_canteen.availability_mode = 'closed' THEN RAISE EXCEPTION 'HUNGRY:canteen_closed'; END IF;
  IF v_canteen.availability_mode = 'open' THEN RETURN NEW; END IF;
  v_local := clock_timestamp() AT TIME ZONE v_canteen.timezone;
  v_day := lower(to_char(v_local, 'Dy'));
  v_hours := v_canteen.operating_hours -> v_day;
  IF v_hours IS NULL OR v_hours = 'null'::jsonb THEN RAISE EXCEPTION 'HUNGRY:canteen_closed'; END IF;
  v_open := v_hours ->> 'open';
  v_close := v_hours ->> 'close';
  v_minute := extract(hour FROM v_local)::integer * 60 + extract(minute FROM v_local)::integer;
  v_open_min := split_part(v_open,':',1)::integer * 60 + split_part(v_open,':',2)::integer;
  v_close_min := CASE WHEN v_close = '24:00' THEN 1440 ELSE split_part(v_close,':',1)::integer * 60 + split_part(v_close,':',2)::integer END;
  IF NOT (v_open_min = 0 AND v_close_min = 1440) AND (v_minute < v_open_min OR v_minute >= v_close_min) THEN
    RAISE EXCEPTION 'HUNGRY:canteen_closed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER orders_check_canteen_availability BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_order_canteen_availability();
GRANT EXECUTE ON FUNCTION public.valid_canteen_hours(jsonb) TO authenticated, service_role;

CREATE TABLE public.scanner_access (
  user_id uuid PRIMARY KEY,
  version text NOT NULL DEFAULT '1.0',
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
GRANT SELECT ON public.scanner_access TO authenticated;
GRANT ALL ON public.scanner_access TO service_role;
ALTER TABLE public.scanner_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own scanner access" ON public.scanner_access FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.hungry_start_scanner_trial()
RETURNS public.scanner_access LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.scanner_access;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student') THEN
    RAISE EXCEPTION 'HUNGRY:students_only';
  END IF;
  INSERT INTO public.scanner_access (user_id, started_at, expires_at)
  VALUES (auth.uid(), now(), now() + interval '1 month')
  ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO r FROM public.scanner_access WHERE user_id = auth.uid();
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.hungry_start_scanner_trial() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hungry_start_scanner_trial() TO authenticated;

CREATE TABLE public.food_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  food_name text NOT NULL CHECK (char_length(food_name) BETWEEN 1 AND 120),
  portion text NOT NULL DEFAULT '',
  calories integer NOT NULL DEFAULT 0,
  protein_g numeric NOT NULL DEFAULT 0,
  carbs_g numeric NOT NULL DEFAULT 0,
  fat_g numeric NOT NULL DEFAULT 0,
  fibre_g numeric NOT NULL DEFAULT 0,
  sugar_g numeric NOT NULL DEFAULT 0,
  confidence text NOT NULL DEFAULT 'medium',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX food_scans_user_created ON public.food_scans(user_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.food_scans TO authenticated;
GRANT ALL ON public.food_scans TO service_role;
ALTER TABLE public.food_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own scans" ON public.food_scans FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own scans" ON public.food_scans FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Active students insert scans" ON public.food_scans FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.scanner_access a WHERE a.user_id = auth.uid() AND a.expires_at > now()));